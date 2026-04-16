/**
 * Query Understanding Layer
 * Converts natural language queries into structured intents for routing
 */

export type QueryIntent =
  | "finance_summary"
  | "budget_vs_expenditure"
  | "low_utilization"
  | "supplement_history"
  | "finance_trend"
  | "kpi_performance"
  | "delayed_kpis"
  | "kpi_trends"
  | "kpis_awaiting_approval"
  | "pending_action_items"
  | "overdue_action_items"
  | "action_item_details"
  | "action_items_by_status"
  | "action_items_needing_attention"
  | "schemes_list"
  | "scheme_details"
  | "scheme_assignments"
  | "schemes_needing_attention"
  | "general_query";

export interface QueryAnalysis {
  intent: QueryIntent;
  confidence: number;
  entities: {
    schemeId?: string;
    schemeName?: string;
    subschemeId?: string;
    kpiId?: string;
    actionItemId?: string;
    financialYear?: string;
    verticalId?: string;
    userId?: string;
    priority?: "Critical" | "High" | "Medium" | "Low";
    status?: string;
    dateRange?: { start?: string; end?: string };
    threshold?: number;
  };
  filters: {
    assignedToMe?: boolean;
    includeOverdue?: boolean;
    includeSubschemes?: boolean;
    limit?: number;
  };
  timeContext?: "current" | "previous" | "next" | "custom";
}

// Keywords for intent classification
const INTENT_PATTERNS: Record<QueryIntent, string[]> = {
  finance_summary: [
    "budget",
    "expenditure",
    "financial summary",
    "fund status",
    "allocation",
    "budget estimate",
    "financial overview",
    "money spent",
    "funds used",
  ],
  budget_vs_expenditure: [
    "budget vs",
    "expenditure vs",
    "budget comparison",
    "spent vs allocated",
    "utilization",
    "fund utilization",
    "budget consumption",
    "spent against",
  ],
  low_utilization: [
    "low utilization",
    "underutilized",
    "low fund",
    "lapse risk",
    "unused budget",
    "low spending",
    "money not used",
    "under spending",
    "low expenditure",
  ],
  supplement_history: [
    "supplement",
    "revision",
    "budget change",
    "reallocation",
    "additional budget",
    "budget top up",
    "budget modification",
    "diversion",
  ],
  finance_trend: [
    "trend",
    "monthly expenditure",
    "spending pattern",
    "expenditure trend",
    "over time",
    "historical spending",
    "spending trend",
  ],
  kpi_performance: [
    "kpi performance",
    "kpi status",
    "key performance",
    "indicator status",
    "kpi overview",
    "performance metrics",
    "kpi values",
  ],
  delayed_kpis: [
    "delayed kpi",
    "overdue kpi",
    "behind target",
    "missing target",
    "kpi delayed",
    "kpi overdue",
    "not on track",
    "off track",
  ],
  kpi_trends: [
    "kpi trend",
    "kpi history",
    "kpi over time",
    "kpi progress",
    "kpi pattern",
    "indicator trend",
  ],
  kpis_awaiting_approval: [
    "awaiting approval",
    "pending approval",
    "kpi review",
    "submitted kpi",
    "kpi approval",
    "awaiting review",
    "pending review",
  ],
  pending_action_items: [
    "pending action",
    "open action",
    "incomplete task",
    "pending task",
    "action item pending",
    "not completed",
    "awaiting action",
  ],
  overdue_action_items: [
    "overdue action",
    "late action",
    "past due",
    "missed deadline",
    "overdue task",
    "action overdue",
    "delayed action",
  ],
  action_item_details: [
    "action item detail",
    "task detail",
    "specific action",
    "action item info",
    "action details",
    "task information",
  ],
  action_items_by_status: [
    "action by status",
    "tasks with status",
    "action items in",
    "filter by status",
  ],
  action_items_needing_attention: [
    "needs attention",
    "urgent action",
    "critical action",
    "action items attention",
    "tasks needing",
    "action priority",
    "stalled action",
  ],
  schemes_list: [
    "list schemes",
    "show schemes",
    "all schemes",
    "schemes in",
    "available schemes",
    "scheme list",
  ],
  scheme_details: [
    "scheme detail",
    "scheme info",
    "about scheme",
    "scheme information",
    "tell me about",
    "details of scheme",
  ],
  scheme_assignments: [
    "assignments",
    "who is assigned",
    "scheme owner",
    "responsible for",
    "assignment details",
    "who handles",
  ],
  schemes_needing_attention: [
    "schemes attention",
    "schemes need help",
    "problem schemes",
    "schemes with issues",
    "schemes at risk",
    "attention needed",
  ],
  general_query: [],
};

// Entity extraction patterns
const ENTITY_PATTERNS = {
  schemeName: /scheme["']?s?\s+(?:called\s+)?["']?([^"'\n,]+)/i,
  financialYear: /(?:fy|financial year|year)[\s-]?(\d{4}-?\d{2,4})/i,
  priority: /\b(Critical|High|Medium|Low)\s+priority/i,
  threshold: /(?:below|under|less than)\s+(\d+)%/i,
  months: /(?:last|past)\s+(\d+)\s+months/i,
};

/**
 * Analyze a natural language query and extract intent and entities
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const normalizedQuery = query.toLowerCase().trim();

  // Determine primary intent
  let bestIntent: QueryIntent = "general_query";
  let bestScore = 0;

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      // Check for exact phrase matches
      if (normalizedQuery.includes(pattern.toLowerCase())) {
        score += pattern.split(" ").length; // Weight by phrase length
      }
      // Check for individual keyword matches
      const keywords = pattern.toLowerCase().split(" ");
      const matchedKeywords = keywords.filter((kw) => normalizedQuery.includes(kw));
      score += matchedKeywords.length * 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as QueryIntent;
    }
  }

  // Calculate confidence
  const confidence = Math.min(bestScore / 3, 1);

  // Extract entities
  const entities: QueryAnalysis["entities"] = {};
  const filters: QueryAnalysis["filters"] = {};

  // Extract scheme name
  const schemeMatch = normalizedQuery.match(/(?:scheme|program)\s+(?:named?\s+)?["']?([^"'\n,]{3,50})/i);
  if (schemeMatch) {
    entities.schemeName = schemeMatch[1].trim();
  }

  // Extract financial year
  const fyMatch = normalizedQuery.match(/(?:fy|financial year|year)[\s-]?(\d{4}[-\s]?\d{2,4})/i);
  if (fyMatch) {
    entities.financialYear = fyMatch[1];
  }

  // Extract priority
  const priorityMatch = normalizedQuery.match(/\b(critical|high|medium|low)\s+(?:priority|urgent)?/i);
  if (priorityMatch) {
    const priority = priorityMatch[1].toLowerCase();
    if (["critical", "high", "medium", "low"].includes(priority)) {
      entities.priority = priority.charAt(0).toUpperCase() + priority.slice(1) as QueryAnalysis["entities"]["priority"];
    }
  }

  // Extract threshold percentages
  const thresholdMatch = normalizedQuery.match(/(?:below|under|less than|lower than)\s+(\d+)%/i);
  if (thresholdMatch) {
    entities.threshold = parseInt(thresholdMatch[1], 10) / 100;
  }

  // Extract limit
  const limitMatch = normalizedQuery.match(/(?:top|show|first)\s+(\d+)/i);
  if (limitMatch) {
    filters.limit = parseInt(limitMatch[1], 10);
  }

  // Detect filters
  if (normalizedQuery.includes("assigned to me") || normalizedQuery.includes("my schemes")) {
    filters.assignedToMe = true;
  }

  if (normalizedQuery.includes("include overdue") || normalizedQuery.includes("with overdue")) {
    filters.includeOverdue = true;
  }

  if (normalizedQuery.includes("with subschemes") || normalizedQuery.includes("breakdown")) {
    filters.includeSubschemes = true;
  }

  // Detect time context
  let timeContext: QueryAnalysis["timeContext"] = "current";
  if (normalizedQuery.includes("last year") || normalizedQuery.includes("previous year")) {
    timeContext = "previous";
  } else if (normalizedQuery.includes("next year") || normalizedQuery.includes("upcoming")) {
    timeContext = "next";
  } else if (normalizedQuery.includes("between") || normalizedQuery.includes("from")) {
    timeContext = "custom";
  }

  return {
    intent: bestIntent,
    confidence,
    entities,
    filters,
    timeContext,
  };
}

/**
 * Suggest tools based on query analysis
 */
export function suggestTools(analysis: QueryAnalysis): string[] {
  const toolMap: Record<QueryIntent, string[]> = {
    finance_summary: ["getSchemeFinancialSummary"],
    budget_vs_expenditure: ["getBudgetVsExpenditure"],
    low_utilization: ["getLowFundUtilizationSchemes"],
    supplement_history: ["getSupplementHistory"],
    finance_trend: ["getFinanceTrend"],
    kpi_performance: ["getKpiPerformance"],
    delayed_kpis: ["getDelayedKpis"],
    kpi_trends: ["getKpiTrends"],
    kpis_awaiting_approval: ["getKpisAwaitingApproval"],
    pending_action_items: ["getPendingActionItems"],
    overdue_action_items: ["getOverdueActionItems"],
    action_item_details: ["getActionItemDetails"],
    action_items_by_status: ["getActionItemsByStatus"],
    action_items_needing_attention: ["getActionItemsNeedingAttention"],
    schemes_list: ["getSchemes"],
    scheme_details: ["getSchemeDetails"],
    scheme_assignments: ["getSchemeAssignments"],
    schemes_needing_attention: ["getSchemesNeedingAttention"],
    general_query: [],
  };

  return toolMap[analysis.intent] ?? [];
}

/**
 * Build initial tool parameters from query analysis
 */
export function buildToolParams(
  analysis: QueryAnalysis,
  userId: string
): Record<string, unknown> | null {
  const baseParams: Record<string, unknown> = { userId };

  // Add entity-based parameters
  if (analysis.entities.schemeId) baseParams.schemeId = analysis.entities.schemeId;
  if (analysis.entities.kpiId) baseParams.kpiId = analysis.entities.kpiId;
  if (analysis.entities.actionItemId) baseParams.actionItemId = analysis.entities.actionItemId;
  if (analysis.entities.financialYear) baseParams.financialYearId = analysis.entities.financialYear;
  if (analysis.entities.verticalId) baseParams.verticalId = analysis.entities.verticalId;
  if (analysis.entities.priority) baseParams.priority = analysis.entities.priority;
  if (analysis.entities.threshold !== undefined) baseParams.threshold = analysis.entities.threshold;

  // Add filter-based parameters
  if (analysis.filters.assignedToMe !== undefined) baseParams.assignedToMe = analysis.filters.assignedToMe;
  if (analysis.filters.includeOverdue !== undefined) baseParams.includeOverdue = analysis.filters.includeOverdue;
  if (analysis.filters.includeSubschemes !== undefined) baseParams.includeSubschemes = analysis.filters.includeSubschemes;
  if (analysis.filters.limit !== undefined) baseParams.limit = analysis.filters.limit;

  return Object.keys(baseParams).length > 1 ? baseParams : null;
}
