import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** `unstable_cache` JSON round-trips Prisma `Date` fields as ISO strings — normalize for API output. */
export function asOfDateToYmd(asOfDate: Date | string): string {
  return typeof asOfDate === "string" ? asOfDate.slice(0, 10) : asOfDate.toISOString().slice(0, 10);
}

/** Tags for `revalidateTag` from financial mutation routes. */
export const FINANCIAL_CACHE_TAGS = {
  financialYear: "cache-financial-year",
  ifmsTimeseries: "cache-ifms-timeseries",
  snapshotDates: "cache-snapshot-dates",
} as const;

const ALL_FINANCIAL_TAGS = Object.values(FINANCIAL_CACHE_TAGS);

/** Invalidate all cached financial reads (FY label, IFMS aggregates, snapshot date lists). */
export function revalidateFinancialCaches(): void {
  for (const tag of ALL_FINANCIAL_TAGS) {
    revalidateTag(tag, "max");
  }
}

/** Latest financial year by end date — short-lived cache. */
export async function getActiveFinancialYearCached() {
  return unstable_cache(
    async () =>
      prisma.financialYear.findFirst({
        orderBy: { endDate: "desc" },
        select: { id: true, label: true },
      }),
    ["cached-active-financial-year"],
    { revalidate: 120, tags: [FINANCIAL_CACHE_TAGS.financialYear] },
  )();
}

/** IFMS sum per snapshot date for one FY — cache keyed by `financialYearId`. */
export async function getCachedIfmsTimeseriesGroupBy(financialYearId: string) {
  return unstable_cache(
    async () =>
      prisma.financeExpenditureSnapshot.groupBy({
        by: ["asOfDate"],
        where: { financialYearId },
        _sum: { ifmsExpenditureCr: true },
        orderBy: { asOfDate: "asc" },
      }),
    ["cached-ifms-timeseries", financialYearId],
    { revalidate: 120, tags: [FINANCIAL_CACHE_TAGS.ifmsTimeseries, FINANCIAL_CACHE_TAGS.financialYear] },
  )();
}

/** Distinct finance summary head as-of dates for one FY (desc). */
export async function getCachedFinanceSummaryHeadDatesGroupBy(financialYearId: string) {
  return unstable_cache(
    async () =>
      prisma.financeSummaryHead.groupBy({
        by: ["asOfDate"],
        where: { financialYearId },
        orderBy: { asOfDate: "desc" },
      }),
    ["cached-snapshot-dates", financialYearId],
    { revalidate: 120, tags: [FINANCIAL_CACHE_TAGS.snapshotDates, FINANCIAL_CACHE_TAGS.financialYear] },
  )();
}
