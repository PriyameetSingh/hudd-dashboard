import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/server-auth";
import { getEffectivePermissionCodesFromUserId, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ user: null, permissions: [] });
    }

    const dbUser = await prisma.user.findFirst({
      where: { code: sessionUser.id },
      select: { id: true, name: true, email: true },
    });

    const permissions = dbUser ? Array.from(await getEffectivePermissionCodesFromUserId(dbUser.id)) : [];

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
  } catch (error) {
    const mapped = toAuthErrorResponse(error);
    if (mapped) {
      return NextResponse.json({ detail: mapped.detail }, { status: mapped.status });
    }
    throw error;
  }
}
