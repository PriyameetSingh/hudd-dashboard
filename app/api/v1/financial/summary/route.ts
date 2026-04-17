import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import {
  FINANCE_YEAR_BUDGET_CATEGORY_LABELS,
  FINANCE_YEAR_BUDGET_CATEGORY_ORDER,
} from "@/lib/finance-year-budget-allocation";
import { ensureFyBudgetAllocationWithLines } from "@/lib/server/ensure-fy-budget-allocation";
import { requireAnyPermission, requireAnyPermissionAndDbUser, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

const HEAD_LABELS: Record<string, string> = {
  PLAN_TYPE: "Plan Type",
  TRANSFER: "Transfer",
  ADMIN_EXPENDITURE: "Admin Expenditure",
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const { searchParams } = new URL(request.url);
    const asOfDateParam = searchParams.get("asOfDate");
    const fyLabel = searchParams.get("financialYearLabel");

    let fy = fyLabel
      ? await prisma.financialYear.findUnique({ where: { label: fyLabel } })
      : await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });
    if (!fy && fyLabel) {
      fy = await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });
    }

    if (!fy) {
      return NextResponse.json({
        financialYearLabel: null,
        asOfDate: null,
        rows: [],
        totals: { budgetEstimateCr: 0, soExpenditureCr: 0, ifmsExpenditureCr: 0 },
      });
    }

    const asOfDate = asOfDateParam
      ? new Date(`${asOfDateParam}T00:00:00.000Z`)
      : undefined;

    const heads = await prisma.financeSummaryHead.findMany({
      where: {
        financialYearId: fy.id,
        ...(asOfDate ? { asOfDate } : {}),
      },
      orderBy: { headCode: "asc" },
    });

    let rows = heads.map((h) => ({
      headCode: h.headCode,
      label: HEAD_LABELS[h.headCode] ?? h.headCode,
      budgetEstimateCr: toNumber(h.budgetEstimateCr),
      soExpenditureCr: toNumber(h.soExpenditureCr),
      ifmsExpenditureCr: toNumber(h.ifmsExpenditureCr),
    }));

    let responseAsOf: string | null = asOfDate?.toISOString().slice(0, 10) ?? null;

    if (rows.length === 0) {
      if (!asOfDate) {
        const allocation = await ensureFyBudgetAllocationWithLines(fy.id, null);
        const lineByCategory = new Map(allocation.categoryLines.map((l) => [l.category, l]));
        rows = FINANCE_YEAR_BUDGET_CATEGORY_ORDER.map((category) => {
          const row = lineByCategory.get(category);
          return {
            headCode: category,
            label: FINANCE_YEAR_BUDGET_CATEGORY_LABELS[category],
            budgetEstimateCr: row ? toNumber(row.budgetEstimateCr) : 0,
            soExpenditureCr: row ? toNumber(row.soExpenditureCr) : 0,
            ifmsExpenditureCr: row ? toNumber(row.ifmsExpenditureCr) : 0,
          };
        });
        responseAsOf = null;
      } else {
        const allocation = await ensureFyBudgetAllocationWithLines(fy.id, null);
        const lineByCategory = new Map(allocation.categoryLines.map((l) => [l.category, l]));
        const budgetEstimateCr = FINANCE_YEAR_BUDGET_CATEGORY_ORDER.reduce(
          (acc, category) => acc + toNumber(lineByCategory.get(category)?.budgetEstimateCr),
          0,
        );
        const snap = await prisma.financeExpenditureSnapshot.aggregate({
          where: { financialYearId: fy.id, asOfDate },
          _sum: { soExpenditureCr: true, ifmsExpenditureCr: true },
        });
        rows = [];
        const totals = {
          budgetEstimateCr,
          soExpenditureCr: toNumber(snap._sum.soExpenditureCr),
          ifmsExpenditureCr: toNumber(snap._sum.ifmsExpenditureCr),
        };
        return NextResponse.json({
          financialYearLabel: fy.label,
          asOfDate: responseAsOf,
          rows,
          totals,
        });
      }
    }

    const totals = rows.reduce(
      (acc, r) => ({
        budgetEstimateCr: acc.budgetEstimateCr + r.budgetEstimateCr,
        soExpenditureCr: acc.soExpenditureCr + r.soExpenditureCr,
        ifmsExpenditureCr: acc.ifmsExpenditureCr + r.ifmsExpenditureCr,
      }),
      { budgetEstimateCr: 0, soExpenditureCr: 0, ifmsExpenditureCr: 0 },
    );

    return NextResponse.json({
      financialYearLabel: fy.label,
      asOfDate: responseAsOf,
      rows,
      totals,
    });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

type Body = {
  financialYearLabel?: string;
  asOfDate: string;
  rows: Array<{
    headCode: "PLAN_TYPE" | "TRANSFER" | "ADMIN_EXPENDITURE";
    budgetEstimateCr: number;
    soExpenditureCr: number;
    ifmsExpenditureCr: number;
  }>;
};

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAnyPermissionAndDbUser("ENTER_FINANCIAL_DATA");

    const body = (await request.json()) as Body;
    const fy = body.financialYearLabel
      ? await prisma.financialYear.findUnique({ where: { label: body.financialYearLabel } })
      : await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });

    if (!fy) {
      return NextResponse.json({ detail: "Financial year not found" }, { status: 404 });
    }

    const asOfDate = new Date(`${body.asOfDate}T00:00:00.000Z`);
    const auditContext = getAuditRequestContext(request);

    for (const row of body.rows ?? []) {
      const before = await prisma.financeSummaryHead.findFirst({
        where: {
          financialYearId: fy.id,
          headCode: row.headCode,
          asOfDate,
        },
      });

      const saved = await prisma.financeSummaryHead.upsert({
        where: {
          financialYearId_headCode_asOfDate: {
            financialYearId: fy.id,
            headCode: row.headCode,
            asOfDate,
          },
        },
        create: {
          financialYearId: fy.id,
          headCode: row.headCode,
          asOfDate,
          budgetEstimateCr: row.budgetEstimateCr,
          soExpenditureCr: row.soExpenditureCr,
          ifmsExpenditureCr: row.ifmsExpenditureCr,
          createdById: actor?.id ?? null,
        },
        update: {
          budgetEstimateCr: row.budgetEstimateCr,
          soExpenditureCr: row.soExpenditureCr,
          ifmsExpenditureCr: row.ifmsExpenditureCr,
          createdById: actor?.id ?? null,
        },
      });

      await logAudit(
        actor?.id,
        before ? "financial.summary.update" : "financial.summary.create",
        "finance_summary_head",
        saved.id,
        before
          ? {
              budgetEstimateCr: before.budgetEstimateCr.toString(),
              soExpenditureCr: before.soExpenditureCr.toString(),
              ifmsExpenditureCr: before.ifmsExpenditureCr.toString(),
            }
          : null,
        {
          headCode: saved.headCode,
          budgetEstimateCr: saved.budgetEstimateCr.toString(),
          soExpenditureCr: saved.soExpenditureCr.toString(),
          ifmsExpenditureCr: saved.ifmsExpenditureCr.toString(),
        },
        { ...auditContext, financialYearId: fy.id, asOfDate: asOfDate.toISOString().slice(0, 10) },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
