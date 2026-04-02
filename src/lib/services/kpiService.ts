import { mockKPISubmissions } from "@/src/lib/mock-data";
import { KPISubmission } from "@/types";

export async function fetchKPISubmissions(): Promise<KPISubmission[]> {
  return mockKPISubmissions;
}

export async function getKPISubmissionById(id: string): Promise<KPISubmission | undefined> {
  return mockKPISubmissions.find(submission => submission.id === id);
}
