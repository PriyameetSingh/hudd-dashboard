/**
 * Clears scheme, budget, KPI, meeting, and action-item data while keeping:
 *   users, roles, permissions, role_permissions, user_roles, user_permission_overrides,
 *   verticals, financial_years
 *
 * Run:
 *   npx tsx prisma/clear_mock_data.ts --yes
 *
 * Or set CLEAR_DB_YES=1 to skip the confirmation prompt (e.g. in CI).
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const prisma = new PrismaClient();

/** Physical table names (@@map) — order does not matter when using CASCADE. */
const TABLES_TO_TRUNCATE = [
  "audit_log",
  "action_item_proofs",
  "files",
  "action_item_updates",
  "action_items",
  "meeting_materials",
  "meeting_topics",
  "dashboard_meetings",
  "kpi_measurements",
  "kpi_targets",
  "kpi_definitions",
  "finance_budget_revisions",
  "finance_budgets",
  "finance_expenditure_snapshots",
  "finance_summary_heads",
  "finance_budget_supplements",
  "finance_year_budget_category_lines",
  "finance_year_budget_allocations",
  "scheme_workflow_configs",
  "scheme_assignments",
  "subschemes",
  "schemes",
] as const;

async function main() {
  const yes =
    process.argv.includes("--yes") ||
    process.argv.includes("-y") ||
    process.env.CLEAR_DB_YES === "1";

  if (!yes) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      'This will DELETE all scheme/budget/KPI/meeting/action data (users & reference rows stay). Type "yes" to continue: ',
    );
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  const quoted = TABLES_TO_TRUNCATE.map((t) => `"${t}"`).join(", ");

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
    );
  });

  console.log(
    `Done. Truncated ${TABLES_TO_TRUNCATE.length} tables (users, roles, permissions, verticals, financial_years preserved).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
