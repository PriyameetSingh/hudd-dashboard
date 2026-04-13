import { redirect } from "next/navigation";
import DatabaseUnavailableShell from "@/components/DatabaseUnavailableShell";
import { UserRole } from "@/lib/auth";
import { asDatabaseUnavailableError } from "@/lib/db-errors";
import { getSessionUser } from "@/lib/server-auth";
import { AuthError, requireAnyPermission } from "@/lib/server-rbac";
import SchemesBoardClient from "./SchemesBoardClient";

export default async function SchemesBoardPage() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");
    const session = await getSessionUser();
    return <SchemesBoardClient userRole={session?.role as UserRole | undefined} />;
  } catch (e) {
    if (e instanceof AuthError) {
      redirect("/login");
    }
    if (asDatabaseUnavailableError(e)) {
      return (
        <DatabaseUnavailableShell title="Scheme utilisation board" heading="Financial data isn’t available" />
      );
    }
    throw e;
  }
}
