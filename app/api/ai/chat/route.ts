import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent, AgentResult } from "@/lib/ai/orchestrator";
import { startConversation } from "@/lib/ai/logging";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";
import { getDbUserBySession } from "@/lib/server-rbac";

export const runtime = "nodejs";

// Request validation schema
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export interface ChatResponse {
  success: boolean;
  response?: string;
  conversationId?: string;
  meta?: {
    toolCalls: number;
    llmRequests: number;
    executionTimeMs: number;
  };
  error?: string;
}

/**
 * POST /api/ai/chat
 * Main chat endpoint with tool-calling AI
 */
export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const startTime = Date.now();

  try {
    // Check permissions
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    // Get current user
    const user = await getDbUserBySession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = ChatRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request: ${validation.error.issues.map((e: { message: string }) => e.message).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { message, conversationId, history } = validation.data;

    // Start new conversation if needed
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await startConversation(user.id, message);
    }

    // Run the AI agent
    const result = await runAgent(
      user.id,
      message,
      history.map((h) => ({ role: h.role, content: h.content })),
      currentConversationId
    );

    const response: ChatResponse = {
      success: true,
      response: result.response,
      conversationId: currentConversationId,
      meta: {
        toolCalls: result.toolCalls.length,
        llmRequests: result.llmRequests,
        executionTimeMs: Date.now() - startTime,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    // Check for auth errors
    const authError = toAuthErrorResponse(error);
    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.detail },
        { status: authError.status }
      );
    }

    // Log and return generic error
    console.error("AI Chat API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process chat request",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat/health
 * Health check endpoint for the AI service
 */
export async function GET(): Promise<NextResponse<{ status: string }>> {
  return NextResponse.json({
    status: "ok",
    features: {
      toolCalling: true,
      rbacEnforced: true,
      queryUnderstanding: true,
      auditLogging: true,
    },
  });
}
