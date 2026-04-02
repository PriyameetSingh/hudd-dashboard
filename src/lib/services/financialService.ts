import { mockFinancialEntries } from "@/src/lib/mock-data";
import { FinancialEntry } from "@/types";

export async function getFinancialEntries(): Promise<FinancialEntry[]> {
  return mockFinancialEntries;
}

export async function getFinancialEntryById(id: string): Promise<FinancialEntry | undefined> {
  return mockFinancialEntries.find(entry => entry.id === id);
}
