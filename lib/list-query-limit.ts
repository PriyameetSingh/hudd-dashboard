/** Default cap for unbounded list APIs (`take`). */
export const DEFAULT_LIST_LIMIT = 1000;

export const MAX_LIST_LIMIT = 2000;

export function parseListLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  if (raw === null) return DEFAULT_LIST_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(n, MAX_LIST_LIMIT);
}
