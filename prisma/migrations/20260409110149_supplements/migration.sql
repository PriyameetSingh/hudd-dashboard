-- AlterTable
ALTER TABLE "action_items" ALTER COLUMN "meetingId" DROP NOT NULL,
ALTER COLUMN "schemeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "finance_budget_supplements" (
    "id" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "subschemeId" UUID,
    "financialYearId" UUID NOT NULL,
    "amountCr" DECIMAL(16,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceNo" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_budget_supplements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_budget_supplements_schemeId_financialYearId_idx" ON "finance_budget_supplements"("schemeId", "financialYearId");

-- AddForeignKey
ALTER TABLE "finance_budget_supplements" ADD CONSTRAINT "finance_budget_supplements_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budget_supplements" ADD CONSTRAINT "finance_budget_supplements_subschemeId_fkey" FOREIGN KEY ("subschemeId") REFERENCES "subschemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budget_supplements" ADD CONSTRAINT "finance_budget_supplements_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budget_supplements" ADD CONSTRAINT "finance_budget_supplements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
