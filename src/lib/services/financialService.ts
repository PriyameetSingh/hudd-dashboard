import { FinancialEntry } from "@/types";

type FinancialEntriesResponse = {
  entries: FinancialEntry[];
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Failed to load financial data");
  }
  return response.json() as Promise<T>;
}

export async function getFinancialEntries(): Promise<FinancialEntry[]> {
  const response = await fetch("/api/v1/financial/budgets", { cache: "no-store" });
  const data = await parseResponse<FinancialEntriesResponse>(response);
  return data.entries;
}

export async function getFinancialEntryById(id: string): Promise<FinancialEntry | undefined> {
  const entries = await getFinancialEntries();
  return entries.find((entry) => entry.id === id);
}

export async function submitFinancialSnapshot(input: {
  schemeCode: string;
  asOfDate: string;
  soExpenditureCr: number;
  ifmsExpenditureCr: number;
  remarks?: string;
}): Promise<void> {
  const response = await fetch("/api/v1/financial/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseResponse<{ ok: boolean }>(response);
}
