import { KPISubmission } from "@/types";

type KPIResponse = {
  submissions: KPISubmission[];
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Failed to load KPI data");
  }
  return response.json() as Promise<T>;
}

export async function fetchKPISubmissions(): Promise<KPISubmission[]> {
  const response = await fetch("/api/v1/kpis/definitions", { cache: "no-store" });
  const data = await parseResponse<KPIResponse>(response);
  return data.submissions;
}

export async function getKPISubmissionById(id: string): Promise<KPISubmission | undefined> {
  const rows = await fetchKPISubmissions();
  return rows.find((submission) => submission.id === id);
}

export async function submitKPIMeasurement(input: {
  kpiDefinitionId: string;
  financialYearLabel: string;
  measuredAt: string;
  numeratorValue?: number | null;
  yesValue?: boolean | null;
  remarks?: string;
  workflowStatus?: "draft" | "submitted";
}): Promise<void> {
  const response = await fetch("/api/v1/kpis/measurements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseResponse<{ ok: boolean }>(response);
}
