import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

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

  const targets = await prisma.kpiTarget.findMany({
    include: {
      financialYear: { select: { label: true } },
      kpiDefinition: { select: { id: true, description: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    targets: targets.map((target: (typeof targets)[number]) => ({
      id: target.id,
      kpiDefinitionId: target.kpiDefinitionId,
      kpiDescription: target.kpiDefinition.description,
      financialYearLabel: target.financialYear.label,
      denominatorValue: toNumber(target.denominatorValue),
    })),
  });
}
