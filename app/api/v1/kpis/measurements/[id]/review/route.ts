import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { assertKpiReviewerForDefinition, userRoleIdsFromDbUser } from "@/lib/kpi-access";
import { getDbUserBySession, hasPermission, requirePermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  decision: "approve" | "reject";
  note?: string;
};

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("APPROVE_KPI");

    const { id } = await ctx.params;
    const body = (await request.json()) as Body;

    if (body.decision === "reject" && !body.note?.trim()) {
      return NextResponse.json({ detail: "Rejection requires a note" }, { status: 400 });
    }

    const measurement = await prisma.kpiMeasurement.findUnique({
      where: { id },
      include: {
        kpiTarget: {
          include: {
            kpiDefinition: true,
          },
        },
      },
    });

    if (!measurement) {
      return NextResponse.json({ detail: "Measurement not found" }, { status: 404 });
    }

    const actor = await getDbUserBySession();
    if (!actor) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const def = measurement.kpiTarget.kpiDefinition;
    const roleIds = userRoleIdsFromDbUser(actor);
    const canManageSchemes = await hasPermission("MANAGE_SCHEMES");
    await assertKpiReviewerForDefinition(
      { schemeId: def.schemeId, reviewerId: def.reviewerId },
      actor.id,
      roleIds,
      { canManageSchemes },
    );

    const auditContext = getAuditRequestContext(request);
    const before = {
      workflowStatus: measurement.workflowStatus,
      reviewedById: measurement.reviewedById,
    };

    const now = new Date();
    const nextStatus = body.decision === "approve" ? "reviewed" : "rejected";

    await prisma.kpiMeasurement.update({
      where: { id },
      data: {
        workflowStatus: nextStatus,
        reviewedById: actor.id,
        reviewedAt: now,
        reviewNote: body.note ?? null,
      },
    });

    await logAudit(
      actor.id,
      "kpi.measurement.review",
      "kpi_measurement",
      id,
      before,
      { workflowStatus: nextStatus, note: body.note ?? null },
      {
        ...auditContext,
        schemeId: def.schemeId,
        kpiDefinitionId: measurement.kpiTarget.kpiDefinitionId,
        decision: body.decision,
      },
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
