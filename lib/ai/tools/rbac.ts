import { prisma } from "@/lib/prisma";
import { ConversationContext } from "./types";

/**
 * Build conversation context with RBAC information for the user
 */
export async function buildConversationContext(userId: string): Promise<ConversationContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
      permissionOverrides: { include: { permission: true } },
      schemeAssignments: {
        include: { scheme: true, subscheme: true },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Get role codes
  const userRoleCodes = user.userRoles.map((ur) => ur.role.code);

  // Get effective permissions
  const fromRoles = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => rp.permission.code)
  );
  const allow = user.permissionOverrides
    .filter((o) => o.effect === "allow")
    .map((o) => o.permission.code);
  const deny = new Set(
    user.permissionOverrides
      .filter((o) => o.effect === "deny")
      .map((o) => o.permission.code)
  );

  const permissions = new Set<string>();
  for (const code of fromRoles) permissions.add(code);
  for (const code of allow) permissions.add(code);
  for (const code of permissions) {
    if (deny.has(code)) permissions.delete(code);
  }

  // Get accessible schemes
  const accessibleSchemeIds = user.schemeAssignments
    .map((sa) => sa.schemeId)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  // Get accessible verticals from scheme assignments
  const schemes = await prisma.scheme.findMany({
    where: { id: { in: accessibleSchemeIds } },
    select: { verticalId: true },
  });
  const accessibleVerticalIds = schemes
    .map((s) => s.verticalId)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  return {
    userId: user.id,
    userRoleCodes,
    permissions,
    accessibleSchemeIds,
    accessibleVerticalIds,
  };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(ctx: ConversationContext, permissionCode: string): boolean {
  return ctx.permissions.has(permissionCode);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(ctx: ConversationContext, ...permissionCodes: string[]): boolean {
  return permissionCodes.some((code) => ctx.permissions.has(code));
}

/**
 * Get where clause for scheme access based on user context
 * Returns a Prisma where clause that filters by accessible schemes
 */
export function getSchemeAccessFilter(ctx: ConversationContext): { schemeId?: { in: string[] } } {
  // If user has VIEW_ALL_DATA permission, no filtering needed
  if (ctx.permissions.has("VIEW_ALL_DATA")) {
    return {};
  }

  // Otherwise, filter by accessible scheme IDs
  return { schemeId: { in: ctx.accessibleSchemeIds } };
}

/**
 * Get where clause for vertical access
 */
export function getVerticalAccessFilter(ctx: ConversationContext): { verticalId?: { in: string[] } } {
  if (ctx.permissions.has("VIEW_ALL_DATA")) {
    return {};
  }

  return { verticalId: { in: ctx.accessibleVerticalIds } };
}

/**
 * Verify user has access to a specific scheme
 */
export function verifySchemeAccess(ctx: ConversationContext, schemeId: string): boolean {
  if (ctx.permissions.has("VIEW_ALL_DATA")) return true;
  return ctx.accessibleSchemeIds.includes(schemeId);
}

/**
 * Common permission codes used across tools
 */
export const PERMISSIONS = {
  VIEW_ALL_DATA: "VIEW_ALL_DATA",
  VIEW_ASSIGNED_DATA: "VIEW_ASSIGNED_DATA",
  VIEW_FINANCE_DATA: "VIEW_FINANCE_DATA",
  VIEW_KPI_DATA: "VIEW_KPI_DATA",
  VIEW_ACTION_ITEMS: "VIEW_ACTION_ITEMS",
  VIEW_SCHEMES: "VIEW_SCHEMES",
} as const;
