import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  permissionCode: string;
  granted: boolean;
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ roleCode: string }> }) {
  try {
    await requirePermission("MANAGE_PERMISSIONS");

    const { roleCode } = await ctx.params;
    const body = (await request.json()) as Body;

    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) return NextResponse.json({ detail: "Role not found" }, { status: 404 });

    const perm = await prisma.permission.findUnique({ where: { code: body.permissionCode } });
    if (!perm) return NextResponse.json({ detail: "Permission not found" }, { status: 404 });

    if (body.granted) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    } else {
      await prisma.rolePermission
        .delete({ where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } } })
        .catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
