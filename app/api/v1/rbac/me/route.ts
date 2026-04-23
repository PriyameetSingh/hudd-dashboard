import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/server-auth";
import { getEffectivePermissionCodesFromUserId, toAuthErrorResponse } from "@/lib/server-rbac";
import { Permission, UserRole } from "@/types";

export const runtime = "nodejs";

const USER_ROLE_VALUES = new Set<string>(Object.values(UserRole));
const PERMISSION_VALUES = new Set<string>(Object.values(Permission));

function parseUserRole(code: string | null | undefined): UserRole {
  if (code && USER_ROLE_VALUES.has(code)) return code as UserRole;
  return UserRole.VIEWER;
}

function codesToPermissions(codes: Iterable<string>): Permission[] {
  const out: Permission[] = [];
  for (const code of codes) {
    if (PERMISSION_VALUES.has(code)) out.push(code as Permission);
  }
  return out;
}

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ user: null });
    }

    const dbUser = await prisma.user.findFirst({
      where: { code: sessionUser.id },
      include: {
        userRoles: {
          include: { role: { select: { code: true } } },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({
        user: {
          id: sessionUser.id,
          dbId: null as string | null,
          name: sessionUser.name ?? "",
          email: sessionUser.email ?? "",
          role: parseUserRole(sessionUser.role),
          department: "",
          assignedSchemes: [] as string[],
          permissions: [] as Permission[],
        },
      });
    }

    const [schemeRows, effectiveCodes] = await Promise.all([
      prisma.schemeAssignment.findMany({
        where: { userId: dbUser.id },
        select: { scheme: { select: { code: true } } },
      }),
      getEffectivePermissionCodesFromUserId(dbUser.id),
    ]);

    const assignedSchemes = [...new Set(schemeRows.map((r) => r.scheme.code))];

    const roleCodes = dbUser.userRoles.map((ur) => ur.role.code).sort();
    const primaryRole = parseUserRole(roleCodes[0] ?? sessionUser.role);

    const permissions = codesToPermissions(effectiveCodes);

    return NextResponse.json({
      user: {
        id: dbUser.code ?? sessionUser.id,
        dbId: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: primaryRole,
        department: dbUser.department ?? "",
        assignedSchemes,
        permissions,
      },
    });
  } catch (error) {
    const mapped = toAuthErrorResponse(error);
    if (mapped) {
      return NextResponse.json({ detail: mapped.detail }, { status: mapped.status });
    }
    throw error;
  }
}
