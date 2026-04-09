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

type DefinitionUpdater = { schemeId: string; assignedToId: string | null };

/** Per-KPI assignee wins when set; otherwise scheme `kpi_owner_1` rules apply. */
export async function assertKpiUpdaterForDefinition(
  definition: DefinitionUpdater,
  userId: string | undefined,
  userRoleIds: string[],
  options: { canManageSchemes?: boolean } = {},
) {
  if (options.canManageSchemes) return;
  if (definition.assignedToId) {
    if (userId && definition.assignedToId === userId) return;
    throw new AuthError(403, "Not assigned as the action owner for this KPI");
  }
  await assertKpiUpdaterForScheme(definition.schemeId, userId, userRoleIds);
}

type DefinitionReviewer = { schemeId: string; reviewerId: string | null };

/** Per-KPI reviewer wins when set; otherwise scheme `kpi_owner_2` rules apply. */
export async function assertKpiReviewerForDefinition(
  definition: DefinitionReviewer,
  userId: string | undefined,
  userRoleIds: string[],
  options: { canManageSchemes?: boolean } = {},
) {
  if (options.canManageSchemes) return;
  if (definition.reviewerId) {
    if (userId && definition.reviewerId === userId) return;
    throw new AuthError(403, "Not assigned as the reviewer for this KPI");
  }
  await assertKpiReviewerForScheme(definition.schemeId, userId, userRoleIds);
}

export function userRoleIdsFromDbUser(user: { userRoles: Array<{ roleId: string }> } | null | undefined): string[] {
  if (!user) return [];
  return user.userRoles.map((ur) => ur.roleId);
}

/** For UI: whether this user may enter measurements (permission + assignment), without throwing. */
export async function userCanEnterKpiMeasurement(
  definition: DefinitionUpdater,
  userId: string | undefined,
  userRoleIds: string[],
  canManageSchemes: boolean,
): Promise<boolean> {
  try {
    await assertKpiUpdaterForDefinition(definition, userId, userRoleIds, { canManageSchemes });
    return true;
  } catch {
    return false;
  }
}

/** For UI: whether this user may review measurements (assignment), without throwing. */
export async function userCanReviewKpiMeasurement(
  definition: DefinitionReviewer,
  userId: string | undefined,
  userRoleIds: string[],
  canManageSchemes: boolean,
): Promise<boolean> {
  try {
    await assertKpiReviewerForDefinition(definition, userId, userRoleIds, { canManageSchemes });
    return true;
  } catch {
    return false;
  }
}
