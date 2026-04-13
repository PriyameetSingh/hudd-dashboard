import { NextRequest, NextResponse } from "next/server";
import { ActionItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { getDbUserBySession, hasPermission, requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  status?: ActionItemStatus;
  note?: string;
  reviewerDecision?: "approve" | "reject";
  rejectionReason?: string;
  assignedToUserCode?: string;
  reviewerUserCode?: string;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapActionItem(item: {
  id: string;
  title: string;
  description: string;
  vertical: { name: string } | null;
  priority: string;
  dueDate: Date;
  status: ActionItemStatus;
  assignedTo: { name: string; id: string; code: string | null } | null;
  reviewer: { name: string; id: string; code: string | null } | null;
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
    assignedToUserId: item.assignedTo?.id,
    reviewerUserId: item.reviewer?.id,
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

async function getActionItemById(id: string) {
  return prisma.actionItem.findUnique({
    where: { id },
    include: {
      scheme: { select: { code: true } },
      vertical: { select: { name: true } },
      assignedTo: { select: { name: true, id: true, code: true } },
      reviewer: { select: { name: true, id: true, code: true } },
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
  });
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const { id } = await ctx.params;
    const item = await getActionItemById(id);
    if (!item) {
      return NextResponse.json({ detail: "Action item not found" }, { status: 404 });
    }
    return NextResponse.json({ item: mapActionItem(item) });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as Body;

    const current = await prisma.actionItem.findUnique({
      where: { id },
      include: { assignedTo: true, reviewer: true },
    });
    if (!current) {
      return NextResponse.json({ detail: "Action item not found" }, { status: 404 });
    }

    const actor = await getDbUserBySession();
    if (!actor) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const auditContext = getAuditRequestContext(request);
    const beforeStatus = current.status;

    const isAssignee = current.assignedToId === actor.id;
    const isReviewer = current.reviewerId === actor.id;
    const canApprove = await hasPermission("APPROVE_ACTION_ITEMS");

    if (body.reviewerDecision === "approve" || body.reviewerDecision === "reject") {
      if (!isReviewer && !canApprove) {
        return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
      }
      if (body.reviewerDecision === "reject" && !body.rejectionReason?.trim()) {
        return NextResponse.json({ detail: "Rejection reason is required" }, { status: 400 });
      }
      const nextStatus = body.reviewerDecision === "approve" ? ActionItemStatus.COMPLETED : ActionItemStatus.IN_PROGRESS;
      await prisma.actionItem.update({
        where: { id },
        data: { status: nextStatus },
      });
      await prisma.actionItemUpdate.create({
        data: {
          actionItemId: id,
          timestamp: new Date(),
          status: nextStatus,
          note:
            body.reviewerDecision === "approve"
              ? "Reviewer approved completion"
              : `Reviewer rejected: ${body.rejectionReason}`,
          createdById: actor.id,
        },
      });
      await logAudit(
        actor.id,
        "action_item.review",
        "action_item",
        id,
        { status: beforeStatus },
        { status: nextStatus, decision: body.reviewerDecision },
        { ...auditContext, meetingId: current.meetingId, schemeId: current.schemeId },
      );
      const item = await getActionItemById(id);
      return NextResponse.json({ item: item ? mapActionItem(item) : null });
    }

    if (body.assignedToUserCode !== undefined || body.reviewerUserCode !== undefined) {
      const canReassign = await hasPermission("UPDATE_ACTION_ITEMS");
      if (!canReassign) {
        return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
      }
      const assignCode = body.assignedToUserCode?.trim();
      const reviewCode = body.reviewerUserCode?.trim();
      if (!assignCode || !reviewCode) {
        return NextResponse.json(
          { detail: "assignedToUserCode and reviewerUserCode are required" },
          { status: 400 },
        );
      }
      if (assignCode === reviewCode) {
        return NextResponse.json(
          { detail: "Assignee and reviewer must be different users" },
          { status: 400 },
        );
      }
      const assigneeUser = await prisma.user.findFirst({ where: { code: assignCode } });
      const reviewerUser = await prisma.user.findFirst({ where: { code: reviewCode } });
      if (!assigneeUser || !reviewerUser) {
        return NextResponse.json({ detail: "Assignee or reviewer user not found" }, { status: 400 });
      }
      const prevAssignName = current.assignedTo?.name ?? "—";
      const prevReviewName = current.reviewer?.name ?? "—";
      await prisma.actionItem.update({
        where: { id },
        data: { assignedToId: assigneeUser.id, reviewerId: reviewerUser.id },
      });
      await prisma.actionItemUpdate.create({
        data: {
          actionItemId: id,
          timestamp: new Date(),
          status: current.status,
          note: `Reassigned: assignee ${prevAssignName} → ${assigneeUser.name}; reviewer ${prevReviewName} → ${reviewerUser.name}`,
          createdById: actor.id,
        },
      });
      await logAudit(
        actor.id,
        "action_item.update",
        "action_item",
        id,
        { assignedToId: current.assignedToId, reviewerId: current.reviewerId },
        { assignedToId: assigneeUser.id, reviewerId: reviewerUser.id },
        { ...auditContext, meetingId: current.meetingId, schemeId: current.schemeId },
      );
      const item = await getActionItemById(id);
      return NextResponse.json({ item: item ? mapActionItem(item) : null });
    }

    if (body.status || (body.note && body.note.trim())) {
      const canUpdate = isAssignee || (await hasPermission("UPDATE_ACTION_ITEMS"));
      if (!canUpdate) {
        return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
      }
      if (body.status && body.status !== current.status) {
        await prisma.actionItem.update({
          where: { id },
          data: { status: body.status },
        });
      }
      if (body.note && body.note.trim().length > 0) {
        await prisma.actionItemUpdate.create({
          data: {
            actionItemId: id,
            timestamp: new Date(),
            status: body.status ?? current.status,
            note: body.note,
            createdById: actor.id,
          },
        });
      }
      await logAudit(
        actor.id,
        "action_item.update",
        "action_item",
        id,
        { status: beforeStatus },
        { status: body.status ?? current.status },
        { ...auditContext, meetingId: current.meetingId, schemeId: current.schemeId },
      );
    }

    const item = await getActionItemById(id);
    return NextResponse.json({ item: item ? mapActionItem(item) : null });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
