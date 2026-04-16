import { prisma } from "@/lib/prisma";
import { ToolResult, ToolCall, LLMMessage } from "./tools/types";

export interface AIInteractionLog {
  id: string;
  userId: string;
  userQuery: string;
  conversationId?: string;
  toolCalls: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    success: boolean;
    executionTimeMs: number;
    errorMessage?: string;
  }>;
  llmRequests: Array<{
    requestNumber: number;
    messageCount: number;
    tokensUsed?: number;
  }>;
  finalResponse: string;
  totalExecutionTimeMs: number;
  createdAt: Date;
}

export interface ConversationContext {
  id: string;
  userId: string;
  messages: LLMMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Log an AI interaction to the audit log
 */
export async function logAIInteraction(
  userId: string,
  data: {
    userQuery: string;
    conversationId?: string;
    toolCalls: Array<{
      toolName: string;
      parameters: Record<string, unknown>;
      success: boolean;
      executionTimeMs: number;
      errorMessage?: string;
    }>;
    llmRequests: Array<{
      requestNumber: number;
      messageCount: number;
      tokensUsed?: number;
    }>;
    finalResponse: string;
    totalExecutionTimeMs: number;
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        actionType: "AI_CHAT_INTERACTION",
        entityType: "AIConversation",
        entityId: data.conversationId,
        metadata: {
          userQuery: data.userQuery,
          toolCalls: data.toolCalls.map((tc) => ({
            toolName: tc.toolName,
            success: tc.success,
            executionTimeMs: tc.executionTimeMs,
            hasError: !!tc.errorMessage,
          })),
          llmRequestCount: data.llmRequests.length,
          totalExecutionTimeMs: data.totalExecutionTimeMs,
          responseLength: data.finalResponse.length,
        },
        after: {
          toolCalls: data.toolCalls as unknown as import("@prisma/client").Prisma.JsonArray,
          llmRequests: data.llmRequests as unknown as import("@prisma/client").Prisma.JsonArray,
          finalResponse: data.finalResponse,
        },
      },
    });
  } catch (error) {
    // Log to console but don't throw - logging should not break the chat
    console.error("Failed to log AI interaction:", error);
  }
}

/**
 * Start tracking a new conversation
 */
export async function startConversation(
  userId: string,
  initialMessage: string
): Promise<string> {
  // Generate a conversation ID (UUID)
  const conversationId = crypto.randomUUID();

  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        actionType: "AI_CONVERSATION_STARTED",
        entityType: "AIConversation",
        entityId: conversationId,
        metadata: {
          initialMessage: initialMessage.slice(0, 500), // Truncate long messages
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to log conversation start:", error);
  }

  return conversationId;
}

/**
 * Log a single tool execution
 */
export async function logToolExecution(
  userId: string,
  data: {
    conversationId?: string;
    toolName: string;
    parameters: Record<string, unknown>;
    success: boolean;
    executionTimeMs: number;
    errorMessage?: string;
    resultSummary?: string;
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        actionType: "AI_TOOL_EXECUTION",
        entityType: "AIToolCall",
        entityId: data.conversationId,
        metadata: {
          toolName: data.toolName,
          success: data.success,
          executionTimeMs: data.executionTimeMs,
          hasError: !!data.errorMessage,
          errorMessage: data.errorMessage?.slice(0, 200), // Truncate long errors
          resultSummary: data.resultSummary?.slice(0, 500),
        },
        before: { parameters: data.parameters as unknown as import("@prisma/client").Prisma.JsonObject },
      },
    });
  } catch (error) {
    console.error("Failed to log tool execution:", error);
  }
}

/**
 * Log an LLM API request
 */
export async function logLLMRequest(
  userId: string,
  data: {
    conversationId?: string;
    requestNumber: number;
    messageCount: number;
    tokensUsed?: number;
    model?: string;
    provider?: string;
    latencyMs: number;
    finishReason?: string;
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        actionType: "AI_LLM_REQUEST",
        entityType: "AILLMRequest",
        entityId: data.conversationId,
        metadata: {
          requestNumber: data.requestNumber,
          messageCount: data.messageCount,
          tokensUsed: data.tokensUsed,
          model: data.model,
          provider: data.provider,
          latencyMs: data.latencyMs,
          finishReason: data.finishReason,
        },
      },
    });
  } catch (error) {
    console.error("Failed to log LLM request:", error);
  }
}

/**
 * Simple in-memory cache for repeated queries
 * Note: In production, this should use Redis or similar
 */
class QueryCache {
  private cache = new Map<
    string,
    {
      result: unknown;
      timestamp: number;
      ttl: number;
    }
  >();

  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  set(key: string, result: unknown, ttl?: number): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear old entries
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const queryCache = new QueryCache();

/**
 * Generate cache key for a query
 */
export function generateCacheKey(userId: string, query: string, tools: string[]): string {
  return `${userId}:${tools.sort().join(",")}:${query.toLowerCase().trim()}`;
}

/**
 * Log performance metrics for monitoring
 */
export async function logPerformanceMetrics(
  userId: string,
  metrics: {
    conversationId?: string;
    queryProcessingTimeMs: number;
    toolExecutionTimeMs: number;
    llmTimeMs: number;
    totalTimeMs: number;
    toolCallCount: number;
    llmRequestCount: number;
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        actionType: "AI_PERFORMANCE_METRICS",
        entityType: "AIConversation",
        entityId: metrics.conversationId,
        metadata: {
          queryProcessingTimeMs: metrics.queryProcessingTimeMs,
          toolExecutionTimeMs: metrics.toolExecutionTimeMs,
          llmTimeMs: metrics.llmTimeMs,
          totalTimeMs: metrics.totalTimeMs,
          toolCallCount: metrics.toolCallCount,
          llmRequestCount: metrics.llmRequestCount,
          averageToolTimeMs:
            metrics.toolCallCount > 0 ? metrics.toolExecutionTimeMs / metrics.toolCallCount : 0,
        },
      },
    });
  } catch (error) {
    console.error("Failed to log performance metrics:", error);
  }
}
