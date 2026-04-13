import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { getDbUserBySession, requirePermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

type PatchBody = {
  assignedToId?: string | null;
  reviewerId?: string | null;
};

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("MANAGE_SCHEMES");
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }

  const { id } = await ctx.params;
  const body = (await request.json()) as PatchBody;

  const assignedToId = typeof body.assignedToId === "string" ? body.assignedToId.trim() : body.assignedToId ?? undefined;
  const reviewerId = typeof body.reviewerId === "string" ? body.reviewerId.trim() : body.reviewerId ?? undefined;

  if (assignedToId === undefined || reviewerId === undefined) {
    return NextResponse.json({ detail: "assignedToId and reviewerId are required" }, { status: 400 });
  }

  if (!assignedToId || !reviewerId) {
    return NextResponse.json(
      { detail: "Action owner and reviewer must both be set; use active user ids" },
      { status: 400 },
    );
  }

  if (assignedToId === reviewerId) {
    return NextResponse.json({ detail: "Action owner and reviewer must be different users" }, { status: 400 });
  }

  const existing = await prisma.kpiDefinition.findUnique({
    where: { id },
    select: {
      id: true,
      schemeId: true,
      assignedToId: true,
      reviewerId: true,
      description: true,
      scheme: { select: { code: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ detail: "KPI definition not found" }, { status: 404 });
  }

  const [assigneeUser, reviewerUser] = await Promise.all([
    prisma.user.findFirst({ where: { id: assignedToId, isActive: true }, select: { id: true, name: true } }),
    prisma.user.findFirst({ where: { id: reviewerId, isActive: true }, select: { id: true, name: true } }),
  ]);

  if (!assigneeUser || !reviewerUser) {
    return NextResponse.json({ detail: "Assignee or reviewer user not found or inactive" }, { status: 400 });
  }

  const actor = await getDbUserBySession();
  const auditContext = getAuditRequestContext(request);

  const before = {
    assignedToId: existing.assignedToId,
    reviewerId: existing.reviewerId,
  };

  const updated = await prisma.kpiDefinition.update({
    where: { id },
    data: { assignedToId, reviewerId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  await logAudit(
    actor?.id,
    "kpi_definition.assignments",
    "kpi_definition",
    id,
    before,
    { assignedToId, reviewerId },
    { ...auditContext, schemeId: existing.schemeId, schemeCode: existing.scheme.code },
  );

  return NextResponse.json({
    ok: true,
    assignedToUserId: updated.assignedTo?.id ?? null,
    assignedToName: updated.assignedTo?.name ?? null,
    reviewerUserId: updated.reviewer?.id ?? null,
    reviewerName: updated.reviewer?.name ?? null,
  });
}
