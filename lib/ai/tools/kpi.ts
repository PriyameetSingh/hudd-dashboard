import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { KPIProgressStatus } from "@prisma/client";
import { ToolDefinition, BaseToolParams } from "./types";
import { buildConversationContext, getSchemeAccessFilter, hasAnyPermission, PERMISSIONS } from "./rbac";

// ============== SCHEMAS ==============

const GetKpiPerformanceSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  kpiId: z.string().uuid().optional(),
  financialYearId: z.string().uuid().optional(),
  category: z.enum(["STATE", "CENTRAL"]).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const GetDelayedKpisSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  financialYearId: z.string().uuid().optional(),
  includeOverdue: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(20),
});

const GetKpiTrendsSchema = BaseToolParams.extend({
  kpiId: z.string().uuid(),
  months: z.number().int().min(3).max(24).default(12),
});

const GetKpisAwaitingApprovalSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  assignedToMe: z.boolean().default(false),
  limit: z.number().int().min(1).max(50).default(20),
});

// ============== TYPES ==============

type KpiPerformance = {
  kpiId: string;
  kpiDescription: string;
  schemeName: string;
  subschemeName?: string;
  category: string;
  kpiType: string;
  financialYearLabel: string;
  targetValue?: number;
  latestNumerator?: number;
  latestProgressStatus: string;
  latestWorkflowStatus: string;
  lastMeasuredAt?: string;
  assignedToName?: string;
};

type DelayedKpi = KpiPerformance & {
  daysSinceMeasurement: number;
  isOverdue: boolean;
};

type KpiTrendPoint = {
  measuredAt: string;
  numeratorValue?: number;
  progressStatus: string;
  workflowStatus: string;
};

// ============== HELPERS ==============

/**
 * Calculate KPI completion percentage
 */
function calculateKpiCompletion(numerator?: number | null, target?: number | null): number | undefined {
  if (numerator == null || target == null || target === 0) return undefined;
  return (numerator / target) * 100;
}

/**
 * Classify KPI progress for reporting
 */
function classifyKpiProgress(status: KPIProgressStatus): {
  label: string;
  severity: "success" | "warning" | "danger";
} {
  switch (status) {
    case "on_track":
      return { label: "On Track", severity: "success" };
    case "delayed":
      return { label: "Delayed", severity: "warning" };
    case "overdue":
      return { label: "Overdue", severity: "danger" };
    default:
      return { label: "Unknown", severity: "warning" };
  }
}

// ============== TOOLS ==============

/**
 * Get KPI performance data with latest measurements
 */
const getKpiPerformance: ToolDefinition<typeof GetKpiPerformanceSchema, { kpis: KpiPerformance[] }> = {
  name: "getKpiPerformance",
  description:
    "Get KPI performance data including targets, latest measurements, and progress status. " +
    "Can filter by scheme, financial year, or category (STATE/CENTRAL).",
  parameters: GetKpiPerformanceSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_KPI_DATA)) {
      throw new Error("Insufficient permissions to view KPI data");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const where = {
      ...schemeFilter,
      ...(params.schemeId && { schemeId: params.schemeId }),
      ...(params.kpiId && { id: params.kpiId }),
      ...(params.category && { category: params.category }),
    };

    const kpiDefinitions = await prisma.kpiDefinition.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
        assignedTo: true,
        targets: {
          ...(params.financialYearId
            ? { where: { financialYearId: params.financialYearId } }
            : { take: 1, orderBy: { createdAt: "desc" } }),
          include: {
            financialYear: true,
            measurements: {
              take: 1,
              orderBy: { measuredAt: "desc" },
            },
          },
        },
      },
      take: params.limit,
    });

    const kpis: KpiPerformance[] = kpiDefinitions.flatMap((kpi) =>
      kpi.targets.map((target) => {
        const latestMeasurement = target.measurements[0];
        return {
          kpiId: kpi.id,
          kpiDescription: kpi.description,
          schemeName: kpi.scheme.name,
          subschemeName: kpi.subscheme?.name,
          category: kpi.category,
          kpiType: kpi.kpiType,
          financialYearLabel: target.financialYear.label,
          targetValue: target.denominatorValue ? Number(target.denominatorValue) : undefined,
          latestNumerator: latestMeasurement?.numeratorValue
            ? Number(latestMeasurement.numeratorValue)
            : undefined,
          latestProgressStatus: latestMeasurement?.progressStatus ?? "No data",
          latestWorkflowStatus: latestMeasurement?.workflowStatus ?? "No submission",
          lastMeasuredAt: latestMeasurement?.measuredAt.toISOString(),
          assignedToName: kpi.assignedTo?.name,
        };
      })
    );

    return { kpis };
  },
};

/**
 * Get delayed and overdue KPIs
 */
const getDelayedKpis: ToolDefinition<typeof GetDelayedKpisSchema, { delayedKpis: DelayedKpi[]; totalCount: number }> = {
  name: "getDelayedKpis",
  description:
    "Get KPIs that are delayed or overdue. " +
    "Returns KPIs with progress status 'delayed' or 'overdue', optionally filtered by scheme.",
  parameters: GetDelayedKpisSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_KPI_DATA)) {
      throw new Error("Insufficient permissions to view KPI data");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const where = {
      ...schemeFilter,
      ...(params.schemeId && { schemeId: params.schemeId }),
    };

    // Find KPI definitions with delayed/overdue measurements
    const kpiDefinitions = await prisma.kpiDefinition.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
        assignedTo: true,
        targets: {
          ...(params.financialYearId
            ? { where: { financialYearId: params.financialYearId } }
            : { take: 1, orderBy: { createdAt: "desc" } }),
          include: {
            financialYear: true,
            measurements: {
              where: {
                progressStatus: {
                  in: params.includeOverdue
                    ? ["delayed", "overdue"]
                    : ["delayed"],
                },
              },
              take: 1,
              orderBy: { measuredAt: "desc" },
            },
          },
        },
      },
    });

    // Filter to only those with delayed/overdue measurements
    const withDelayedMeasurements = kpiDefinitions.filter((kpi) =>
      kpi.targets.some((t) => t.measurements.length > 0)
    );

    const now = new Date();
    const delayedKpis: DelayedKpi[] = withDelayedMeasurements.flatMap((kpi) =>
      kpi.targets
        .filter((t) => t.measurements.length > 0)
        .map((target) => {
          const m = target.measurements[0];
          const daysSinceMeasurement = Math.floor(
            (now.getTime() - m.measuredAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            kpiId: kpi.id,
            kpiDescription: kpi.description,
            schemeName: kpi.scheme.name,
            subschemeName: kpi.subscheme?.name,
            category: kpi.category,
            kpiType: kpi.kpiType,
            financialYearLabel: target.financialYear.label,
            targetValue: target.denominatorValue ? Number(target.denominatorValue) : undefined,
            latestNumerator: m.numeratorValue ? Number(m.numeratorValue) : undefined,
            latestProgressStatus: m.progressStatus,
            latestWorkflowStatus: m.workflowStatus,
            lastMeasuredAt: m.measuredAt.toISOString(),
            assignedToName: kpi.assignedTo?.name,
            daysSinceMeasurement,
            isOverdue: m.progressStatus === "overdue",
          };
        })
    );

    // Sort by severity (overdue first, then by days since measurement)
    const sorted = delayedKpis.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return b.daysSinceMeasurement - a.daysSinceMeasurement;
    });

    return {
      delayedKpis: sorted.slice(0, params.limit),
      totalCount: sorted.length,
    };
  },
};

/**
 * Get trend data for a specific KPI over time
 */
const getKpiTrends: ToolDefinition<typeof GetKpiTrendsSchema, { trends: KpiTrendPoint[]; kpiDescription: string }> = {
  name: "getKpiTrends",
  description:
    "Get historical trend data for a specific KPI over the last N months. " +
    "Returns measurement history with values and status changes.",
  parameters: GetKpiTrendsSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_KPI_DATA)) {
      throw new Error("Insufficient permissions to view KPI data");
    }

    // Get KPI definition
    const kpi = await prisma.kpiDefinition.findUnique({
      where: { id: params.kpiId },
      include: { scheme: true },
    });

    if (!kpi) {
      throw new Error("KPI not found");
    }

    // Verify access
    if (!ctx.permissions.has(PERMISSIONS.VIEW_ALL_DATA) && !ctx.accessibleSchemeIds.includes(kpi.schemeId)) {
      throw new Error("Access denied to this KPI");
    }

    // Get measurements from last N months
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - params.months);

    const measurements = await prisma.kpiMeasurement.findMany({
      where: {
        kpiTarget: { kpiDefinitionId: params.kpiId },
        measuredAt: { gte: cutoffDate },
      },
      orderBy: { measuredAt: "asc" },
    });

    const trends: KpiTrendPoint[] = measurements.map((m) => ({
      measuredAt: m.measuredAt.toISOString(),
      numeratorValue: m.numeratorValue ? Number(m.numeratorValue) : undefined,
      progressStatus: m.progressStatus,
      workflowStatus: m.workflowStatus,
    }));

    return {
      trends,
      kpiDescription: kpi.description,
    };
  },
};

/**
 * Get KPIs awaiting approval/review
 */
const getKpisAwaitingApproval: ToolDefinition<
  typeof GetKpisAwaitingApprovalSchema,
  { awaitingReview: KpiPerformance[]; awaitingSubmission: KpiPerformance[] }
> = {
  name: "getKpisAwaitingApproval",
  description:
    "Get KPIs that are pending review/approval or awaiting submission. " +
    "Can filter by scheme or show only those assigned to the current user.",
  parameters: GetKpisAwaitingApprovalSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_KPI_DATA)) {
      throw new Error("Insufficient permissions to view KPI data");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const where = {
      ...schemeFilter,
      ...(params.schemeId && { schemeId: params.schemeId }),
      ...(params.assignedToMe && { assignedToId: ctx.userId }),
    };

    const kpiDefinitions = await prisma.kpiDefinition.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
        assignedTo: true,
        reviewer: true,
        targets: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            financialYear: true,
            measurements: {
              take: 1,
              orderBy: { measuredAt: "desc" },
            },
          },
        },
      },
      take: params.limit,
    });

    const awaitingReview: KpiPerformance[] = [];
    const awaitingSubmission: KpiPerformance[] = [];

    for (const kpi of kpiDefinitions) {
      for (const target of kpi.targets) {
        const latestMeasurement = target.measurements[0];
        const baseData: KpiPerformance = {
          kpiId: kpi.id,
          kpiDescription: kpi.description,
          schemeName: kpi.scheme.name,
          subschemeName: kpi.subscheme?.name,
          category: kpi.category,
          kpiType: kpi.kpiType,
          financialYearLabel: target.financialYear.label,
          targetValue: target.denominatorValue ? Number(target.denominatorValue) : undefined,
          latestNumerator: latestMeasurement?.numeratorValue
            ? Number(latestMeasurement.numeratorValue)
            : undefined,
          latestProgressStatus: latestMeasurement?.progressStatus ?? "No data",
          latestWorkflowStatus: latestMeasurement?.workflowStatus ?? "No submission",
          lastMeasuredAt: latestMeasurement?.measuredAt.toISOString(),
          assignedToName: kpi.assignedTo?.name,
        };

        if (latestMeasurement?.workflowStatus === "submitted" || latestMeasurement?.workflowStatus === "rejected") {
          awaitingReview.push(baseData);
        } else if (!latestMeasurement || latestMeasurement.workflowStatus === "draft") {
          awaitingSubmission.push(baseData);
        }
      }
    }

    return {
      awaitingReview: awaitingReview.slice(0, params.limit),
      awaitingSubmission: awaitingSubmission.slice(0, params.limit),
    };
  },
};

// ============== EXPORT ==============

export const kpiTools = [getKpiPerformance, getDelayedKpis, getKpiTrends, getKpisAwaitingApproval];
