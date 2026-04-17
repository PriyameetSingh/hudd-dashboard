import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server-auth";
import { getDbUserBySession, getEffectivePermissionCodesFromUser, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ user: null, permissions: [] });
    }

    const dbUser = await getDbUserBySession();
    const permissions = Array.from(getEffectivePermissionCodesFromUser(dbUser));

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
