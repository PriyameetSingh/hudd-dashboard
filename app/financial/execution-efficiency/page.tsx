import { redirect } from "next/navigation";
import DatabaseUnavailableShell from "@/components/DatabaseUnavailableShell";
import { UserRole } from "@/lib/auth";
import { asDatabaseUnavailableError } from "@/lib/db-errors";
import { getSessionUser } from "@/lib/server-auth";
import { AuthError, requireAnyPermission } from "@/lib/server-rbac";
import ExecutionEfficiencyClient from "./ExecutionEfficiencyClient";

export default async function ExecutionEfficiencyPage() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");
    const session = await getSessionUser();
    return <ExecutionEfficiencyClient userRole={session?.role as UserRole | undefined} />;
  } catch (e) {
    if (e instanceof AuthError) {
      redirect("/login");
    }
    if (asDatabaseUnavailableError(e)) {
      return (
        <DatabaseUnavailableShell title="Execution efficiency" heading="Financial data isn’t available" />
      );
    }
    throw e;
  }
}
