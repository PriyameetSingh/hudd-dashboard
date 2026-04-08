import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/server-rbac";

export async function assertKpiUpdaterForScheme(schemeId: string, userId: string | undefined, userRoleIds: string[]) {
  const owners = await prisma.schemeAssignment.findMany({
    where: { schemeId, assignmentKind: "kpi_owner_1" },
    select: { userId: true, roleId: true },
  });
  if (owners.length === 0) return;
  const ok = owners.some(
    (o) => (o.userId && userId && o.userId === userId) || (o.roleId && userRoleIds.includes(o.roleId)),
  );
  if (!ok) {
    throw new AuthError(403, "Not assigned as KPI owner (updater) for this scheme");
  }
}

export async function assertKpiReviewerForScheme(schemeId: string, userId: string | undefined, userRoleIds: string[]) {
  const owners = await prisma.schemeAssignment.findMany({
    where: { schemeId, assignmentKind: "kpi_owner_2" },
    select: { userId: true, roleId: true },
  });
  if (owners.length === 0) return;
  const ok = owners.some(
    (o) => (o.userId && userId && o.userId === userId) || (o.roleId && userRoleIds.includes(o.roleId)),
  );
  if (!ok) {
    throw new AuthError(403, "Not assigned as KPI reviewer for this scheme");
  }
}

export function userRoleIdsFromDbUser(user: { userRoles: Array<{ roleId: string }> } | null | undefined): string[] {
  if (!user) return [];
  return user.userRoles.map((ur) => ur.roleId);
}
