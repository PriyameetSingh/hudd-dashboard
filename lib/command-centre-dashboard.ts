import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/financial-budget-entries";
import { getFinancialBudgetEntriesOverview } from "@/lib/financial-budget-entries";
import type { DbUserWithRbac } from "@/lib/server-rbac";
import type { FinancialEntry } from "@/types";

export type CommandCentreSchemeSummary = {
  id: string;
  /** Prisma scheme UUID (for APIs such as scheme modal); entry `id` is scheme code */
  schemeId: string;
  scheme: string;
  vertical: string;
  budgetCr: number;
  ifmsCr: number;
  soCr: number;
  pct: number;
  status: "critical" | "warning" | "on-track";
};

export type CommandCentreSchemeLeader = {
  id: string;
  scheme: string;
  vertical: string;
  budgetCr: number;
  ifmsCr: number;
  pct: number;
};

export type CommandCentreIfmsTrendPoint = {
  asOfDate: string;
  ifmsCr: number;
};

export type CommandCentreOverduePreview = {
  id: string;
  title: string;
  officer: string;
  daysOverdue: number;
};

export type CommandCentreDashboard = {
  financialYearLabel: string | null;
  lastSnapshotDate: string | null;
  totals: {
    totalBudgetCr: number;
    totalSoCr: number;
    totalIfmsCr: number;
    utilisationPct: number;
    lapseRiskCr: number;
  };
  schemes: CommandCentreSchemeSummary[];
  topSchemes: CommandCentreSchemeLeader[];
  bottomSchemes: CommandCentreSchemeLeader[];
  ifmsTrend: CommandCentreIfmsTrendPoint[];
  overdueActionsCount: number;
  overdueActionsPreview: CommandCentreOverduePreview[];
  criticalSchemeCount: number;
};

function schemePct(entry: FinancialEntry): number {
  const b = entry.effectiveBudgetCr ?? entry.annualBudget + (entry.totalSupplementCr ?? 0);
  if (!b || b <= 0) return 0;
  return (entry.ifms / b) * 100;
}

function schemeStatusFromPct(pct: number): CommandCentreSchemeSummary["status"] {
  if (pct < 40) return "critical";
  if (pct < 75) return "warning";
  return "on-track";
}

export async function getCommandCentreDashboard(actor?: DbUserWithRbac | null): Promise<CommandCentreDashboard> {
  const fyRow = await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" }, select: { id: true } });

  const [{ entries, financialYearLabel }, overdueItems, trendRows] = await Promise.all([
    getFinancialBudgetEntriesOverview(actor),
    prisma.actionItem.findMany({
      where: { status: "OVERDUE" },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: {
        assignedTo: { select: { name: true } },
      },
    }),
    fyRow
      ? prisma.financeExpenditureSnapshot.groupBy({
          by: ["asOfDate"],
          where: { financialYearId: fyRow.id },
          _sum: { ifmsExpenditureCr: true },
          orderBy: { asOfDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const fy = fyRow;

  let lastSnapshotDate: string | null = null;
  if (fy) {
    const latest = await prisma.financeExpenditureSnapshot.findFirst({
      where: { financialYearId: fy.id },
      orderBy: { asOfDate: "desc" },
      select: { asOfDate: true },
    });
    lastSnapshotDate = latest?.asOfDate.toISOString().slice(0, 10) ?? null;
  }

  const totalBudgetCr = entries.reduce((s, e) => s + (e.effectiveBudgetCr ?? e.annualBudget + (e.totalSupplementCr ?? 0)), 0);
  const totalSoCr = entries.reduce((s, e) => s + e.so, 0);
  const totalIfmsCr = entries.reduce((s, e) => s + e.ifms, 0);
  const utilisationPct = totalBudgetCr > 0 ? (totalIfmsCr / totalBudgetCr) * 100 : 0;
  const lapseRiskCr = Math.max(0, totalBudgetCr - totalIfmsCr);

  const schemes: CommandCentreSchemeSummary[] = entries.map((e) => {
    const budgetCr = e.effectiveBudgetCr ?? e.annualBudget + (e.totalSupplementCr ?? 0);
    const pct = schemePct(e);
    return {
      id: e.id,
      schemeId: e.schemeId ?? e.id,
      scheme: e.scheme,
      vertical: e.vertical || "—",
      budgetCr,
      ifmsCr: e.ifms,
      soCr: e.so,
      pct,
      status: schemeStatusFromPct(pct),
    };
  });
  schemes.sort((a, b) => b.budgetCr - a.budgetCr);

  const withPct = entries.map((e) => ({
    entry: e,
    pct: schemePct(e),
  }));
  const sorted = [...withPct].sort((a, b) => b.pct - a.pct);
  const topSchemes: CommandCentreSchemeLeader[] = sorted.slice(0, 6).map(({ entry: e, pct }) => ({
    id: e.id,
    scheme: e.scheme,
    vertical: e.vertical,
    budgetCr: e.effectiveBudgetCr ?? e.annualBudget + (e.totalSupplementCr ?? 0),
    ifmsCr: e.ifms,
    pct,
  }));
  const bottomSchemes: CommandCentreSchemeLeader[] = [...withPct]
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 6)
    .map(({ entry: e, pct }) => ({
      id: e.id,
      scheme: e.scheme,
      vertical: e.vertical,
      budgetCr: e.effectiveBudgetCr ?? e.annualBudget + (e.totalSupplementCr ?? 0),
      ifmsCr: e.ifms,
      pct,
    }));

  const ifmsTrend: CommandCentreIfmsTrendPoint[] = (trendRows as { asOfDate: Date; _sum: { ifmsExpenditureCr: unknown } }[]).map(
    (row) => ({
      asOfDate: row.asOfDate.toISOString().slice(0, 10),
      ifmsCr: toNumber(row._sum.ifmsExpenditureCr),
    }),
  );

  const overdueCount = await prisma.actionItem.count({ where: { status: "OVERDUE" } });

  const overdueActionsPreview: CommandCentreOverduePreview[] = overdueItems.map((item) => ({
    id: item.id,
    title: item.title,
    officer: item.assignedTo?.name ?? "—",
    daysOverdue: Math.max(
      0,
      Math.floor((Date.now() - item.dueDate.getTime()) / (24 * 60 * 60 * 1000)),
    ),
  }));

  const criticalSchemeCount = schemes.filter((s) => s.status === "critical").length;

  return {
    financialYearLabel,
    lastSnapshotDate,
    totals: {
      totalBudgetCr,
      totalSoCr,
      totalIfmsCr,
      utilisationPct,
      lapseRiskCr,
    },
    schemes,
    topSchemes,
    bottomSchemes,
    ifmsTrend,
    overdueActionsCount: overdueCount,
    overdueActionsPreview,
    criticalSchemeCount,
  };
}
