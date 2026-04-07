import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

function computeEffective(roles: { permissions: string[] }[], overrides: { code: string; effect: string }[]) {
  const roleSet = new Set(roles.flatMap((r) => r.permissions));
  const allow = overrides.filter((o) => o.effect === "allow").map((o) => o.code);
  const deny = new Set(overrides.filter((o) => o.effect === "deny").map((o) => o.code));

  const effective = new Set<string>();
  for (const p of roleSet) effective.add(p);
  for (const p of allow) effective.add(p);
  for (const p of Array.from(effective)) {
    if (deny.has(p)) effective.delete(p);
  }

  return Array.from(effective).sort();
}

export async function GET() {
  try {
    await requirePermission("MANAGE_PERMISSIONS");

    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
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

    return NextResponse.json({
      users: users.map((u: any) => {
        const roles = u.userRoles.map((ur: any) => ({
          code: ur.role.code as string,
          permissions: ur.role.rolePermissions.map((rp: any) => rp.permission.code as string),
        }));

        const overrides = u.permissionOverrides.map((o: any) => ({
          code: o.permission.code as string,
          effect: o.effect as string,
        }));

        return {
          code: u.code,
          name: u.name,
          email: u.email,
          department: u.department,
          roles: roles.map((r: any) => r.code as string),
          overrides,
          effectivePermissions: computeEffective(roles, overrides),
        };
      }),
    });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
