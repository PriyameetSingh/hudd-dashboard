import type { FinancialEntryStatus } from "@/types";

/** Map persisted workflow + dates to dashboard status labels (explicit, not stored in remarks). */
export function deriveFinancialEntryStatus(params: {
  workflowStatus: "draft" | "submitted";
  asOfDate: Date;
  referenceDate?: Date;
}): FinancialEntryStatus {
  const now = params.referenceDate ?? new Date();
  if (params.workflowStatus === "draft") {
    return "draft";
  }
  const ms = now.getTime() - params.asOfDate.getTime();
  const days = ms / (24 * 60 * 60 * 1000);
  if (days > 21) {
    return "overdue";
  }
  if (days <= 7) {
    return "submitted_this_week";
  }
  return "submitted_pending";
}
