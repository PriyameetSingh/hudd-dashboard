import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const FALLBACK_STATUS = "not_started";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

export async function GET() {
  const fy = await prisma.financialYear.findFirst({
    orderBy: { endDate: "desc" },
  });

  if (!fy) {
    return NextResponse.json({ entries: [] });
  }

  const budgets = await prisma.financeBudget.findMany({
    where: { financialYearId: fy.id },
    include: {
      scheme: { include: { vertical: true } },
      createdBy: { select: { name: true } },
      financialYear: { select: { label: true } },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { createdBy: { select: { name: true } } },
      },
    },
    orderBy: { scheme: { name: "asc" } },
  });

  const snapshots = await prisma.financeExpenditureSnapshot.findMany({
    where: { financialYearId: fy.id },
    orderBy: { asOfDate: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  const latestByScheme = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!latestByScheme.has(snapshot.schemeId)) {
      latestByScheme.set(snapshot.schemeId, snapshot);
    }
  }

  return NextResponse.json({
    entries: budgets.map((budget: (typeof budgets)[number]) => {
      const latest = latestByScheme.get(budget.schemeId) ?? null;
      const status = latest?.remarks ?? FALLBACK_STATUS;
      return {
        id: budget.scheme.code,
        scheme: budget.scheme.name,
        vertical: budget.scheme.vertical.name,
        status,
        annualBudget: toNumber(budget.budgetEstimateCr),
        so: toNumber(latest?.soExpenditureCr ?? 0),
        ifms: toNumber(latest?.ifmsExpenditureCr ?? 0),
        lastUpdated: (latest?.asOfDate ?? budget.updatedAt).toISOString().slice(0, 10),
        locked: budget.locked,
        submitter: latest?.createdBy?.name ?? budget.createdBy?.name ?? "",
        updates: budget.revisions.map((revision: (typeof budget.revisions)[number]) => ({
          timestamp: revision.createdAt.toISOString().slice(0, 10),
          actor: revision.createdBy?.name ?? "",
          status,
          note: revision.reason,
          so: undefined,
          ifms: undefined,
        })),
      };
    }),
  });
}
