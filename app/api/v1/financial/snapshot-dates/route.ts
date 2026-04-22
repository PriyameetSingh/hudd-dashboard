import { NextResponse } from "next/server";
import {
  asOfDateToYmd,
  getActiveFinancialYearCached,
  getCachedFinanceSummaryHeadDatesGroupBy,
} from "@/lib/cached-financial-metadata";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

/** Distinct FA summary as-of dates (desc) for the active FY — must match `/api/v1/financial/summary?asOfDate=`. */
export async function GET() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const fy = await getActiveFinancialYearCached();
    if (!fy) {
      return NextResponse.json({ dates: [] });
    }

    const rows = await getCachedFinanceSummaryHeadDatesGroupBy(fy.id);

    const dates = rows.map((r) => asOfDateToYmd(r.asOfDate));
    return NextResponse.json({ dates });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
