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

/** Derived from scheme-level budgets, supplements, and expenditure (by sponsorship type). */
export const FINANCE_YEAR_SCHEME_BUDGET_CATEGORIES = [
  "STATE_SCHEME",
  "CENTRALLY_SPONSORED_SCHEME",
  "CENTRAL_SECTOR_SCHEME",
] as const satisfies readonly FinanceYearBudgetCategory[];

/** Entered only from the FY summary entry page (not overwritten by scheme sync). */
export const FINANCE_YEAR_MANUAL_BUDGET_CATEGORIES = [
  "STATE_FINANCE_COMMISSION",
  "UNION_FINANCE_COMMISSION",
  "OTHER_TRANSFER_STAMP_DUTY",
  "ADMIN_EXPENDITURE",
] as const satisfies readonly FinanceYearBudgetCategory[];

export type FinanceYearManualBudgetCategory = (typeof FINANCE_YEAR_MANUAL_BUDGET_CATEGORIES)[number];

export const FINANCE_YEAR_BUDGET_CATEGORY_LABELS: Record<FinanceYearBudgetCategory, string> = {
  STATE_SCHEME: "State Sector Scheme",
  CENTRALLY_SPONSORED_SCHEME: "Centrally Sponsored Scheme",
  CENTRAL_SECTOR_SCHEME: "Central Sector Scheme",
  STATE_FINANCE_COMMISSION: "State Finance Commission",
  UNION_FINANCE_COMMISSION: "Union Finance Commission",
  OTHER_TRANSFER_STAMP_DUTY: "Other Transfer (Stamp Duty)",
  ADMIN_EXPENDITURE: "Admin. Expenditure",
};
