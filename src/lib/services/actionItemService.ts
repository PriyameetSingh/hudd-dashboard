import { ActionItem } from "@/types";

type ActionItemsResponse = {
  items: ActionItem[];
};

type ActionItemResponse = {
  item: ActionItem;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Failed to load action items");
  }
  return response.json() as Promise<T>;
}

export async function fetchActionItems(): Promise<ActionItem[]> {
  const response = await fetch("/api/v1/action-items", { cache: "no-store" });
  const data = await parseResponse<ActionItemsResponse>(response);
  return data.items;
}

export async function getActionItemById(id: string): Promise<ActionItem | undefined> {
  const response = await fetch(`/api/v1/action-items/${id}`, { cache: "no-store" });
  if (response.status === 404) return undefined;
  const data = await parseResponse<ActionItemResponse>(response);
  return data.item;
}

export async function updateActionItem(id: string, input: {
  status?: ActionItem["status"];
  note?: string;
}): Promise<void> {
  const response = await fetch(`/api/v1/action-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseResponse<{ ok: boolean }>(response);
}

export async function addActionItemProof(id: string, input: {
  name: string;
  url: string;
}): Promise<void> {
  const response = await fetch(`/api/v1/action-items/${id}/proofs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseResponse<{ ok: boolean }>(response);
}
