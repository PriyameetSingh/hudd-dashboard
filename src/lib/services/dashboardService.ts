import type { CommandCentreDashboard } from "@/lib/command-centre-dashboard";

export async function fetchCommandCentreDashboard(): Promise<CommandCentreDashboard> {
  const res = await fetch("/api/v1/dashboard/command-centre", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? `Dashboard failed (${res.status})`);
  }
  return res.json() as Promise<CommandCentreDashboard>;
}
