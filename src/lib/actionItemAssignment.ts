import type { ActionItem, MockUser } from "@/types";
import { canAccessMyTasksHub } from "@/src/lib/auth";

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/** Same rules as `app/action-items/[id]/page.tsx` — code match, else display name match. */
export function isAssignedActionOfficer(item: ActionItem, u: { id: string; name: string }): boolean {
  const code = item.assignedToUserCode?.trim().toLowerCase();
  if (code && code === u.id.trim().toLowerCase()) return true;
  return normalize(item.assignedTo) === normalize(u.name);
}

export function isPendingActionItem(item: ActionItem): boolean {
  return item.status !== "COMPLETED";
}

export function hasPendingAssignedActionItems(items: ActionItem[], user: MockUser): boolean {
  return items.some((item) => isAssignedActionOfficer(item, user) && isPendingActionItem(item));
}

export function hasAnyAssignedActionItems(items: ActionItem[], user: MockUser): boolean {
  return items.some((item) => isAssignedActionOfficer(item, user));
}

export function filterAssignedPendingActionItems(items: ActionItem[], user: MockUser): ActionItem[] {
  return items.filter((item) => isAssignedActionOfficer(item, user) && isPendingActionItem(item));
}

/** Sidebar /my-tasks: financial-KPI-action permissions, or at least one pending item assigned to this user. */
export function canSeeMyTasksNav(user: MockUser | null, actionItems: ActionItem[]): boolean {
  if (!user) return false;
  if (canAccessMyTasksHub(user)) return true;
  return hasPendingAssignedActionItems(actionItems, user);
}
