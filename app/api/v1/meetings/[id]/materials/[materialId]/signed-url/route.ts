import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";
import { getPublicUrlPath } from "@/lib/local-file-storage";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 3600;

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; materialId: string }> },
) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const { id: meetingId, materialId } = await ctx.params;

    const row = await prisma.meetingMaterial.findFirst({
      where: { id: materialId, meetingId },
      select: { storagePath: true, fileName: true, mimeType: true },
    });
    if (!row) {
      return NextResponse.json({ detail: "Material not found" }, { status: 404 });
    }

    const url = getPublicUrlPath(row.storagePath);

    return NextResponse.json({
      url,
      expiresIn: SIGNED_URL_TTL_SEC,
      fileName: row.fileName,
      mimeType: row.mimeType,
    });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
