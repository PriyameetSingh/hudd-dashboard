import { pendingApprovalSummaries } from "@/src/lib/mock-data";
import { PendingApprovalSummary, UserRole } from "@/types";

export async function fetchPendingApprovalSummaries(): Promise<PendingApprovalSummary[]> {
  return pendingApprovalSummaries;
}

export async function getPendingApprovalSummary(role: UserRole): Promise<PendingApprovalSummary | undefined> {
  return pendingApprovalSummaries.find((entry) => entry.role === role);
}
