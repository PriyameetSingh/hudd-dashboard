import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { assertKpiUpdaterForScheme, userRoleIdsFromDbUser } from "@/lib/kpi-access";
import { getDbUserBySession, hasPermission, requirePermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  denominatorValue: number;
};

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("ENTER_KPI_DATA");

    const { id } = await ctx.params;
    const body = (await request.json()) as Body;

    const target = await prisma.kpiTarget.findUnique({
      where: { id },
      include: { kpiDefinition: true },
    });

    if (!target) {
      return NextResponse.json({ detail: "KPI target not found" }, { status: 404 });
    }

    const actor = await getDbUserBySession();
    if (!actor) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const roleIds = userRoleIdsFromDbUser(actor);
    await assertKpiUpdaterForScheme(target.kpiDefinition.schemeId, actor.id, roleIds);

    const canOverride = await hasPermission("MANAGE_SCHEMES");
    if (target.denominatorValue != null && !canOverride) {
      return NextResponse.json({ detail: "Denominator already set" }, { status: 409 });
    }

    const auditContext = getAuditRequestContext(request);
    const before = { denominatorValue: target.denominatorValue?.toString() ?? null };

    const updated = await prisma.kpiTarget.update({
      where: { id },
      data: { denominatorValue: body.denominatorValue },
    });

    await logAudit(
      actor.id,
      "kpi.target.denominator",
      "kpi_target",
      id,
      before,
      { denominatorValue: updated.denominatorValue?.toString() ?? null },
      { ...auditContext, kpiDefinitionId: target.kpiDefinitionId, schemeId: target.kpiDefinition.schemeId, override: canOverride },
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
