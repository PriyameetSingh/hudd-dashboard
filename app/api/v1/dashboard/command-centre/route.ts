import { NextResponse } from "next/server";
import { getCommandCentreDashboard } from "@/lib/command-centre-dashboard";
import { requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");
    const data = await getCommandCentreDashboard();
    return NextResponse.json(data);
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}
