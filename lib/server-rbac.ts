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
  return null;
}

export async function getDbUserBySession() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;
  return prisma.user.findFirst({
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
}

export async function getEffectivePermissionCodes(): Promise<Set<string>> {
  const user = await getDbUserBySession();
  if (!user) return new Set();

  const fromRoles = user.userRoles.flatMap((ur: any) => ur.role.rolePermissions.map((rp: any) => rp.permission.code as string));
  const allow = user.permissionOverrides.filter((o: any) => o.effect === "allow").map((o: any) => o.permission.code as string);
  const deny = new Set(user.permissionOverrides.filter((o: any) => o.effect === "deny").map((o: any) => o.permission.code as string));

  const effective = new Set<string>();
  for (const code of fromRoles) effective.add(code);
  for (const code of allow) effective.add(code);
  for (const code of effective) {
    if (deny.has(code)) effective.delete(code);
  }
  return effective;
}

export async function requirePermission(permissionCode: string) {
  const effective = await getEffectivePermissionCodes();
  if (!effective.has(permissionCode)) {
    throw new AuthError(403, "Forbidden");
  }
}

export async function requireAnyPermission(...permissionCodes: string[]) {
  const effective = await getEffectivePermissionCodes();
  if (!permissionCodes.some((code) => effective.has(code))) {
    throw new AuthError(403, "Forbidden");
  }
}

export async function hasPermission(permissionCode: string): Promise<boolean> {
  const effective = await getEffectivePermissionCodes();
  return effective.has(permissionCode);
}
