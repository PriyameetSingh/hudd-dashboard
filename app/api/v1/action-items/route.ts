import { NextRequest, NextResponse } from "next/server";
import { ActionItemPriority, ActionItemStatus, ActionItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { requireAnyPermission, requireAnyPermissionAndDbUser, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapActionItem(item: {
  id: string;
  title: string;
  description: string;
  vertical: { name: string } | null;
  priority: ActionItemPriority;
  dueDate: Date;
  status: ActionItemStatus;
  assignedTo: { name: string; code: string | null } | null;
  reviewer: { name: string; code: string | null } | null;
  scheme: { code: string } | null;
  updates: Array<{
    id: string;
    timestamp: Date;
    status: ActionItemStatus;
    note: string;
    createdBy: { name: string } | null;
  }>;
  proofs: Array<{ file: { name: string; url: string } }>;
}) {
  const now = Date.now();
  const dueTime = item.dueDate.getTime();
  const overdueDays = dueTime < now ? Math.floor((now - dueTime) / (24 * 60 * 60 * 1000)) : undefined;

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    vertical: item.vertical?.name ?? "",
    priority: item.priority,
    dueDate: toIsoDate(item.dueDate),
    status: item.status,
    assignedTo: item.assignedTo?.name ?? "",
    reviewer: item.reviewer?.name ?? "",
    assignedToUserCode: item.assignedTo?.code ?? null,
    reviewerUserCode: item.reviewer?.code ?? null,
    schemeId: item.scheme?.code ?? "",
    daysOverdue: overdueDays,
    updates: item.updates.map((update) => ({
      id: update.id,
      timestamp: toIsoDate(update.timestamp),
      actor: update.createdBy?.name ?? "",
      status: update.status,
      note: update.note,
    })),
    proofFiles: item.proofs.map((proof) => ({
      name: proof.file.name,
      link: proof.file.url,
    })),
  };
}

export async function GET() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const items = await prisma.actionItem.findMany({
      include: {
        scheme: { select: { code: true } },
        vertical: { select: { name: true } },
        assignedTo: { select: { name: true, code: true } },
        reviewer: { select: { name: true, code: true } },
        updates: {
          orderBy: { timestamp: "asc" },
          include: {
            createdBy: { select: { name: true } },
          },
        },
        proofs: {
          include: {
            file: { select: { name: true, url: true } },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    });

    return NextResponse.json({
      items: items.map(mapActionItem),
    });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

type CreateBody = {
  meetingId?: string | null;
  schemeCode?: string | null;
  subschemeCode?: string | null;
  title: string;
  description: string;
  priority: ActionItemPriority;
  dueDate: string;
  assignedToUserCode: string;
  reviewerUserCode: string;
  itemType?: ActionItemType;
};

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAnyPermissionAndDbUser("CREATE_ACTION_ITEMS");

    const body = (await request.json()) as CreateBody;
    const auditContext = getAuditRequestContext(request);

    let scheme = null;
    if (body.schemeCode) {
      scheme = await prisma.scheme.findUnique({
        where: { code: body.schemeCode },
        include: { vertical: true, subschemes: true },
      });
      if (!scheme) {
        return NextResponse.json({ detail: "Scheme not found" }, { status: 404 });
      }
    }

    let subschemeId: string | null = null;
    if (body.subschemeCode?.trim()) {
      if (!scheme) {
        return NextResponse.json({ detail: "Cannot specify a subscheme without a scheme" }, { status: 400 });
      }
      const code = body.subschemeCode.trim();
      const sub = scheme.subschemes.find((s) => s.code.toUpperCase() === code.toUpperCase());
      if (!sub) {
        return NextResponse.json({ detail: "Subscheme not found" }, { status: 404 });
      }
      subschemeId = sub.id;
    }

    let meeting = null;
    if (body.meetingId) {
      meeting = await prisma.dashboardMeeting.findUnique({ where: { id: body.meetingId } });
      if (!meeting) {
        return NextResponse.json({ detail: "Meeting not found" }, { status: 404 });
      }
    }

    const assignedTo = await prisma.user.findFirst({ where: { code: body.assignedToUserCode } });
    const reviewer = await prisma.user.findFirst({ where: { code: body.reviewerUserCode } });
    if (!assignedTo || !reviewer) {
      return NextResponse.json({ detail: "Assignee or reviewer user not found" }, { status: 400 });
    }

    const dueDate = new Date(`${body.dueDate}T00:00:00.000Z`);

    const created = await prisma.actionItem.create({
      data: {
        meetingId: body.meetingId ?? null,
        schemeId: scheme?.id ?? null,
        subschemeId,
        verticalId: scheme?.verticalId ?? null,
        itemType: body.itemType ?? ActionItemType.action_item,
        title: body.title.trim(),
        description: body.description.trim(),
        priority: body.priority,
        dueDate,
        status: ActionItemStatus.OPEN,
        assignedToId: assignedTo.id,
        reviewerId: reviewer.id,
        createdById: actor?.id ?? null,
      },
    });

    await prisma.actionItemUpdate.create({
      data: {
        actionItemId: created.id,
        timestamp: new Date(),
        status: ActionItemStatus.OPEN,
        note: "Action item created",
        createdById: actor?.id ?? null,
      },
    });

    await logAudit(
      actor?.id,
      "action_item.create",
      "action_item",
      created.id,
      null,
      { id: created.id, title: created.title, schemeId: scheme?.id ?? null, meetingId: body.meetingId ?? null },
      { ...auditContext, meetingId: body.meetingId ?? null, schemeId: scheme?.id ?? null },
    );

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
