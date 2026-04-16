import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ToolDefinition, BaseToolParams } from "./types";
import { buildConversationContext, getSchemeAccessFilter, hasAnyPermission, PERMISSIONS } from "./rbac";

// ============== SCHEMAS ==============

const GetSchemeFinancialSummarySchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  subschemeId: z.string().uuid().optional(),
  financialYearId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

const GetBudgetVsExpenditureSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  financialYearId: z.string().uuid().optional(),
  includeSubschemes: z.boolean().default(true),
});

const GetSupplementHistorySchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  subschemeId: z.string().uuid().optional(),
  financialYearId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const GetFinanceTrendSchema = BaseToolParams.extend({
  schemeId: z.string().uuid(),
  months: z.number().int().min(3).max(24).default(12),
});

const GetLowFundUtilizationSchemesSchema = BaseToolParams.extend({
  threshold: z.number().min(0).max(1).default(0.5),
  financialYearId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

// ============== TYPES ==============

type FinancialSummary = {
  schemeId: string;
  schemeName: string;
  subschemeId?: string;
  subschemeName?: string;
  financialYearLabel: string;
  budgetEstimateCr: number;
  totalExpenditureCr: number;
  fundUtilization: number;
  supplementCount: number;
  supplementTotalCr: number;
};

type BudgetVsExpenditure = {
  schemeId: string;
  schemeName: string;
  budgetEstimateCr: number;
  soExpenditureCr: number;
  ifmsExpenditureCr: number;
  totalExpenditureCr: number;
  remainingBudgetCr: number;
  utilizationRate: number;
  subschemes?: Array<{
    subschemeId: string;
    subschemeName: string;
    budgetEstimateCr: number;
    totalExpenditureCr: number;
    utilizationRate: number;
  }>;
};

type SupplementRecord = {
  id: string;
  schemeName: string;
  subschemeName?: string;
  financialYearLabel: string;
  amountCr: number;
  reason: string;
  referenceNo?: string;
  createdAt: string;
};

type MonthlyTrend = {
  month: string;
  soExpenditureCr: number;
  ifmsExpenditureCr: number;
  totalExpenditureCr: number;
  cumulativeExpenditureCr: number;
};

// ============== TOOLS ==============

/**
 * Get financial summary for schemes with calculated fund utilization
 */
const getSchemeFinancialSummary: ToolDefinition<
  typeof GetSchemeFinancialSummarySchema,
  { summaries: FinancialSummary[] }
> = {
  name: "getSchemeFinancialSummary",
  description:
    "Get financial summary for schemes including budget, expenditure, and fund utilization rate. " +
    "Can filter by scheme, subscheme, or financial year. Returns fund utilization as a ratio (0-1).",
  parameters: GetSchemeFinancialSummarySchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    // Check permissions
    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_FINANCE_DATA)) {
      throw new Error("Insufficient permissions to view financial data");
    }

    // Build where clause with RBAC filtering
    const schemeFilter = getSchemeAccessFilter(ctx);
    const where = {
      ...schemeFilter,
      ...(params.schemeId && { schemeId: params.schemeId }),
      ...(params.subschemeId && { subschemeId: params.subschemeId }),
      ...(params.financialYearId && { financialYearId: params.financialYearId }),
    };

    const budgets = await prisma.financeBudget.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
        financialYear: true,
        revisions: true,
      },
      take: params.limit,
    });

    const summaries: FinancialSummary[] = await Promise.all(
      budgets.map(async (budget) => {
        // Get latest expenditure snapshot
        const latestSnapshot = await prisma.financeExpenditureSnapshot.findFirst({
          where: {
            schemeId: budget.schemeId,
            ...(budget.subschemeId && { subschemeId: budget.subschemeId }),
            financialYearId: budget.financialYearId,
          },
          orderBy: { asOfDate: "desc" },
        });

        // Get supplements
        const supplements = await prisma.financeBudgetSupplement.findMany({
          where: {
            schemeId: budget.schemeId,
            ...(budget.subschemeId && { subschemeId: budget.subschemeId }),
            financialYearId: budget.financialYearId,
          },
        });

        const totalExpenditure = latestSnapshot
          ? Number(latestSnapshot.soExpenditureCr) + Number(latestSnapshot.ifmsExpenditureCr)
          : 0;

        const totalBudget = Number(budget.budgetEstimateCr);
        const supplementTotal = supplements.reduce((sum, s) => sum + Number(s.amountCr), 0);
        const adjustedBudget = totalBudget + supplementTotal;

        return {
          schemeId: budget.schemeId,
          schemeName: budget.scheme.name,
          subschemeId: budget.subschemeId ?? undefined,
          subschemeName: budget.subscheme?.name,
          financialYearLabel: budget.financialYear.label,
          budgetEstimateCr: totalBudget,
          totalExpenditureCr: totalExpenditure,
          fundUtilization: adjustedBudget > 0 ? totalExpenditure / adjustedBudget : 0,
          supplementCount: supplements.length,
          supplementTotalCr: supplementTotal,
        };
      })
    );

    return { summaries };
  },
};

/**
 * Compare budget vs expenditure with optional subscheme breakdown
 */
const getBudgetVsExpenditure: ToolDefinition<
  typeof GetBudgetVsExpenditureSchema,
  { comparisons: BudgetVsExpenditure[] }
> = {
  name: "getBudgetVsExpenditure",
  description:
    "Compare budget estimates vs actual expenditure for schemes. " +
    "Returns utilization rate and remaining budget. Can include subscheme-level breakdown.",
  parameters: GetBudgetVsExpenditureSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_FINANCE_DATA)) {
      throw new Error("Insufficient permissions to view financial data");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const where = {
      ...schemeFilter,
      ...(params.schemeId && { schemeId: params.schemeId }),
      ...(params.financialYearId && { financialYearId: params.financialYearId }),
    };

    const budgets = await prisma.financeBudget.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
      },
    });

    const groupedByScheme = budgets.reduce((acc, budget) => {
      if (!acc[budget.schemeId]) {
        acc[budget.schemeId] = {
          scheme: budget.scheme,
          budgets: [],
        };
      }
      acc[budget.schemeId].budgets.push(budget);
      return acc;
    }, {} as Record<string, { scheme: typeof budgets[0]["scheme"]; budgets: typeof budgets }>);

    const comparisons: BudgetVsExpenditure[] = await Promise.all(
      Object.entries(groupedByScheme).map(async ([schemeId, { scheme, budgets }]) => {
        const budgetEstimate = budgets.reduce((sum, b) => sum + Number(b.budgetEstimateCr), 0);

        // Get all expenditure snapshots for this scheme
        const snapshots = await prisma.financeExpenditureSnapshot.findMany({
          where: {
            schemeId,
            ...(params.financialYearId && { financialYearId: params.financialYearId }),
          },
          orderBy: { asOfDate: "desc" },
          distinct: ["subschemeId"],
        });

        const latestBySubscheme = new Map(
          snapshots.map((s) => [
            s.subschemeId ?? "null",
            { so: Number(s.soExpenditureCr), ifms: Number(s.ifmsExpenditureCr) },
          ])
        );

        const soExpenditure = Array.from(latestBySubscheme.values()).reduce(
          (sum, val) => sum + val.so,
          0
        );
        const ifmsExpenditure = Array.from(latestBySubscheme.values()).reduce(
          (sum, val) => sum + val.ifms,
          0
        );
        const totalExpenditure = soExpenditure + ifmsExpenditure;

        const result: BudgetVsExpenditure = {
          schemeId,
          schemeName: scheme.name,
          budgetEstimateCr: budgetEstimate,
          soExpenditureCr: soExpenditure,
          ifmsExpenditureCr: ifmsExpenditure,
          totalExpenditureCr: totalExpenditure,
          remainingBudgetCr: budgetEstimate - totalExpenditure,
          utilizationRate: budgetEstimate > 0 ? totalExpenditure / budgetEstimate : 0,
        };

        // Add subscheme breakdown if requested
        if (params.includeSubschemes) {
          result.subschemes = budgets
            .filter((b) => b.subschemeId !== null)
            .map((b) => {
              const subExp = latestBySubscheme.get(b.subschemeId!) ?? { so: 0, ifms: 0 };
              const subTotal = subExp.so + subExp.ifms;
              return {
                subschemeId: b.subschemeId!,
                subschemeName: b.subscheme!.name,
                budgetEstimateCr: Number(b.budgetEstimateCr),
                totalExpenditureCr: subTotal,
                utilizationRate: Number(b.budgetEstimateCr) > 0 ? subTotal / Number(b.budgetEstimateCr) : 0,
              };
            });
        }

        return result;
      })
    );

    return { comparisons };
  },
};

/**
 * Get supplement/revision history
 */
const getSupplementHistory: ToolDefinition<typeof GetSupplementHistorySchema, { supplements: SupplementRecord[] }> = {
  name: "getSupplementHistory",
  description:
    "Get budget supplement and revision history. " +
    "Returns positive amounts for top-ups, negative for diversions/cuts.",
  parameters: GetSupplementHistorySchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_FINANCE_DATA)) {
      throw new Error("Insufficient permissions to view financial data");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const where = {
      ...schemeFilter,
      ...(params.schemeId && { schemeId: params.schemeId }),
      ...(params.subschemeId && { subschemeId: params.subschemeId }),
      ...(params.financialYearId && { financialYearId: params.financialYearId }),
    };

    const supplements = await prisma.financeBudgetSupplement.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
        financialYear: true,
      },
      orderBy: { createdAt: "desc" },
      take: params.limit,
    });

    const records: SupplementRecord[] = supplements.map((s) => ({
      id: s.id,
      schemeName: s.scheme.name,
      subschemeName: s.subscheme?.name,
      financialYearLabel: s.financialYear.label,
      amountCr: Number(s.amountCr),
      reason: s.reason,
      referenceNo: s.referenceNo ?? undefined,
      createdAt: s.createdAt.toISOString(),
    }));

    return { supplements: records };
  },
};

/**
 * Get finance trend over time for a specific scheme
 */
const getFinanceTrend: ToolDefinition<typeof GetFinanceTrendSchema, { trends: MonthlyTrend[] }> = {
  name: "getFinanceTrend",
  description:
    "Get monthly expenditure trends for a specific scheme over the last N months. " +
    "Returns both SO and IFMS expenditure breakdown.",
  parameters: GetFinanceTrendSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_FINANCE_DATA)) {
      throw new Error("Insufficient permissions to view financial data");
    }

    // Verify scheme access
    if (!ctx.permissions.has(PERMISSIONS.VIEW_ALL_DATA) && !ctx.accessibleSchemeIds.includes(params.schemeId)) {
      throw new Error("Access denied to this scheme");
    }

    // Get snapshots from last N months
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - params.months);

    const snapshots = await prisma.financeExpenditureSnapshot.findMany({
      where: {
        schemeId: params.schemeId,
        asOfDate: { gte: cutoffDate },
      },
      orderBy: { asOfDate: "asc" },
      include: {
        scheme: true,
      },
    });

    // Group by month
    const monthlyData = snapshots.reduce((acc, snapshot) => {
      const monthKey = snapshot.asOfDate.toISOString().slice(0, 7); // YYYY-MM
      if (!acc[monthKey]) {
        acc[monthKey] = {
          so: 0,
          ifms: 0,
          count: 0,
        };
      }
      acc[monthKey].so += Number(snapshot.soExpenditureCr);
      acc[monthKey].ifms += Number(snapshot.ifmsExpenditureCr);
      acc[monthKey].count += 1;
      return acc;
    }, {} as Record<string, { so: number; ifms: number; count: number }>);

    let cumulative = 0;
    const trends: MonthlyTrend[] = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const total = data.so + data.ifms;
        cumulative += total;
        return {
          month,
          soExpenditureCr: data.so,
          ifmsExpenditureCr: data.ifms,
          totalExpenditureCr: total,
          cumulativeExpenditureCr: cumulative,
        };
      });

    return { trends };
  },
};

/**
 * Find schemes with low fund utilization
 */
const getLowFundUtilizationSchemes: ToolDefinition<
  typeof GetLowFundUtilizationSchemesSchema,
  { schemes: Array<FinancialSummary & { riskLevel: "high" | "medium" | "low" }> }
> = {
  name: "getLowFundUtilizationSchemes",
  description:
    "Find schemes with low fund utilization (expenditure / budget ratio below threshold). " +
    "Useful for identifying schemes that need attention or may lapse funds.",
  parameters: GetLowFundUtilizationSchemesSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_FINANCE_DATA)) {
      throw new Error("Insufficient permissions to view financial data");
    }

    // Get all accessible budgets
    const schemeFilter = getSchemeAccessFilter(ctx);
    const where = {
      ...schemeFilter,
      ...(params.financialYearId && { financialYearId: params.financialYearId }),
    };

    const budgets = await prisma.financeBudget.findMany({
      where,
      include: {
        scheme: true,
        subscheme: true,
        financialYear: true,
      },
    });

    const withUtilization = await Promise.all(
      budgets.map(async (budget) => {
        const latestSnapshot = await prisma.financeExpenditureSnapshot.findFirst({
          where: {
            schemeId: budget.schemeId,
            ...(budget.subschemeId && { subschemeId: budget.subschemeId }),
            financialYearId: budget.financialYearId,
          },
          orderBy: { asOfDate: "desc" },
        });

        const supplements = await prisma.financeBudgetSupplement.findMany({
          where: {
            schemeId: budget.schemeId,
            ...(budget.subschemeId && { subschemeId: budget.subschemeId }),
            financialYearId: budget.financialYearId,
          },
        });

        const totalExpenditure = latestSnapshot
          ? Number(latestSnapshot.soExpenditureCr) + Number(latestSnapshot.ifmsExpenditureCr)
          : 0;

        const totalBudget = Number(budget.budgetEstimateCr);
        const supplementTotal = supplements.reduce((sum, s) => sum + Number(s.amountCr), 0);
        const adjustedBudget = totalBudget + supplementTotal;

        const utilization = adjustedBudget > 0 ? totalExpenditure / adjustedBudget : 0;

        const riskLevel: "high" | "medium" | "low" =
          utilization < params.threshold * 0.5 ? "high" : utilization < params.threshold ? "medium" : "low";
        return {
          schemeId: budget.schemeId,
          schemeName: budget.scheme.name,
          subschemeId: budget.subschemeId ?? undefined,
          subschemeName: budget.subscheme?.name,
          financialYearLabel: budget.financialYear.label,
          budgetEstimateCr: totalBudget,
          totalExpenditureCr: totalExpenditure,
          fundUtilization: utilization,
          supplementCount: supplements.length,
          supplementTotalCr: supplementTotal,
          riskLevel,
        };
      })
    );

    // Filter to only low utilization and sort
    const lowUtilization = withUtilization
      .filter((s) => s.fundUtilization < params.threshold)
      .sort((a, b) => a.fundUtilization - b.fundUtilization)
      .slice(0, params.limit);

    return { schemes: lowUtilization };
  },
};

// ============== EXPORT ==============

export const financeTools = [
  getSchemeFinancialSummary,
  getBudgetVsExpenditure,
  getSupplementHistory,
  getFinanceTrend,
  getLowFundUtilizationSchemes,
];
