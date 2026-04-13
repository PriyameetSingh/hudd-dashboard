import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/financial-budget-entries";
import { getFinancialBudgetEntriesOverview } from "@/lib/financial-budget-entries";
import type { FinancialEntry } from "@/types";

export type CommandCentreVerticalSummary = {
  id: string;
  name: string;
  budgetCr: number;
  ifmsCr: number;
  soCr: number;
  pct: number;
  status: "critical" | "warning" | "on-track";
  schemeCount: number;
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
  verticals: CommandCentreVerticalSummary[];
  topSchemes: CommandCentreSchemeLeader[];
  bottomSchemes: CommandCentreSchemeLeader[];
  ifmsTrend: CommandCentreIfmsTrendPoint[];
  overdueActionsCount: number;
  overdueActionsPreview: CommandCentreOverduePreview[];
  criticalVerticalCount: number;
};

function schemePct(entry: FinancialEntry): number {
  const b = entry.effectiveBudgetCr ?? entry.annualBudget + (entry.totalSupplementCr ?? 0);
  if (!b || b <= 0) return 0;
  return (entry.ifms / b) * 100;
}

function verticalStatusFromPct(pct: number): CommandCentreVerticalSummary["status"] {
  if (pct < 40) return "critical";
  if (pct < 75) return "warning";
  return "on-track";
}

export async function getCommandCentreDashboard(): Promise<CommandCentreDashboard> {
  const fyRow = await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" }, select: { id: true } });

  const [{ entries, financialYearLabel }, overdueItems, trendRows] = await Promise.all([
    getFinancialBudgetEntriesOverview(),
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

  const byVertical = new Map<
    string,
    { budget: number; ifms: number; so: number; count: number }
  >();
  for (const e of entries) {
    const v = e.vertical || "—";
    const row = byVertical.get(v) ?? { budget: 0, ifms: 0, so: 0, count: 0 };
    const b = e.effectiveBudgetCr ?? e.annualBudget + (e.totalSupplementCr ?? 0);
    row.budget += b;
    row.ifms += e.ifms;
    row.so += e.so;
    row.count += 1;
    byVertical.set(v, row);
  }

  const verticals: CommandCentreVerticalSummary[] = Array.from(byVertical.entries()).map(([name, agg], idx) => {
    const pct = agg.budget > 0 ? (agg.ifms / agg.budget) * 100 : 0;
    return {
      id: `v-${idx}-${name.replace(/\s+/g, "-").slice(0, 24)}`,
      name,
      budgetCr: agg.budget,
      ifmsCr: agg.ifms,
      soCr: agg.so,
      pct,
      status: verticalStatusFromPct(pct),
      schemeCount: agg.count,
    };
  });
  verticals.sort((a, b) => b.budgetCr - a.budgetCr);

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

  const criticalVerticalCount = verticals.filter((v) => v.status === "critical").length;

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
    verticals,
    topSchemes,
    bottomSchemes,
    ifmsTrend,
    overdueActionsCount: overdueCount,
    overdueActionsPreview,
    criticalVerticalCount,
  };
}
