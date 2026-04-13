/** Display order and labels for FY budget category lines (matches Prisma `FinanceYearBudgetCategory`). */
export const FINANCE_YEAR_BUDGET_CATEGORY_ORDER = [
  "STATE_SCHEME",
  "CENTRALLY_SPONSORED_SCHEME",
  "CENTRAL_SECTOR_SCHEME",
  "STATE_FINANCE_COMMISSION",
  "UNION_FINANCE_COMMISSION",
  "OTHER_TRANSFER_STAMP_DUTY",
  "ADMIN_EXPENDITURE",
] as const;

export type FinanceYearBudgetCategory = (typeof FINANCE_YEAR_BUDGET_CATEGORY_ORDER)[number];

export const FINANCE_YEAR_BUDGET_CATEGORY_LABELS: Record<FinanceYearBudgetCategory, string> = {
  STATE_SCHEME: "State scheme",
  CENTRALLY_SPONSORED_SCHEME: "Centrally sponsored scheme",
  CENTRAL_SECTOR_SCHEME: "Central sector scheme",
  STATE_FINANCE_COMMISSION: "State Finance Commission",
  UNION_FINANCE_COMMISSION: "Union Finance Commission",
  OTHER_TRANSFER_STAMP_DUTY: "Other / transfer / stamp duty",
  ADMIN_EXPENDITURE: "Admin expenditure",
};
