import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ActionItemStatus, ActionItemPriority } from "@prisma/client";
import { ToolDefinition, BaseToolParams } from "./types";
import {
  buildConversationContext,
  getSchemeAccessFilter,
  getVerticalAccessFilter,
  hasAnyPermission,
  PERMISSIONS,
} from "./rbac";

// ============== SCHEMAS ==============

const GetPendingActionItemsSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  verticalId: z.string().uuid().optional(),
  assignedToMe: z.boolean().default(false),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const GetOverdueActionItemsSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  verticalId: z.string().uuid().optional(),
  daysOverdue: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const GetActionItemDetailsSchema = BaseToolParams.extend({
  actionItemId: z.string().uuid(),
});

const GetActionItemsByStatusSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "PROOF_UPLOADED", "UNDER_REVIEW", "COMPLETED", "OVERDUE"]),
  limit: z.number().int().min(1).max(50).default(20),
});

const GetActionItemsNeedingAttentionSchema = BaseToolParams.extend({
  schemeId: z.string().uuid().optional(),
  includeCritical: z.boolean().default(true),
  limit: z.number().int().min(1).max(30).default(15),
});

// ============== TYPES ==============

type ActionItemSummary = {
  id: string;
  title: string;
  description: string;
  schemeName?: string;
  verticalName?: string;
  priority: string;
  status: string;
  dueDate: string;
  assignedToName?: string;
  reviewerName?: string;
  daysRemaining: number;
  isOverdue: boolean;
  createdAt: string;
};

type ActionItemDetail = ActionItemSummary & {
  meetingTitle?: string;
  updates: Array<{
    timestamp: string;
    status: string;
    note: string;
  }>;
  proofCount: number;
};

type AttentionNeededResult = {
  criticalOverdue: ActionItemSummary[];
  highPriorityPending: ActionItemSummary[];
  nearingDeadline: ActionItemSummary[];
  stalledInProgress: ActionItemSummary[];
};

// ============== HELPERS ==============

/**
 * Calculate days remaining until due date
 */
function calculateDaysRemaining(dueDate: Date): { days: number; isOverdue: boolean } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { days, isOverdue: days < 0 };
}

/**
 * Priority ranking for sorting (lower = higher priority)
 */
const priorityRank: Record<ActionItemPriority, number> = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4,
};

// ============== TOOLS ==============

/**
 * Get pending action items with filtering
 */
const getPendingActionItems: ToolDefinition<
  typeof GetPendingActionItemsSchema,
  { actionItems: ActionItemSummary[]; totalPending: number }
> = {
  name: "getPendingActionItems",
  description:
    "Get pending action items (not completed). " +
    "Can filter by scheme, vertical, assigned to current user, or priority level.",
  parameters: GetPendingActionItemsSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_ACTION_ITEMS)) {
      throw new Error("Insufficient permissions to view action items");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const verticalFilter = getVerticalAccessFilter(ctx);

    const baseConditions: any[] = [{ status: { not: "COMPLETED" } }];
    if (Object.keys(schemeFilter).length > 0) {
      baseConditions.push({ OR: [{ schemeId: { in: ctx.accessibleSchemeIds } }, { schemeId: null }] });
    }
    if (Object.keys(verticalFilter).length > 0 && ctx.accessibleVerticalIds.length > 0) {
      baseConditions.push({ OR: [{ verticalId: { in: ctx.accessibleVerticalIds } }, { verticalId: null }] });
    }
    if (params.schemeId) baseConditions.push({ schemeId: params.schemeId });
    if (params.verticalId) baseConditions.push({ verticalId: params.verticalId });
    if (params.assignedToMe) baseConditions.push({ assignedToId: ctx.userId });
    if (params.priority) baseConditions.push({ priority: params.priority });

    const where = { AND: baseConditions };

    const [actionItems, totalCount] = await Promise.all([
      prisma.actionItem.findMany({
        where,
        include: {
          scheme: true,
          vertical: true,
          assignedTo: true,
          reviewer: true,
        },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
        take: params.limit,
      }),
      prisma.actionItem.count({ where }),
    ]);

    const summaries: ActionItemSummary[] = actionItems.map((item) => {
      const { days, isOverdue } = calculateDaysRemaining(item.dueDate);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        schemeName: item.scheme?.name,
        verticalName: item.vertical?.name,
        priority: item.priority,
        status: item.status,
        dueDate: item.dueDate.toISOString().split("T")[0],
        assignedToName: item.assignedTo?.name,
        reviewerName: item.reviewer?.name,
        daysRemaining: days,
        isOverdue,
        createdAt: item.createdAt.toISOString(),
      };
    });

    return { actionItems: summaries, totalPending: totalCount };
  },
};

/**
 * Get overdue action items
 */
const getOverdueActionItems: ToolDefinition<
  typeof GetOverdueActionItemsSchema,
  { overdueItems: ActionItemSummary[]; totalOverdue: number }
> = {
  name: "getOverdueActionItems",
  description:
    "Get overdue action items (past due date and not completed). " +
    "Can filter by scheme, vertical, or minimum days overdue.",
  parameters: GetOverdueActionItemsSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_ACTION_ITEMS)) {
      throw new Error("Insufficient permissions to view action items");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);

    const cutoffDate = params.daysOverdue
      ? new Date(Date.now() - params.daysOverdue * 24 * 60 * 60 * 1000)
      : new Date();

    const baseConditions: any[] = [
      { status: { not: "COMPLETED" } },
      { dueDate: { lt: cutoffDate } },
    ];
    if (Object.keys(schemeFilter).length > 0) {
      baseConditions.push({ OR: [{ schemeId: { in: ctx.accessibleSchemeIds } }, { schemeId: null }] });
    }
    if (params.schemeId) baseConditions.push({ schemeId: params.schemeId });
    if (params.verticalId) baseConditions.push({ verticalId: params.verticalId });

    const where = { AND: baseConditions };

    const [actionItems, totalCount] = await Promise.all([
      prisma.actionItem.findMany({
        where,
        include: {
          scheme: true,
          vertical: true,
          assignedTo: true,
          reviewer: true,
        },
        orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
        take: params.limit,
      }),
      prisma.actionItem.count({ where }),
    ]);

    const summaries: ActionItemSummary[] = actionItems.map((item) => {
      const { days, isOverdue } = calculateDaysRemaining(item.dueDate);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        schemeName: item.scheme?.name,
        verticalName: item.vertical?.name,
        priority: item.priority,
        status: item.status,
        dueDate: item.dueDate.toISOString().split("T")[0],
        assignedToName: item.assignedTo?.name,
        reviewerName: item.reviewer?.name,
        daysRemaining: days,
        isOverdue,
        createdAt: item.createdAt.toISOString(),
      };
    });

    return { overdueItems: summaries, totalOverdue: totalCount };
  },
};

/**
 * Get detailed information about a specific action item
 */
const getActionItemDetails: ToolDefinition<typeof GetActionItemDetailsSchema, { actionItem: ActionItemDetail }> = {
  name: "getActionItemDetails",
  description: "Get detailed information about a specific action item including update history and proof uploads.",
  parameters: GetActionItemDetailsSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_ACTION_ITEMS)) {
      throw new Error("Insufficient permissions to view action items");
    }

    const actionItem = await prisma.actionItem.findUnique({
      where: { id: params.actionItemId },
      include: {
        scheme: true,
        vertical: true,
        assignedTo: true,
        reviewer: true,
        meeting: true,
        updates: {
          orderBy: { timestamp: "desc" },
        },
        proofs: true,
      },
    });

    if (!actionItem) {
      throw new Error("Action item not found");
    }

    // Verify access
    if (
      !ctx.permissions.has(PERMISSIONS.VIEW_ALL_DATA) &&
      actionItem.schemeId &&
      !ctx.accessibleSchemeIds.includes(actionItem.schemeId)
    ) {
      throw new Error("Access denied to this action item");
    }

    const { days, isOverdue } = calculateDaysRemaining(actionItem.dueDate);

    const detail: ActionItemDetail = {
      id: actionItem.id,
      title: actionItem.title,
      description: actionItem.description,
      schemeName: actionItem.scheme?.name,
      verticalName: actionItem.vertical?.name,
      priority: actionItem.priority,
      status: actionItem.status,
      dueDate: actionItem.dueDate.toISOString().split("T")[0],
      assignedToName: actionItem.assignedTo?.name,
      reviewerName: actionItem.reviewer?.name,
      daysRemaining: days,
      isOverdue,
      createdAt: actionItem.createdAt.toISOString(),
      meetingTitle: actionItem.meeting?.title ?? undefined,
      updates: actionItem.updates.map((u) => ({
        timestamp: u.timestamp.toISOString(),
        status: u.status,
        note: u.note,
      })),
      proofCount: actionItem.proofs.length,
    };

    return { actionItem: detail };
  },
};

/**
 * Get action items by status
 */
const getActionItemsByStatus: ToolDefinition<
  typeof GetActionItemsByStatusSchema,
  { actionItems: ActionItemSummary[]; count: number }
> = {
  name: "getActionItemsByStatus",
  description:
    "Get action items filtered by a specific status. " +
    "Statuses: OPEN, IN_PROGRESS, PROOF_UPLOADED, UNDER_REVIEW, COMPLETED, OVERDUE.",
  parameters: GetActionItemsByStatusSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_ACTION_ITEMS)) {
      throw new Error("Insufficient permissions to view action items");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);

    // For OVERDUE status, we need to filter by date as well
    const baseConditions: any[] = [];
    if (Object.keys(schemeFilter).length > 0) {
      baseConditions.push({ OR: [{ schemeId: { in: ctx.accessibleSchemeIds } }, { schemeId: null }] });
    }
    if (params.schemeId) baseConditions.push({ schemeId: params.schemeId });
    const baseWhere = { AND: baseConditions };

    const whereConditions = [...baseWhere.AND];
    if (params.status === "OVERDUE") {
      whereConditions.push({ status: { not: "COMPLETED" } });
      whereConditions.push({ dueDate: { lt: new Date() } });
    } else {
      whereConditions.push({ status: params.status });
    }
    const where = { AND: whereConditions };

    const [actionItems, count] = await Promise.all([
      prisma.actionItem.findMany({
        where,
        include: {
          scheme: true,
          vertical: true,
          assignedTo: true,
          reviewer: true,
        },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
        take: params.limit,
      }),
      prisma.actionItem.count({ where }),
    ]);

    const summaries: ActionItemSummary[] = actionItems.map((item) => {
      const { days, isOverdue } = calculateDaysRemaining(item.dueDate);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        schemeName: item.scheme?.name,
        verticalName: item.vertical?.name,
        priority: item.priority,
        status: item.status,
        dueDate: item.dueDate.toISOString().split("T")[0],
        assignedToName: item.assignedTo?.name,
        reviewerName: item.reviewer?.name,
        daysRemaining: days,
        isOverdue,
        createdAt: item.createdAt.toISOString(),
      };
    });

    return { actionItems: summaries, count };
  },
};

/**
 * Get action items needing attention (critical, overdue, nearing deadline)
 */
const getActionItemsNeedingAttention: ToolDefinition<
  typeof GetActionItemsNeedingAttentionSchema,
  AttentionNeededResult
> = {
  name: "getActionItemsNeedingAttention",
  description:
    "Get action items that need attention: critical overdue, high priority pending, nearing deadline (within 7 days), " +
    "and stalled in-progress items (no update in 14 days).",
  parameters: GetActionItemsNeedingAttentionSchema,
  execute: async (params) => {
    const ctx = await buildConversationContext(params.userId);

    if (!hasAnyPermission(ctx, PERMISSIONS.VIEW_ALL_DATA, PERMISSIONS.VIEW_ACTION_ITEMS)) {
      throw new Error("Insufficient permissions to view action items");
    }

    const schemeFilter = getSchemeAccessFilter(ctx);
    const baseConditions: any[] = [{ status: { not: "COMPLETED" } }];
    if (Object.keys(schemeFilter).length > 0) {
      baseConditions.push({ OR: [{ schemeId: { in: ctx.accessibleSchemeIds } }, { schemeId: null }] });
    }
    if (params.schemeId) baseConditions.push({ schemeId: params.schemeId });
    const baseWhere = { AND: baseConditions };

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Critical overdue (Critical priority + overdue)
    const criticalOverdueItems = await prisma.actionItem.findMany({
      where: {
        AND: baseWhere.AND.concat([
          { priority: "Critical" },
          { dueDate: { lt: now } },
        ]),
      },
      include: {
        scheme: true,
        vertical: true,
        assignedTo: true,
        reviewer: true,
      },
      orderBy: { dueDate: "asc" },
      take: params.limit,
    });

    // High priority pending (High priority + not started)
    const highPriorityPendingItems = await prisma.actionItem.findMany({
      where: {
        AND: baseWhere.AND.concat([
          { priority: "High" },
          { status: "OPEN" },
        ]),
      },
      include: {
        scheme: true,
        vertical: true,
        assignedTo: true,
        reviewer: true,
      },
      orderBy: { dueDate: "asc" },
      take: params.limit,
    });

    // Nearing deadline (due within 7 days)
    const nearingDeadlineItems = await prisma.actionItem.findMany({
      where: {
        AND: baseWhere.AND.concat([
          { dueDate: { gte: now } },
          { dueDate: { lte: sevenDaysFromNow } },
        ]),
      },
      include: {
        scheme: true,
        vertical: true,
        assignedTo: true,
        reviewer: true,
      },
      orderBy: { dueDate: "asc" },
      take: params.limit,
    });

    // Stalled in-progress (IN_PROGRESS status, no update in 14 days)
    const stalledItems = await prisma.actionItem.findMany({
      where: {
        AND: baseWhere.AND.concat([
          { status: "IN_PROGRESS" },
          {
            OR: [
              {
                updates: {
                  none: {},
                },
              },
              {
                updates: {
                  every: {
                    timestamp: { lt: fourteenDaysAgo },
                  },
                },
              },
            ],
          },
        ]),
      },
      include: {
        scheme: true,
        vertical: true,
        assignedTo: true,
        reviewer: true,
        updates: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { dueDate: "asc" },
      take: params.limit,
    });

    const toSummary = (item: typeof criticalOverdueItems[0]): ActionItemSummary => {
      const { days, isOverdue } = calculateDaysRemaining(item.dueDate);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        schemeName: item.scheme?.name,
        verticalName: item.vertical?.name,
        priority: item.priority,
        status: item.status,
        dueDate: item.dueDate.toISOString().split("T")[0],
        assignedToName: item.assignedTo?.name,
        reviewerName: item.reviewer?.name,
        daysRemaining: days,
        isOverdue,
        createdAt: item.createdAt.toISOString(),
      };
    };

    return {
      criticalOverdue: criticalOverdueItems.map(toSummary),
      highPriorityPending: highPriorityPendingItems.map(toSummary),
      nearingDeadline: nearingDeadlineItems.map(toSummary),
      stalledInProgress: stalledItems.map(toSummary),
    };
  },
};

// ============== EXPORT ==============

export const actionItemTools = [
  getPendingActionItems,
  getOverdueActionItems,
  getActionItemDetails,
  getActionItemsByStatus,
  getActionItemsNeedingAttention,
];
