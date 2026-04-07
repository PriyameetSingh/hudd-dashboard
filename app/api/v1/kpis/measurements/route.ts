import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDbUserBySession } from "@/lib/server-rbac";

export const runtime = "nodejs";

type Body = {
  kpiDefinitionId: string;
  financialYearLabel: string;
  measuredAt: string;
  numeratorValue?: number | null;
  yesValue?: boolean | null;
  denominatorValue?: number | null;
  remarks?: string;
  workflowStatus?: "draft" | "submitted";
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;

  const definition = await prisma.kpiDefinition.findUnique({ where: { id: body.kpiDefinitionId } });
  if (!definition) {
    return NextResponse.json({ detail: "KPI definition not found" }, { status: 404 });
  }

  const fy = await prisma.financialYear.findUnique({ where: { label: body.financialYearLabel } });
  if (!fy) {
    return NextResponse.json({ detail: "Financial year not found" }, { status: 404 });
  }

  const target = await prisma.kpiTarget.upsert({
    where: {
      kpiDefinitionId_financialYearId: {
        kpiDefinitionId: definition.id,
        financialYearId: fy.id,
      },
    },
    update: {
      denominatorValue: body.denominatorValue ?? undefined,
    },
    create: {
      kpiDefinitionId: definition.id,
      financialYearId: fy.id,
      denominatorValue: body.denominatorValue ?? undefined,
    },
  });

  const measuredAt = new Date(`${body.measuredAt}T00:00:00.000Z`);
  const actor = await getDbUserBySession();

  const existing = await prisma.kpiMeasurement.findFirst({
    where: {
      kpiTargetId: target.id,
      measuredAt,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.kpiMeasurement.update({
      where: { id: existing.id },
      data: {
        numeratorValue: body.numeratorValue ?? null,
        yesValue: body.yesValue ?? null,
        workflowStatus: body.workflowStatus ?? "submitted",
        progressStatus: "on_track",
        remarks: body.remarks,
        createdById: actor?.id ?? null,
      },
    });
  } else {
    await prisma.kpiMeasurement.create({
      data: {
        kpiTargetId: target.id,
        measuredAt,
        numeratorValue: body.numeratorValue ?? null,
        yesValue: body.yesValue ?? null,
        workflowStatus: body.workflowStatus ?? "submitted",
        progressStatus: "on_track",
        remarks: body.remarks,
        createdById: actor?.id ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
