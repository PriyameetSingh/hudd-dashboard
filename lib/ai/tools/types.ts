import { z } from "zod";

// Tool parameter base - every tool must include userId for RBAC
export const BaseToolParams = z.object({
  userId: z.string().uuid(),
});

// Tool definition structure
export interface ToolDefinition<TParams extends z.ZodType, TResult> {
  name: string;
  description: string;
  parameters: TParams;
  execute: (params: z.infer<TParams>) => Promise<TResult>;
}

// Tool call from LLM
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Tool result to return to LLM
export interface ToolResult {
  toolCallId: string;
  role: "tool";
  name: string;
  content: string;
}

// LLM message types
export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// LLM response
export interface LLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
}

// Conversation context
export interface ConversationContext {
  userId: string;
  userRoleCodes: string[];
  permissions: Set<string>;
  accessibleSchemeIds: string[];
  accessibleVerticalIds: string[];
}

// AI response format
export interface AIResponse {
  summary: string;
  insights: string[];
  data?: Record<string, unknown>;
  followUpQuestions?: string[];
}

// Tool registry
export type ToolRegistry = Map<string, ToolDefinition<any, any>>;
