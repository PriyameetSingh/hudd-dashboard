-- CreateEnum (skip if already applied)
DO $$ BEGIN
  CREATE TYPE "FinancialWorkflowStatus" AS ENUM ('draft', 'submitted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (skip if column already exists — e.g. manual fix or partial apply)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'finance_expenditure_snapshots'
      AND a.attname = 'workflowStatus'
      AND NOT a.attisdropped
  ) THEN
    ALTER TABLE "finance_expenditure_snapshots" ADD COLUMN "workflowStatus" "FinancialWorkflowStatus" NOT NULL DEFAULT 'draft';
  END IF;
END $$;

-- Deduplicate before unique index (keep latest createdAt per logical key)
DELETE FROM "finance_expenditure_snapshots" a
USING "finance_expenditure_snapshots" b
WHERE a.id < b.id
  AND a."schemeId" = b."schemeId"
  AND a."financialYearId" = b."financialYearId"
  AND a."asOfDate" = b."asOfDate"
  AND (a."subschemeId" IS NOT DISTINCT FROM b."subschemeId");

-- Enforce one row per scheme/subscheme/fy/date
CREATE UNIQUE INDEX IF NOT EXISTS "finance_expenditure_snapshots_scheme_subscheme_fy_date_key"
ON "finance_expenditure_snapshots" (
  "schemeId",
  "financialYearId",
  "asOfDate",
  COALESCE("subschemeId", '00000000-0000-0000-0000-000000000000'::uuid)
);
