-- Improve groupBy / filters on financialYearId + asOfDate (snapshot-dates, ifms-timeseries, command-centre trends).
CREATE INDEX IF NOT EXISTS "finance_expenditure_snapshots_financialYearId_asOfDate_idx"
  ON "finance_expenditure_snapshots" ("financialYearId", "asOfDate");

CREATE INDEX IF NOT EXISTS "finance_summary_heads_financialYearId_asOfDate_idx"
  ON "finance_summary_heads" ("financialYearId", "asOfDate");
