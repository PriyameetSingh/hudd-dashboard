import { NextRequest, NextResponse } from "next/server";
import { KPICategory, KPIType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { getDbUserBySession, requireAnyPermission, requirePermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return null;
}

function mapWorkflowStatus(workflowStatus?: string | null): "not_submitted" | "draft" | "submitted" | "submitted_pending" | "approved" {
  if (!workflowStatus) return "not_submitted";
  if (workflowStatus === "reviewed") return "approved";
  if (workflowStatus === "submitted") return "submitted_pending";
  if (workflowStatus === "draft") return "draft";
  if (workflowStatus === "rejected") return "draft";
  return "submitted";
}

export async function GET() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }

  const fy = await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });

  const definitions = await prisma.kpiDefinition.findMany({
    include: {
      scheme: { include: { vertical: true } },
      targets: fy
        ? {
            where: { financialYearId: fy.id },
            include: {
              measurements: {
                orderBy: { measuredAt: "desc" },
                take: 1,
              },
            },
            take: 1,
          }
        : {
            include: {
              measurements: {
                orderBy: { measuredAt: "desc" },
                take: 1,
              },
            },
            take: 1,
          },
    },
    orderBy: [{ scheme: { name: "asc" } }, { description: "asc" }],
  });

  return NextResponse.json({
    financialYearLabel: fy?.label ?? null,
    submissions: definitions.map((definition: (typeof definitions)[number]) => {
      const target = definition.targets[0] ?? null;
      const measurement = target?.measurements[0] ?? null;

      return {
        id: definition.id,
        kpiTargetId: target?.id ?? null,
        latestMeasurementId: measurement?.id ?? null,
        scheme: definition.scheme.name,
        vertical: definition.scheme.vertical.name,
        category: definition.category,
        description: definition.description,
        type: definition.kpiType,
        unit: definition.numeratorUnit ?? definition.denominatorUnit ?? "value",
        numerator: toNumber(measurement?.numeratorValue),
        denominator: toNumber(target?.denominatorValue),
        yes: measurement?.yesValue ?? null,
        status: mapWorkflowStatus(measurement?.workflowStatus),
        lastUpdated: (measurement?.measuredAt ?? definition.updatedAt).toISOString().slice(0, 10),
        remarks: measurement?.remarks ?? undefined,
      };
    }),
  });
}

function parseCategory(value: unknown): KPICategory | null {
  if (value === "STATE" || value === "CENTRAL") return value;
  return null;
}

function parseKpiType(value: unknown): KPIType | null {
  if (value === "OUTPUT" || value === "OUTCOME" || value === "BINARY") return value;
  return null;
}

type CreateBody = {
  schemeId?: string;
  subschemeId?: string | null;
  category?: string;
  description?: string;
  kpiType?: string;
  numeratorUnit?: string | null;
  denominatorUnit?: string | null;
  denominatorValue?: number | null;
};

export async function POST(request: NextRequest) {
  try {
    await requirePermission("MANAGE_SCHEMES");
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }

  const body = (await request.json()) as CreateBody;
  const schemeId = body.schemeId?.trim();
  const description = body.description?.trim();
  const category = parseCategory(body.category);
  const kpiType = parseKpiType(body.kpiType);

  if (!schemeId || !description || !category || !kpiType) {
    return NextResponse.json(
      { detail: "schemeId, description, category (STATE|CENTRAL), and kpiType (OUTPUT|OUTCOME|BINARY) are required" },
      { status: 400 },
    );
  }

  const scheme = await prisma.scheme.findUnique({
    where: { id: schemeId },
    select: { id: true, code: true },
  });
  if (!scheme) {
    return NextResponse.json({ detail: "Scheme not found" }, { status: 404 });
  }

  let subschemeId: string | null = body.subschemeId?.trim() || null;
  if (subschemeId) {
    const sub = await prisma.subscheme.findFirst({
      where: { id: subschemeId, schemeId },
      select: { id: true },
    });
    if (!sub) {
      return NextResponse.json({ detail: "Subscheme does not belong to this scheme" }, { status: 400 });
    }
  }

  const actor = await getDbUserBySession();
  const auditContext = getAuditRequestContext(request);

  const fy = await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });

  const created = await prisma.kpiDefinition.create({
    data: {
      schemeId,
      subschemeId,
      category,
      description,
      kpiType,
      numeratorUnit: body.numeratorUnit?.trim() || null,
      denominatorUnit: body.denominatorUnit?.trim() || null,
      createdById: actor?.id ?? null,
    },
  });

  const initialDenominator =
    body.denominatorValue !== null && body.denominatorValue !== undefined && !isNaN(Number(body.denominatorValue))
      ? Number(body.denominatorValue)
      : null;

  if (fy) {
    await prisma.kpiTarget.upsert({
      where: {
        kpiDefinitionId_financialYearId: {
          kpiDefinitionId: created.id,
          financialYearId: fy.id,
        },
      },
      create: {
        kpiDefinitionId: created.id,
        financialYearId: fy.id,
        denominatorValue: initialDenominator,
      },
      update: {},
    });
  }

  await logAudit(
    actor?.id,
    "kpi_definition.create",
    "kpi_definition",
    created.id,
    null,
    {
      id: created.id,
      schemeId: created.schemeId,
      description: created.description,
      kpiType: created.kpiType,
    },
    { ...auditContext, schemeId, schemeCode: scheme.code },
  );

  return NextResponse.json(
    {
      definition: {
        id: created.id,
        schemeId: created.schemeId,
        subschemeId: created.subschemeId,
        category: created.category,
        description: created.description,
        kpiType: created.kpiType,
        numeratorUnit: created.numeratorUnit,
        denominatorUnit: created.denominatorUnit,
      },
    },
    { status: 201 },
  );
}
