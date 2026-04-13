-- CreateEnum
CREATE TYPE "FinanceYearBudgetCategory" AS ENUM ('STATE_SCHEME', 'CENTRALLY_SPONSORED_SCHEME', 'CENTRAL_SECTOR_SCHEME', 'STATE_FINANCE_COMMISSION', 'UNION_FINANCE_COMMISSION', 'OTHER_TRANSFER_STAMP_DUTY', 'ADMIN_EXPENDITURE');

-- CreateTable
CREATE TABLE "finance_year_budget_allocations" (
    "id" UUID NOT NULL,
    "financialYearId" UUID NOT NULL,
    "totalBudgetCr" DECIMAL(16,2) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_year_budget_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_year_budget_category_lines" (
    "id" UUID NOT NULL,
    "allocationId" UUID NOT NULL,
    "category" "FinanceYearBudgetCategory" NOT NULL,
    "budgetEstimateCr" DECIMAL(16,2) NOT NULL,
    "soExpenditureCr" DECIMAL(16,2) NOT NULL,
    "ifmsExpenditureCr" DECIMAL(16,2) NOT NULL,

    CONSTRAINT "finance_year_budget_category_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_year_budget_allocations_financialYearId_key" ON "finance_year_budget_allocations"("financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_year_budget_category_lines_allocationId_category_key" ON "finance_year_budget_category_lines"("allocationId", "category");

-- AddForeignKey
ALTER TABLE "finance_year_budget_allocations" ADD CONSTRAINT "finance_year_budget_allocations_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_year_budget_allocations" ADD CONSTRAINT "finance_year_budget_allocations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_year_budget_category_lines" ADD CONSTRAINT "finance_year_budget_category_lines_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "finance_year_budget_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
