import { redirect } from "next/navigation";
import DatabaseUnavailableShell from "@/components/DatabaseUnavailableShell";
import { UserRole } from "@/lib/auth";
import { asDatabaseUnavailableError } from "@/lib/db-errors";
import {
  getFinancialBudgetEntriesOverview,
  getFinanceSummaryBreakdownForOverview,
} from "@/lib/financial-budget-entries";
import { getSessionUser } from "@/lib/server-auth";
import { AuthError, requireAnyPermissionAndDbUser } from "@/lib/server-rbac";
import FinancialOverviewClient from "./FinancialOverviewClient";

export default async function FinancialOverviewPage() {
  try {
    const rbacUser = await requireAnyPermissionAndDbUser("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const [budgetData, session] = await Promise.all([
      getFinancialBudgetEntriesOverview(rbacUser),
      getSessionUser(),
    ]);

    const summary =
      budgetData.financialYearId && budgetData.financialYearLabel
        ? await getFinanceSummaryBreakdownForOverview(
            budgetData.entries,
            budgetData.financialYearId,
            budgetData.financialYearLabel,
          )
        : null;

    return (
      <FinancialOverviewClient
        entries={budgetData.entries}
        financialYearLabel={budgetData.financialYearLabel}
        summary={summary}
        userRole={session?.role as UserRole | undefined}
      />
    );
  } catch (e) {
    if (e instanceof AuthError) {
      redirect("/login");
    }
    if (asDatabaseUnavailableError(e)) {
      return (
        <DatabaseUnavailableShell
          title="Financial Overview"
          heading="Financial data isn’t available"
        />
      );
    }
    throw e;
  }
}
