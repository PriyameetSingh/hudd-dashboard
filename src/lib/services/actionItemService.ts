import { mockActionItems } from "@/src/lib/mock-data";
import { ActionItem } from "@/types";

export async function fetchActionItems(): Promise<ActionItem[]> {
  return mockActionItems;
}

export async function getActionItemById(id: string): Promise<ActionItem | undefined> {
  return mockActionItems.find(item => item.id === id);
}
