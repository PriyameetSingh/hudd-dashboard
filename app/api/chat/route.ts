import { NextRequest, NextResponse } from "next/server";
import { getDbUserBySession, requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const LLM_API_URL = process.env.LLM_API_URL!;
const LLM_API_KEY = process.env.LLM_API_KEY!;
const LLM_PROVIDER = process.env.LLM_PROVIDER || "airawat";
const LLM_MODEL = process.env.LLM_MODEL || "qwen3-30b-a3b-instruct";

// Fetch dashboard data for context
async function getDashboardContext(userId: string | null, userRole: string | null) {
  try {
    const [
      schemes,
      verticals,
      actionItems,
      kpiMeasurements,
      financeSnapshots,
      meetings,
    ] = await Promise.all([
      prisma.scheme.count(),
      prisma.vertical.count(),
      prisma.actionItem.count({
        where: {
          AND: [
            { status: { not: "COMPLETED" } },
            { dueDate: { lt: new Date() } },
          ],
        },
      }),
      prisma.kpiMeasurement.count({
        where: { workflowStatus: { in: ["submitted", "rejected"] } },
      }),
      prisma.financeExpenditureSnapshot.count({
        where: { workflowStatus: "submitted" },
      }),
      prisma.dashboardMeeting.count(),
    ]);

    return {
      totalSchemes: schemes,
      totalVerticals: verticals,
      overdueActionItems: actionItems,
      pendingKpiSubmissions: kpiMeasurements,
      pendingFinancialEntries: financeSnapshots,
      upcomingMeetings: meetings,
      userRole: userRole || "GUEST",
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const body = await request.json();
    const { messages, query } = body as { messages?: Array<{ role: string; content: string }>; query?: string };

    const user = await getDbUserBySession();
    const userRoleCode = user?.userRoles?.[0]?.role?.code ?? null;
    const context = await getDashboardContext(user?.id ?? null, userRoleCode);

    // Build system message with context
    const systemPrompt = `You are NEXUS, an AI assistant for the HUDD (Haryana Urban Development Department) dashboard.

Current Dashboard Context:
- Total Schemes: ${context?.totalSchemes ?? "N/A"}
- Total Verticals: ${context?.totalVerticals ?? "N/A"}
- Overdue Action Items: ${context?.overdueActionItems ?? "N/A"}
- Pending KPI Submissions: ${context?.pendingKpiSubmissions ?? "N/A"}
- Pending Financial Entries: ${context?.pendingFinancialEntries ?? "N/A"}
- Upcoming Meetings: ${context?.upcomingMeetings ?? "N/A"}
- User Role: ${context?.userRole ?? "GUEST"}

You help users query about schemes, KPIs, action items, financial data, and meetings.
Provide concise, accurate responses based on the available data.
If you don't have specific information, say so clearly.`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    if (query && !messages?.length) {
      chatMessages.push({ role: "user", content: query });
    }

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": LLM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: LLM_PROVIDER,
        model: LLM_MODEL,
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }

    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process chat request" },
      { status: 500 }
    );
  }
}
