// AI Chat System - Main exports

// Orchestrator
export { runAgent, toolRegistry, buildConversationContext } from "./orchestrator";
export type { AgentResult } from "./orchestrator";

// Query Understanding
export { analyzeQuery, suggestTools, buildToolParams } from "./query-understanding";
export type { QueryAnalysis, QueryIntent } from "./query-understanding";

// Logging
export {
  logAIInteraction,
  startConversation,
  logToolExecution,
  logLLMRequest,
  logPerformanceMetrics,
  queryCache,
  generateCacheKey,
} from "./logging";

// Tools - Types
export type {
  ToolDefinition,
  ToolRegistry,
  ToolCall,
  ToolResult,
  LLMMessage,
  LLMResponse,
  ConversationContext,
  AIResponse,
} from "./tools/types";
export { BaseToolParams } from "./tools/types";

// Tools - RBAC
export {
  buildConversationContext as buildRBACContext,
  hasPermission,
  hasAnyPermission,
  getSchemeAccessFilter,
  getVerticalAccessFilter,
  verifySchemeAccess,
  PERMISSIONS,
} from "./tools/rbac";

// Tool exports by domain
export { financeTools } from "./tools/finance";
export { kpiTools } from "./tools/kpi";
export { actionItemTools } from "./tools/action-items";
export { schemeTools } from "./tools/schemes";
