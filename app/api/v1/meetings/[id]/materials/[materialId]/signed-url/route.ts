import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";
import { createSupabaseAdmin, isSupabaseConfigured, MEETING_MATERIALS_BUCKET } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 3600;

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string; materialId: string }> },
) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { detail: "File storage is not configured (Supabase URL / service role key)." },
        { status: 503 },
      );
    }

    const { id: meetingId, materialId } = await ctx.params;

    const row = await prisma.meetingMaterial.findFirst({
      where: { id: materialId, meetingId },
      select: { storagePath: true, fileName: true, mimeType: true },
    });
    if (!row) {
      return NextResponse.json({ detail: "Material not found" }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(MEETING_MATERIALS_BUCKET)
      .createSignedUrl(row.storagePath, SIGNED_URL_TTL_SEC);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ detail: error?.message ?? "Could not create signed URL" }, { status: 502 });
    }

    return NextResponse.json({
      url: data.signedUrl,
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
