import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/server-auth";
import { getEffectivePermissionCodes } from "@/lib/server-rbac";

export const runtime = "nodejs";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ user: null, permissions: [] });
  }

  const dbUser = await prisma.user.findFirst({ where: { code: sessionUser.id } });
  const permissions = Array.from(await getEffectivePermissionCodes());

  return NextResponse.json({
    user: {
      code: sessionUser.id,
      dbId: dbUser?.id ?? null,
      name: dbUser?.name ?? sessionUser.name ?? null,
      email: dbUser?.email ?? sessionUser.email ?? null,
      role: sessionUser.role ?? null,
    },
    permissions,
  });
}
