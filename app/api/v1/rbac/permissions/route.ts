import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("MANAGE_PERMISSIONS");

    const permissions = await prisma.permission.findMany({
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({ permissions });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
