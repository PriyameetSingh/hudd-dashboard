import { prisma } from "@/lib/prisma";

/** Returns scheme ids the user should see first on dashboards (lower sortOrder = higher priority). */
export async function getDashboardPrioritySchemeIds(userId: string | undefined, roleIds: string[]): Promise<Map<string, number>> {
  const priority = new Map<string, number>();
  if (!userId && roleIds.length === 0) return priority;

  const or: Array<{ userId: string } | { roleId: { in: string[] } }> = [];
  if (userId) or.push({ userId });
  if (roleIds.length) or.push({ roleId: { in: roleIds } });
  if (or.length === 0) return priority;

  const rows = await prisma.schemeAssignment.findMany({
    where: {
      assignmentKind: "dashboard_owner",
      OR: or,
    },
    select: { schemeId: true, sortOrder: true },
  });

  for (const row of rows) {
    const prev = priority.get(row.schemeId);
    const next = row.sortOrder;
    if (prev === undefined || next < prev) {
      priority.set(row.schemeId, next);
    }
  }
  return priority;
}

export function compareByDashboardPriority<T extends { schemeId?: string; id?: string }>(
  a: T,
  b: T,
  schemeIdFor: (row: T) => string | undefined,
  priority: Map<string, number>,
): number {
  const idA = schemeIdFor(a);
  const idB = schemeIdFor(b);
  const pa = idA !== undefined ? priority.get(idA) : undefined;
  const pb = idB !== undefined ? priority.get(idB) : undefined;
  const aFirst = pa !== undefined;
  const bFirst = pb !== undefined;
  if (aFirst && !bFirst) return -1;
  if (!aFirst && bFirst) return 1;
  if (aFirst && bFirst && pa !== pb) return (pa ?? 0) - (pb ?? 0);
  return 0;
}
