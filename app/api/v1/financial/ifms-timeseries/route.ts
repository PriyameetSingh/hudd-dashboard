import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/financial-budget-entries";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

/** Aggregated IFMS (₹ Cr) per snapshot date for the active FY — same basis as Command Centre trend. */
export async function GET() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const fy = await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });
    if (!fy) {
      return NextResponse.json({ points: [] });
    }

    const rows = await prisma.financeExpenditureSnapshot.groupBy({
      by: ["asOfDate"],
      where: { financialYearId: fy.id },
      _sum: { ifmsExpenditureCr: true },
      orderBy: { asOfDate: "asc" },
    });

    const points = rows.map((r) => ({
      asOfDate: r.asOfDate.toISOString().slice(0, 10),
      ifmsCr: toNumber(r._sum.ifmsExpenditureCr),
    }));

    return NextResponse.json({ financialYearLabel: fy.label, points });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
