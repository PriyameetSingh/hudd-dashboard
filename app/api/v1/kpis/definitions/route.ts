import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    submissions: definitions.map((definition: (typeof definitions)[number]) => {
      const target = definition.targets[0] ?? null;
      const measurement = target?.measurements[0] ?? null;

      return {
        id: definition.id,
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
