-- CreateEnum
CREATE TYPE "SponsorshipType" AS ENUM ('STATE', 'CENTRAL', 'CENTRAL_SECTOR');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('financial', 'kpi', 'action_item');

-- CreateEnum
CREATE TYPE "SchemeAssignmentKind" AS ENUM ('dashboard_owner', 'kpi_owner_1', 'kpi_owner_2', 'action_item_owner_1', 'action_item_owner_2');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "KPICategory" AS ENUM ('STATE', 'CENTRAL');

-- CreateEnum
CREATE TYPE "KPIType" AS ENUM ('OUTPUT', 'OUTCOME', 'BINARY');

-- CreateEnum
CREATE TYPE "KPIWorkflowStatus" AS ENUM ('draft', 'submitted', 'reviewed', 'rejected');

-- CreateEnum
CREATE TYPE "KPIProgressStatus" AS ENUM ('on_track', 'delayed', 'overdue');

-- CreateEnum
CREATE TYPE "ActionItemType" AS ENUM ('action_item', 'meeting_decision');

-- CreateEnum
CREATE TYPE "ActionItemPriority" AS ENUM ('Critical', 'High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PROOF_UPLOADED', 'UNDER_REVIEW', 'COMPLETED', 'OVERDUE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verticals" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verticals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schemes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "verticalId" UUID NOT NULL,
    "sponsorshipType" "SponsorshipType" NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subschemes" (
    "id" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subschemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_assignments" (
    "id" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "subschemeId" UUID,
    "assignmentKind" "SchemeAssignmentKind" NOT NULL,
    "userId" UUID,
    "roleId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheme_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_workflow_configs" (
    "id" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "workflowType" "WorkflowType" NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheme_workflow_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_budgets" (
    "id" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "subschemeId" UUID,
    "financialYearId" UUID NOT NULL,
    "budgetEstimateCr" DECIMAL(16,2) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_budget_revisions" (
    "id" UUID NOT NULL,
    "financeBudgetId" UUID NOT NULL,
    "oldBudgetEstimateCr" DECIMAL(16,2) NOT NULL,
    "newBudgetEstimateCr" DECIMAL(16,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_budget_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_expenditure_snapshots" (
    "id" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "subschemeId" UUID,
    "financialYearId" UUID NOT NULL,
    "asOfDate" DATE NOT NULL,
    "soExpenditureCr" DECIMAL(16,2) NOT NULL,
    "ifmsExpenditureCr" DECIMAL(16,2) NOT NULL,
    "remarks" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_expenditure_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_summary_heads" (
    "id" UUID NOT NULL,
    "financialYearId" UUID NOT NULL,
    "headCode" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "budgetEstimateCr" DECIMAL(16,2) NOT NULL,
    "soExpenditureCr" DECIMAL(16,2) NOT NULL,
    "ifmsExpenditureCr" DECIMAL(16,2) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_summary_heads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "id" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "subschemeId" UUID,
    "category" "KPICategory" NOT NULL,
    "description" TEXT NOT NULL,
    "kpiType" "KPIType" NOT NULL,
    "numeratorUnit" TEXT,
    "denominatorUnit" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_targets" (
    "id" UUID NOT NULL,
    "kpiDefinitionId" UUID NOT NULL,
    "financialYearId" UUID NOT NULL,
    "denominatorValue" DECIMAL(16,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_measurements" (
    "id" UUID NOT NULL,
    "kpiTargetId" UUID NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "numeratorValue" DECIMAL(16,2),
    "yesValue" BOOLEAN,
    "progressStatus" "KPIProgressStatus" NOT NULL,
    "workflowStatus" "KPIWorkflowStatus" NOT NULL,
    "remarks" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "kpi_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_meetings" (
    "id" UUID NOT NULL,
    "meetingDate" DATE NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_topics" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "schemeId" UUID NOT NULL,
    "subschemeId" UUID,
    "verticalId" UUID,
    "itemType" "ActionItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "ActionItemPriority" NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "ActionItemStatus" NOT NULL,
    "assignedToId" UUID,
    "reviewerId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_item_updates" (
    "id" UUID NOT NULL,
    "actionItemId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "status" "ActionItemStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_item_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedById" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_item_proofs" (
    "id" UUID NOT NULL,
    "actionItemId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "uploadedById" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_item_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" UUID,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_code_key" ON "users"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_userId_permissionId_key" ON "user_permission_overrides"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "verticals_code_key" ON "verticals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_label_key" ON "financial_years"("label");

-- CreateIndex
CREATE UNIQUE INDEX "schemes_code_key" ON "schemes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subschemes_schemeId_code_key" ON "subschemes"("schemeId", "code");

-- CreateIndex
CREATE INDEX "scheme_assignments_schemeId_assignmentKind_idx" ON "scheme_assignments"("schemeId", "assignmentKind");

-- CreateIndex
CREATE UNIQUE INDEX "scheme_workflow_configs_schemeId_workflowType_key" ON "scheme_workflow_configs"("schemeId", "workflowType");

-- CreateIndex
CREATE UNIQUE INDEX "finance_budgets_schemeId_subschemeId_financialYearId_key" ON "finance_budgets"("schemeId", "subschemeId", "financialYearId");

-- CreateIndex
CREATE INDEX "finance_expenditure_snapshots_schemeId_financialYearId_asOf_idx" ON "finance_expenditure_snapshots"("schemeId", "financialYearId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "finance_summary_heads_financialYearId_headCode_asOfDate_key" ON "finance_summary_heads"("financialYearId", "headCode", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_targets_kpiDefinitionId_financialYearId_key" ON "kpi_targets"("kpiDefinitionId", "financialYearId");

-- CreateIndex
CREATE INDEX "kpi_measurements_kpiTargetId_measuredAt_idx" ON "kpi_measurements"("kpiTargetId", "measuredAt");

-- CreateIndex
CREATE INDEX "action_item_updates_actionItemId_timestamp_idx" ON "action_item_updates"("actionItemId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "action_item_proofs_actionItemId_fileId_key" ON "action_item_proofs"("actionItemId", "fileId");

-- CreateIndex
CREATE INDEX "audit_log_occurredAt_idx" ON "audit_log"("occurredAt");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schemes" ADD CONSTRAINT "schemes_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "verticals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schemes" ADD CONSTRAINT "schemes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subschemes" ADD CONSTRAINT "subschemes_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subschemes" ADD CONSTRAINT "subschemes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_assignments" ADD CONSTRAINT "scheme_assignments_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_assignments" ADD CONSTRAINT "scheme_assignments_subschemeId_fkey" FOREIGN KEY ("subschemeId") REFERENCES "subschemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_assignments" ADD CONSTRAINT "scheme_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_assignments" ADD CONSTRAINT "scheme_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_workflow_configs" ADD CONSTRAINT "scheme_workflow_configs_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_subschemeId_fkey" FOREIGN KEY ("subschemeId") REFERENCES "subschemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budgets" ADD CONSTRAINT "finance_budgets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budget_revisions" ADD CONSTRAINT "finance_budget_revisions_financeBudgetId_fkey" FOREIGN KEY ("financeBudgetId") REFERENCES "finance_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_budget_revisions" ADD CONSTRAINT "finance_budget_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_expenditure_snapshots" ADD CONSTRAINT "finance_expenditure_snapshots_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_expenditure_snapshots" ADD CONSTRAINT "finance_expenditure_snapshots_subschemeId_fkey" FOREIGN KEY ("subschemeId") REFERENCES "subschemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_expenditure_snapshots" ADD CONSTRAINT "finance_expenditure_snapshots_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_expenditure_snapshots" ADD CONSTRAINT "finance_expenditure_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_summary_heads" ADD CONSTRAINT "finance_summary_heads_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_summary_heads" ADD CONSTRAINT "finance_summary_heads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_subschemeId_fkey" FOREIGN KEY ("subschemeId") REFERENCES "subschemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_kpiDefinitionId_fkey" FOREIGN KEY ("kpiDefinitionId") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_measurements" ADD CONSTRAINT "kpi_measurements_kpiTargetId_fkey" FOREIGN KEY ("kpiTargetId") REFERENCES "kpi_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_measurements" ADD CONSTRAINT "kpi_measurements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_measurements" ADD CONSTRAINT "kpi_measurements_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_meetings" ADD CONSTRAINT "dashboard_meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_topics" ADD CONSTRAINT "meeting_topics_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "dashboard_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_topics" ADD CONSTRAINT "meeting_topics_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "dashboard_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_subschemeId_fkey" FOREIGN KEY ("subschemeId") REFERENCES "subschemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "verticals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_item_updates" ADD CONSTRAINT "action_item_updates_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "action_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_item_updates" ADD CONSTRAINT "action_item_updates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_item_proofs" ADD CONSTRAINT "action_item_proofs_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "action_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_item_proofs" ADD CONSTRAINT "action_item_proofs_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_item_proofs" ADD CONSTRAINT "action_item_proofs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
