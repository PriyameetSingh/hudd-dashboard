import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { requireAnyPermission, requireAnyPermissionAndDbUser, toAuthErrorResponse } from "@/lib/server-rbac";
import { assertAllowedMeetingMaterial, sanitizeMeetingFileName } from "@/lib/meeting-materials";
import { saveFile } from "@/lib/local-file-storage";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const { id: meetingId } = await ctx.params;
    const meeting = await prisma.dashboardMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true },
    });
    if (!meeting) {
      return NextResponse.json({ detail: "Meeting not found" }, { status: 404 });
    }

    const materials = await prisma.meetingMaterial.findMany({
      where: { meetingId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
    });

    return NextResponse.json({ materials });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAnyPermissionAndDbUser("CREATE_ACTION_ITEMS", "MANAGE_SCHEMES");

    const { id: meetingId } = await ctx.params;
    const meeting = await prisma.dashboardMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true },
    });
    if (!meeting) {
      return NextResponse.json({ detail: "Meeting not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ detail: "Expected multipart field \"file\" with a non-empty file." }, { status: 400 });
    }

    try {
      assertAllowedMeetingMaterial(file);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid file";
      return NextResponse.json({ detail: msg }, { status: 400 });
    }

    const safeName = sanitizeMeetingFileName(file.name);
    const objectKey = `${meetingId}/${randomUUID()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await saveFile(buffer, objectKey);
    } catch (uploadError) {
      const msg = uploadError instanceof Error ? uploadError.message : "Upload failed";
      return NextResponse.json({ detail: msg }, { status: 502 });
    }

    const auditContext = getAuditRequestContext(request);

    const sortOrder = await prisma.meetingMaterial.count({ where: { meetingId } });

    const created = await prisma.meetingMaterial.create({
      data: {
        meetingId,
        storagePath: objectKey,
        fileName: safeName,
        mimeType: file.type || null,
        sizeBytes: file.size,
        sortOrder,
        uploadedById: actor?.id ?? null,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
    });

    await logAudit(
      actor?.id,
      "meeting.material.upload",
      "meeting_material",
      created.id,
      null,
      { id: created.id, fileName: created.fileName },
      { ...auditContext, meetingId },
    );

    return NextResponse.json({ material: created }, { status: 201 });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
