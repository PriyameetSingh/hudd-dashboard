/** FY starts 1 April — months Jan–Mar belong to previous FY label. */
export function getFinancialYear(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month < 3 ? year - 1 : year;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
