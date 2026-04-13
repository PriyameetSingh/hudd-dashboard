import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

/** Distinct snapshot dates (desc) for the active FY — used for comparison pickers. */
export async function GET() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const fy = await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });
    if (!fy) {
      return NextResponse.json({ dates: [] });
    }

    const rows = await prisma.financeExpenditureSnapshot.groupBy({
      by: ["asOfDate"],
      where: { financialYearId: fy.id },
      orderBy: { asOfDate: "desc" },
    });

    const dates = rows.map((r) => r.asOfDate.toISOString().slice(0, 10));
    return NextResponse.json({ dates });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
