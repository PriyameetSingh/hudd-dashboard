import { z } from "zod";
import {
  ToolDefinition,
  ToolRegistry,
  ToolCall,
  ToolResult,
  LLMMessage,
  LLMResponse,
  ConversationContext,
} from "./tools/types";
import { financeTools } from "./tools/finance";
import { kpiTools } from "./tools/kpi";
import { actionItemTools } from "./tools/action-items";
import { schemeTools } from "./tools/schemes";
import { analyzeQuery, suggestTools, buildToolParams } from "./query-understanding";
import { logAIInteraction, logToolExecution, logLLMRequest } from "./logging";
import { buildConversationContext } from "./tools/rbac";

// ============== CONFIGURATION ==============

const LLM_API_URL = process.env.LLM_API_URL!;
const LLM_API_KEY = process.env.LLM_API_KEY!;
const LLM_PROVIDER = process.env.LLM_PROVIDER || "airawat";
const LLM_MODEL = process.env.LLM_MODEL || "qwen3-30b-a3b-instruct";

const MAX_ITERATIONS = 5;
const REQUEST_TIMEOUT = 30000;

// ============== TOOL REGISTRY ==============

function createToolRegistry(): ToolRegistry {
  const registry = new Map<string, ToolDefinition<any, any>>();

  // Register all tools
  const allTools = [...financeTools, ...kpiTools, ...actionItemTools, ...schemeTools];
  for (const tool of allTools) {
    registry.set(tool.name, tool);
  }

  return registry;
}

const toolRegistry = createToolRegistry();

// ============== SYSTEM PROMPT ==============

function buildSystemPrompt(context: ConversationContext): string {
  const availableTools = Array.from(toolRegistry.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters.description ?? "See tool definition for parameters",
  }));

  return `You are NEXUS, an AI assistant for the HUDD (Haryana Urban Development Department) ERP dashboard.

Your role is to help government officials query structured data about schemes, budgets, KPIs, and action items using natural language.

## CRITICAL RULES

1. **ALWAYS USE TOOLS FOR DATA QUERIES**: When the user asks for specific data (budgets, KPIs, action items, schemes), you MUST call the appropriate tool. Never hallucinate or guess data.

2. **NO RAW SQL**: You do not have direct database access. All data must come through the provided tools.

3. **RBAC ENFORCED**: The tools automatically filter data based on the user's permissions. You don't need to filter further.

4. **BE DETERMINISTIC**: Always prefer calling tools over guessing. If uncertain, call a tool to get the data.

5. **RESPONSE FORMAT**:
   - Start with a brief summary (1-2 sentences)
   - Provide key insights as bullet points
   - Include specific numbers and percentages
   - Suggest follow-up questions when relevant

## AVAILABLE TOOLS

${availableTools
  .map(
    (t) => `- **${t.name}**: ${t.description.slice(0, 150)}${t.description.length > 150 ? "..." : ""}`
  )
  .join("\n")}

## USER CONTEXT

- User ID: ${context.userId}
- Roles: ${context.userRoleCodes.join(", ") || "None"}
- Accessible Schemes: ${context.accessibleSchemeIds.length} schemes
- Permissions: ${Array.from(context.permissions).join(", ")}

## RESPONSE GUIDELINES

1. Be concise and factual
2. Use tables for structured data when appropriate
3. Highlight critical issues (overdue items, low utilization)
4. Provide actionable insights
5. Never make up data - always use tools

If a tool returns an error, explain the error to the user and suggest alternatives.`;
}

// ============== LLM CLIENT ==============

async function callLLM(messages: LLMMessage[]): Promise<LLMResponse> {
  const startTime = Date.now();

  const response = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      "X-API-Key": LLM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: LLM_PROVIDER,
      model: LLM_MODEL,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name && { name: m.name }),
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
      })),
      tools: Array.from(toolRegistry.values()).map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: zodToJsonSchema(tool.parameters),
        },
      })),
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;

  return {
    id: data.id || crypto.randomUUID(),
    choices: data.choices || [{ message: data.message, finish_reason: "stop" }],
  };
}

/**
 * Convert Zod schema to JSON schema for OpenAI function calling
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Simplified conversion - in production, use zod-to-json-schema package
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToJsonType(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  return { type: "object" };
}

function zodTypeToJsonType(zodType: z.ZodTypeAny): Record<string, unknown> {
  if (zodType instanceof z.ZodString) {
    return { type: "string" };
  }
  if (zodType instanceof z.ZodNumber) {
    return { type: "number" };
  }
  if (zodType instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  if (zodType instanceof z.ZodEnum) {
    // Access enum values safely
    const values = (zodType as any)._def?.values || [];
    return { type: "string", enum: values };
  }
  if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodDefault) {
    // Access inner type safely
    const innerType = (zodType as any)._def?.innerType;
    if (innerType) {
      return zodTypeToJsonType(innerType as z.ZodType);
    }
    return { type: "string" };
  }
  if (zodType instanceof z.ZodUUID) {
    return { type: "string", format: "uuid" };
  }
  return { type: "string" };
}

// ============== TOOL EXECUTION ==============

async function executeTool(
  toolCall: ToolCall,
  context: ConversationContext,
  conversationId?: string
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolCall.function.name);

  if (!tool) {
    return {
      toolCallId: toolCall.id,
      role: "tool",
      name: toolCall.function.name,
      content: JSON.stringify({ error: `Tool not found: ${toolCall.function.name}` }),
    };
  }

  const startTime = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  let result: unknown;

  try {
    // Parse and validate parameters
    const params = JSON.parse(toolCall.function.arguments);

    // Always inject userId for RBAC
    params.userId = context.userId;

    // Validate with Zod
    const validated = tool.parameters.parse(params);

    // Execute the tool
    result = await tool.execute(validated);
    success = true;

    // Log successful execution
    await logToolExecution(context.userId, {
      conversationId,
      toolName: tool.name,
      parameters: validated,
      success: true,
      executionTimeMs: Date.now() - startTime,
      resultSummary: JSON.stringify(result).slice(0, 200),
    });
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : "Unknown error";
    result = { error: errorMessage };

    // Log failed execution
    await logToolExecution(context.userId, {
      conversationId,
      toolName: tool.name,
      parameters: { userId: context.userId },
      success: false,
      executionTimeMs: Date.now() - startTime,
      errorMessage,
    });
  }

  return {
    toolCallId: toolCall.id,
    role: "tool",
    name: toolCall.function.name,
    content: JSON.stringify(result),
  };
}

// ============== AGENT ORCHESTRATOR ==============

export interface AgentResult {
  response: string;
  toolCalls: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    success: boolean;
    executionTimeMs: number;
    errorMessage?: string;
  }>;
  llmRequests: number;
  totalExecutionTimeMs: number;
}

/**
 * Main agent orchestrator with tool-calling loop
 */
export async function runAgent(
  userId: string,
  userQuery: string,
  conversationHistory: LLMMessage[] = [],
  conversationId?: string
): Promise<AgentResult> {
  const startTime = Date.now();
  const totalStartTime = startTime;

  // Build conversation context with RBAC
  const context = await buildConversationContext(userId);

  // Analyze query for intent and entities
  const queryAnalysis = analyzeQuery(userQuery);
  const suggestedToolNames = suggestTools(queryAnalysis);

  // Initialize messages
  const messages: LLMMessage[] = [
    { role: "system", content: buildSystemPrompt(context) },
    ...conversationHistory,
    { role: "user", content: userQuery },
  ];

  // Inject tool suggestions in system context if high confidence
  if (queryAnalysis.confidence > 0.7 && suggestedToolNames.length > 0) {
    const suggestionText = `\n\nQuery analysis suggests using: ${suggestedToolNames.join(", ")}`;
    messages[0].content += suggestionText;
  }

  const toolCalls: AgentResult["toolCalls"] = [];
  let llmRequests = 0;
  let finalResponse = "";

  // Agent loop
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const iterationStart = Date.now();

    // Call LLM
    const llmResponse = await callLLM(messages);
    llmRequests++;

    // Log LLM request
    await logLLMRequest(userId, {
      conversationId,
      requestNumber: llmRequests,
      messageCount: messages.length,
      latencyMs: Date.now() - iterationStart,
      model: LLM_MODEL,
      provider: LLM_PROVIDER,
      finishReason: llmResponse.choices[0]?.finish_reason,
    });

    const assistantMessage = llmResponse.choices[0]?.message;

    if (!assistantMessage) {
      throw new Error("No response from LLM");
    }

    // Check if LLM wants to call tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Add assistant message to conversation
      messages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: assistantMessage.tool_calls,
      });

      // Execute tools in parallel
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map((tc) => executeTool(tc, context, conversationId))
      );

      // Add tool results to conversation
      for (const result of toolResults) {
        messages.push({
          role: "tool",
          content: result.content,
          tool_call_id: result.toolCallId,
          name: result.name,
        });

        // Track tool call
        const executedTool = toolRegistry.get(result.name);
        if (executedTool) {
          const resultData = JSON.parse(result.content);
          toolCalls.push({
            toolName: result.name,
            parameters: {}, // Simplified - actual params logged separately
            success: !resultData.error,
            executionTimeMs: Date.now() - iterationStart,
            errorMessage: resultData.error,
          });
        }
      }

      // Continue to next iteration for final response
      continue;
    }

    // Final response - no more tool calls
    finalResponse = assistantMessage.content || "I couldn't generate a response.";
    break;
  }

  const totalExecutionTimeMs = Date.now() - totalStartTime;

  // Log the complete interaction
  await logAIInteraction(userId, {
    userQuery,
    conversationId,
    toolCalls,
    llmRequests: Array.from({ length: llmRequests }, (_, i) => ({
      requestNumber: i + 1,
      messageCount: messages.length,
    })),
    finalResponse,
    totalExecutionTimeMs,
  });

  return {
    response: finalResponse,
    toolCalls,
    llmRequests,
    totalExecutionTimeMs,
  };
}

// ============== EXPORTS ==============

export { toolRegistry, buildConversationContext };
