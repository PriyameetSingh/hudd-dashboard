-- Performance indexes (FK filters, list ordering, meeting scoping)

CREATE INDEX IF NOT EXISTS "schemes_verticalId_idx" ON "schemes"("verticalId");

CREATE INDEX IF NOT EXISTS "finance_budgets_financialYearId_idx" ON "finance_budgets"("financialYearId");

CREATE INDEX IF NOT EXISTS "finance_budget_revisions_financeBudgetId_idx" ON "finance_budget_revisions"("financeBudgetId");

CREATE INDEX IF NOT EXISTS "kpi_definitions_schemeId_idx" ON "kpi_definitions"("schemeId");

CREATE INDEX IF NOT EXISTS "dashboard_meetings_meetingDate_idx" ON "dashboard_meetings"("meetingDate");

CREATE INDEX IF NOT EXISTS "meeting_topics_meetingId_idx" ON "meeting_topics"("meetingId");

CREATE INDEX IF NOT EXISTS "action_items_status_dueDate_idx" ON "action_items"("status", "dueDate");

CREATE INDEX IF NOT EXISTS "action_items_meetingId_idx" ON "action_items"("meetingId");
