import { redirect } from "next/navigation";
import { UserRole } from "@/lib/auth";
import { getFinancialBudgetEntriesOverview, getFinanceSummaryBreakdown } from "@/lib/financial-budget-entries";
import { getSessionUser } from "@/lib/server-auth";
import { AuthError, requireAnyPermission } from "@/lib/server-rbac";
import FinancialOverviewClient from "./FinancialOverviewClient";

export default async function FinancialOverviewPage() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");
  } catch (e) {
    if (e instanceof AuthError) {
      redirect("/login");
    }
    throw e;
  }

  const [budgetData, summary] = await Promise.all([
    getFinancialBudgetEntriesOverview(),
    getFinanceSummaryBreakdown(),
  ]);

  const session = await getSessionUser();

  return (
    <FinancialOverviewClient
      entries={budgetData.entries}
      financialYearLabel={budgetData.financialYearLabel}
      summary={summary}
      userRole={session?.role as UserRole | undefined}
    />
  );
}
