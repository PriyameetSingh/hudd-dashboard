import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { getDbUserBySession, requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const { id } = await ctx.params;
    const meeting = await prisma.dashboardMeeting.findUnique({
      where: { id },
      include: {
        topics: { orderBy: { createdAt: "asc" } },
        actionItems: {
          select: { id: true, title: true, status: true, dueDate: true },
        },
        createdBy: { select: { name: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ detail: "Meeting not found" }, { status: 404 });
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        meetingDate: meeting.meetingDate.toISOString().slice(0, 10),
        title: meeting.title,
        notes: meeting.notes,
        createdByName: meeting.createdBy?.name ?? null,
        topics: meeting.topics.map((t) => ({ id: t.id, topic: t.topic })),
        actionItems: meeting.actionItems,
      },
    });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

type PatchBody = {
  meetingDate?: string;
  title?: string | null;
  notes?: string | null;
};

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("CREATE_ACTION_ITEMS", "MANAGE_SCHEMES");

    const { id } = await ctx.params;
    const body = (await request.json()) as PatchBody;
    const actor = await getDbUserBySession();
    const auditContext = getAuditRequestContext(request);

    const before = await prisma.dashboardMeeting.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ detail: "Meeting not found" }, { status: 404 });
    }

    const meeting = await prisma.dashboardMeeting.update({
      where: { id },
      data: {
        meetingDate: body.meetingDate ? new Date(`${body.meetingDate}T00:00:00.000Z`) : undefined,
        title: body.title,
        notes: body.notes,
      },
    });

    await logAudit(
      actor?.id,
      "meeting.update",
      "dashboard_meeting",
      id,
      { title: before.title, notes: before.notes },
      { title: meeting.title, notes: meeting.notes },
      { ...auditContext, meetingId: id },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("MANAGE_SCHEMES");

    const { id } = await ctx.params;
    const actor = await getDbUserBySession();
    const auditContext = getAuditRequestContext(request);

    const before = await prisma.dashboardMeeting.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ detail: "Meeting not found" }, { status: 404 });
    }

    await prisma.dashboardMeeting.delete({ where: { id } });

    await logAudit(actor?.id, "meeting.delete", "dashboard_meeting", id, { id }, null, { ...auditContext, meetingId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
