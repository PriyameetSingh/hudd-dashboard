import { cache } from "react";
import { asDatabaseUnavailableError, toDatabaseErrorResponse } from "@/lib/db-errors";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/server-auth";

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toAuthErrorResponse(error: unknown): { status: number; detail: string } | null {
  if (error instanceof AuthError) {
    return { status: error.status, detail: error.message };
  }
  return toDatabaseErrorResponse(error);
}

async function loadDbUserBySession() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;
  try {
    return await prisma.user.findFirst({
      where: { code: sessionUser.id },
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
      },
    });
  } catch (e) {
    const mapped = asDatabaseUnavailableError(e);
    if (mapped) throw mapped;
    throw e;
  }
}

/** One Prisma load per request (deduped via React cache in RSC and route handlers). */
export const getDbUserBySession = cache(loadDbUserBySession);

export type DbUserWithRbac = NonNullable<Awaited<ReturnType<typeof loadDbUserBySession>>>;

export function getEffectivePermissionCodesFromUser(user: DbUserWithRbac | null): Set<string> {
  if (!user) return new Set();

  const fromRoles = user.userRoles.flatMap((ur) =>
    ur.role.rolePermissions.map((rp) => rp.permission.code as string),
  );
  const allow = user.permissionOverrides.filter((o) => o.effect === "allow").map((o) => o.permission.code as string);
  const deny = new Set(user.permissionOverrides.filter((o) => o.effect === "deny").map((o) => o.permission.code as string));

  const effective = new Set<string>();
  for (const code of fromRoles) effective.add(code);
  for (const code of allow) effective.add(code);
  for (const code of effective) {
    if (deny.has(code)) effective.delete(code);
  }
  return effective;
}

export async function getEffectivePermissionCodes(): Promise<Set<string>> {
  const user = await getDbUserBySession();
  return getEffectivePermissionCodesFromUser(user);
}

export async function requirePermission(permissionCode: string) {
  const user = await getDbUserBySession();
  const effective = getEffectivePermissionCodesFromUser(user);
  if (!effective.has(permissionCode)) {
    throw new AuthError(403, "Forbidden");
  }
}

export async function requireAnyPermission(...permissionCodes: string[]) {
  const user = await getDbUserBySession();
  const effective = getEffectivePermissionCodesFromUser(user);
  if (!permissionCodes.some((code) => effective.has(code))) {
    throw new AuthError(403, "Forbidden");
  }
}

/** Same as requirePermission but returns the loaded DB user for reuse (single getDbUserBySession per handler). */
export async function requirePermissionAndDbUser(permissionCode: string) {
  const user = await getDbUserBySession();
  const effective = getEffectivePermissionCodesFromUser(user);
  if (!effective.has(permissionCode)) {
    throw new AuthError(403, "Forbidden");
  }
  return user;
}

/** Same as requireAnyPermission but returns the loaded DB user for reuse (single getDbUserBySession per handler). */
export async function requireAnyPermissionAndDbUser(...permissionCodes: string[]) {
  const user = await getDbUserBySession();
  const effective = getEffectivePermissionCodesFromUser(user);
  if (!permissionCodes.some((code) => effective.has(code))) {
    throw new AuthError(403, "Forbidden");
  }
  return user;
}

export async function hasPermission(permissionCode: string): Promise<boolean> {
  const user = await getDbUserBySession();
  return getEffectivePermissionCodesFromUser(user).has(permissionCode);
}

export function hasPermissionForUser(user: DbUserWithRbac | null, permissionCode: string): boolean {
  return getEffectivePermissionCodesFromUser(user).has(permissionCode);
}
