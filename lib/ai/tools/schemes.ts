import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ToolDefinition, BaseToolParams } from "./types";
import { buildConversationContext, getSchemeAccessFilter, hasAnyPermission, PERMISSIONS } from "./rbac";

// ============== SCHEMAS ==============

const GetSchemesSchema = BaseToolParams.extend({
  verticalId: z.string().uuid().optional(),
  sponsorshipType: z.enum(["STATE", "CENTRAL", "CENTRAL_SECTOR"]).optional(),
  searchQuery: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const GetSchemeDetailsSchema = BaseToolParams.extend({
  schemeId: z.string().uuid(),
  includeSubschemes: z.boolean().default(true),
  includeKpis: z.boolean().default(false),
  includeActionItems: z.boolean().default(false),
});

const GetSchemeAssignmentsSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  userIdFilter: z.string().uuid().optional(),
  assignmentKind: z
    .enum([
      "dashboard_owner",
      "kpi_owner_1",
      "kpi_owner_2",
      "action_item_owner_1",
      "action_item_owner_2",
    ])
    .optional(),
});

const GetSchemesNeedingAttentionSchema = BaseToolParams.extend({
  financialYearId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

// ============== TYPES ==============

type SchemeSummary = {
  id: string;
  code: string;
  name: string;
  verticalName: string;
  sponsorshipType: string;
  subschemeCount: number;
  assignmentCount: number;
  createdAt: string;
};

type SchemeDetail = SchemeSummary & {
  subschemes: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  assignments: Array<{
    id: string;
    assignmentKind: string;
    userName?: string;
    roleCode?: string;
    subschemeName?: string;
  }>;
  kpiCount?: number;
  actionItemCount?: number;
};

type SchemeAssignment = {
  id: string;
  schemeName: string;
  subschemeName?: string;
  assignmentKind: string;
  userName?: string;
  roleCode?: string;
  sortOrder: number;
};

type SchemeAttentionResult = {
  schemeId: string;
  schemeName: string;
  reasons: string[];
  severity: "high" | "medium" | "low";
  metrics: {
    overdueActionItems: number;
    delayedKpis: number;
    pendingKpiSubmissions: number;
    fundUtilization?: number;
  };
};

// ============== TOOLS ==============

/**
 * Get list of schemes with filtering
 */
const getSchemes: ToolDefinition<typeof GetSchemesSchema, { schemes: SchemeSummary[]; totalCount: number }> = {
  name: "getSchemes",
  description:
    "Get list of schemes with optional filtering by vertical, sponsorship type, or search query. " +
    "Returns scheme summaries with subscheme and assignment counts.",
  parameters: GetSchemesSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_SCHEMES)) {
      throw new Error("Insufficient permissions to view schemes");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);

    // Build where clause
    const whereConditions: any[] = [];
    if (Object.keys(schemeFilter).length > 0) {
      whereConditions.push({ id: { in: ctx.accessibleSchemeIds } });
    }
    if (params.verticalId) whereConditions.push({ verticalId: params.verticalId });
    if (params.sponsorshipType) whereConditions.push({ sponsorshipType: params.sponsorshipType });
    if (params.searchQuery) {
      whereConditions.push({
        OR: [
          { name: { contains: params.searchQuery, mode: "insensitive" } },
          { code: { contains: params.searchQuery, mode: "insensitive" } },
        ],
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const [schemes, totalCount] = await Promise.all([
      prisma.scheme.findMany({
        where,
        include: {
          vertical: true,
          subschemes: { select: { id: true } },
          assignments: { select: { id: true } },
        },
        orderBy: { name: "asc" },
        take: params.limit,
      }),
      prisma.scheme.count({ where }),
    ]);

    const summaries: SchemeSummary[] = schemes.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      verticalName: s.vertical.name,
      sponsorshipType: s.sponsorshipType,
      subschemeCount: s.subschemes.length,
      assignmentCount: s.assignments.length,
      createdAt: s.createdAt.toISOString(),
    }));

    return { schemes: summaries, totalCount };
  },
};

/**
 * Get detailed information about a specific scheme
 */
const getSchemeDetails: ToolDefinition<typeof GetSchemeDetailsSchema, { scheme: SchemeDetail }> = {
  name: "getSchemeDetails",
  description:
    "Get detailed information about a specific scheme including subschemes, assignments, " +
    "and optionally KPI and action item counts.",
  parameters: GetSchemeDetailsSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_SCHEMES)) {
      throw new Error("Insufficient permissions to view scheme details");
    }

    // Verify access
    if (!ctx.permissions.has(PERMISSIONS.VIEW_ALL_DATA) && !ctx.accessibleSchemeIds.includes(params.schemeId)) {
      throw new Error("Access denied to this scheme");
    }

    const scheme = await prisma.scheme.findUnique({
      where: { id: params.schemeId },
      include: {
        vertical: true,
        subschemes: params.includeSubschemes
          ? {
              select: { id: true, code: true, name: true },
              orderBy: { name: "asc" },
            }
          : false,
        assignments: {
          include: {
            user: { select: { name: true } },
            role: { select: { code: true } },
            subscheme: { select: { name: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
        kpiDefinitions: params.includeKpis ? { select: { id: true } } : false,
        actionItems: params.includeActionItems ? { select: { id: true } } : false,
      },
    });

    if (!scheme) {
      throw new Error("Scheme not found");
    }

    const detail: SchemeDetail = {
      id: scheme.id,
      code: scheme.code,
      name: scheme.name,
      verticalName: scheme.vertical.name,
      sponsorshipType: scheme.sponsorshipType,
      subschemeCount: scheme.subschemes?.length ?? 0,
      assignmentCount: scheme.assignments.length,
      createdAt: scheme.createdAt.toISOString(),
      subschemes:
        scheme.subschemes?.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
        })) ?? [],
      assignments: scheme.assignments.map((a) => ({
        id: a.id,
        assignmentKind: a.assignmentKind,
        userName: a.user?.name,
        roleCode: a.role?.code,
        subschemeName: a.subscheme?.name,
      })),
      ...(params.includeKpis && { kpiCount: scheme.kpiDefinitions?.length }),
      ...(params.includeActionItems && { actionItemCount: scheme.actionItems?.length }),
    };

    return { scheme: detail };
  },
};

/**
 * Get scheme assignments with filtering
 */
const getSchemeAssignments: ToolDefinition<typeof GetSchemeAssignmentsSchema, { assignments: SchemeAssignment[] }> = {
  name: "getSchemeAssignments",
  description:
    "Get scheme assignments with optional filtering by scheme, user, or assignment kind. " +
    "Shows who is assigned to which schemes and in what capacity.",
  parameters: GetSchemeAssignmentsSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_SCHEMES)) {
      throw new Error("Insufficient permissions to view scheme assignments");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);

    const whereConditions: any[] = [];
    if (Object.keys(schemeFilter).length > 0 && !params.schemeId) {
      whereConditions.push({ schemeId: { in: ctx.accessibleSchemeIds } });
    }
    if (params.schemeId) whereConditions.push({ schemeId: params.schemeId });
    if (params.userIdFilter) whereConditions.push({ userId: params.userIdFilter });
    if (params.assignmentKind) whereConditions.push({ assignmentKind: params.assignmentKind });

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const assignments = await prisma.schemeAssignment.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
        user: { select: { name: true } },
        role: { select: { code: true } },
      },
      orderBy: [{ scheme: { name: "asc" } }, { sortOrder: "asc" }],
    });

    const results: SchemeAssignment[] = assignments.map((a) => ({
      id: a.id,
      schemeName: a.scheme.name,
      subschemeName: a.subscheme?.name,
      assignmentKind: a.assignmentKind,
      userName: a.user?.name,
      roleCode: a.role?.code,
      sortOrder: a.sortOrder,
    }));

    return { assignments: results };
  },
};

/**
 * Get schemes needing attention (aggregated view)
 */
const getSchemesNeedingAttention: ToolDefinition<
  typeof GetSchemesNeedingAttentionSchema,
  { schemes: SchemeAttentionResult[] }
> = {
  name: "getSchemesNeedingAttention",
  description:
    "Get schemes that need attention based on aggregated metrics: overdue action items, " +
    "delayed KPIs, pending submissions, and low fund utilization. Returns prioritized list.",
  parameters: GetSchemesNeedingAttentionSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (
      !hasAnyPermission(
        ctx,
        PERMISSIONS.VIEW_ALL_DATA,
        PERMISSIONS.VIEW_SCHEMES,
        PERMISSIONS.VIEW_ACTION_ITEMS,
        PERMISSIONS.VIEW_KPI_DATA
      )
    ) {
      throw new Error("Insufficient permissions to analyze schemes");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const schemeIds =
      Object.keys(schemeFilter).length > 0
        ? ctx.accessibleSchemeIds
        : (await prisma.scheme.findMany({ select: { id: true } })).map((s) => s.id);

    const results: SchemeAttentionResult[] = [];
    const now = new Date();

    for (const schemeId of schemeIds.slice(0, params.limit * 2)) {
      const reasons: string[] = [];
      const metrics: SchemeAttentionResult["metrics"] = {
        overdueActionItems: 0,
        delayedKpis: 0,
        pendingKpiSubmissions: 0,
      };

      // Check overdue action items
      const overdueActionItems = await prisma.actionItem.count({
        where: {
          schemeId,
          status: { not: "COMPLETED" },
          dueDate: { lt: now },
        },
      });
      metrics.overdueActionItems = overdueActionItems;
      if (overdueActionItems > 0) {
        reasons.push(`${overdueActionItems} overdue action item(s)`);
      }

      // Check delayed KPIs
      const delayedKpis = await prisma.kpiMeasurement.count({
        where: {
          kpiTarget: {
            kpiDefinition: { schemeId },
          },
          progressStatus: { in: ["delayed", "overdue"] },
        },
      });
      metrics.delayedKpis = delayedKpis;
      if (delayedKpis > 0) {
        reasons.push(`${delayedKpis} delayed/overdue KPI(s)`);
      }

      // Check pending KPI submissions
      const pendingSubmissions = await prisma.kpiMeasurement.count({
        where: {
          kpiTarget: {
            kpiDefinition: { schemeId },
          },
          workflowStatus: { in: ["submitted", "rejected"] },
        },
      });
      metrics.pendingKpiSubmissions = pendingSubmissions;
      if (pendingSubmissions > 0) {
        reasons.push(`${pendingSubmissions} KPI submission(s) awaiting review`);
      }

      // Check fund utilization if finance data is accessible
      if (hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_FINANCE_DATA)) {
        const budget = await prisma.financeBudget.findFirst({
          where: {
            schemeId,
            ...(params.financialYearId && { financialYearId: params.financialYearId }),
          },
        });

        if (budget) {
          const snapshot = await prisma.financeExpenditureSnapshot.findFirst({
            where: {
              schemeId,
              financialYearId: budget.financialYearId,
            },
            orderBy: { asOfDate: "desc" },
          });

          const expenditure = snapshot
            ? Number(snapshot.soExpenditureCr) + Number(snapshot.ifmsExpenditureCr)
            : 0;
          const budgetAmount = Number(budget.budgetEstimateCr);
          const utilization = budgetAmount > 0 ? expenditure / budgetAmount : 0;
          metrics.fundUtilization = utilization;

          if (utilization < 0.3) {
            reasons.push(`Low fund utilization (${(utilization * 100).toFixed(1)}%)`);
          }
        }
      }

      // Only include schemes that have issues
      if (reasons.length > 0) {
        const scheme = await prisma.scheme.findUnique({
          where: { id: schemeId },
          select: { name: true },
        });

        // Determine severity
        let severity: "high" | "medium" | "low" = "low";
        if (overdueActionItems > 5 || delayedKpis > 5 || metrics.fundUtilization! < 0.2) {
          severity = "high";
        } else if (overdueActionItems > 2 || delayedKpis > 2 || metrics.fundUtilization! < 0.3) {
          severity = "medium";
        }

        results.push({
          schemeId,
          schemeName: scheme?.name ?? "Unknown",
          reasons,
          severity,
          metrics,
        });
      }
    }

    // Sort by severity then by number of issues
    const sorted = results
      .sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.reasons.length - a.reasons.length;
      })
      .slice(0, params.limit);

    return { schemes: sorted };
  },
};

// ============== EXPORT ==============

export const schemeTools = [getSchemes, getSchemeDetails, getSchemeAssignments, getSchemesNeedingAttention];
