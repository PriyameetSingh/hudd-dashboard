import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveFinancialEntryStatus } from "@/lib/financial-status";
import { getDashboardPrioritySchemeIds } from "@/lib/scheme-dashboard-priority";
import { getAuditRequestContext, logAudit } from "@/lib/audit";
import { getDbUserBySession, requireAnyPermission, toAuthErrorResponse } from "@/lib/server-rbac";

export const runtime = "nodejs";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

type PatchBody = {
  schemeCode: string;
  subschemeCode?: string | null;
  newBudgetCr: number;
  reason: string;
  financialYearLabel?: string;
};

export async function PATCH(request: NextRequest) {
  try {
    await requireAnyPermission("ENTER_FINANCIAL_DATA");

    const body = (await request.json()) as PatchBody;

    const scheme = await prisma.scheme.findUnique({
      where: { code: body.schemeCode },
      include: { subschemes: true },
    });
    if (!scheme) {
      return NextResponse.json({ detail: "Scheme not found" }, { status: 404 });
    }

    const fy = body.financialYearLabel
      ? await prisma.financialYear.findUnique({ where: { label: body.financialYearLabel } })
      : await prisma.financialYear.findFirst({ orderBy: { endDate: "desc" } });

    if (!fy) {
      return NextResponse.json({ detail: "Financial year not found" }, { status: 404 });
    }

    let subschemeId: string | null = null;
    if (body.subschemeCode?.trim()) {
      const sub = scheme.subschemes.find(
        (s) => s.code.toUpperCase() === body.subschemeCode!.trim().toUpperCase(),
      );
      if (!sub) {
        return NextResponse.json({ detail: "Subscheme not found for this scheme" }, { status: 404 });
      }
      subschemeId = sub.id;
    }

    const actor = await getDbUserBySession();
    const auditContext = getAuditRequestContext(request);

    const existing = await prisma.financeBudget.findFirst({
      where: { schemeId: scheme.id, subschemeId, financialYearId: fy.id },
    });

    if (existing) {
      if (existing.locked) {
        return NextResponse.json({ detail: "Budget is locked for this financial year." }, { status: 400 });
      }
      await prisma.financeBudgetRevision.create({
        data: {
          financeBudgetId: existing.id,
          oldBudgetEstimateCr: existing.budgetEstimateCr,
          newBudgetEstimateCr: body.newBudgetCr,
          reason: body.reason,
          createdById: actor?.id ?? null,
        },
      });
      await prisma.financeBudget.update({
        where: { id: existing.id },
        data: { budgetEstimateCr: body.newBudgetCr, createdById: actor?.id ?? null },
      });
      await logAudit(
        actor?.id,
        "financial.budget.revise",
        "finance_budgets",
        existing.id,
        { budgetEstimateCr: existing.budgetEstimateCr.toString() },
        { budgetEstimateCr: String(body.newBudgetCr), reason: body.reason },
        { ...auditContext, schemeId: scheme.id, subschemeId, financialYearId: fy.id },
      );
    } else {
      const created = await prisma.financeBudget.create({
        data: {
          schemeId: scheme.id,
          subschemeId,
          financialYearId: fy.id,
          budgetEstimateCr: body.newBudgetCr,
          createdById: actor?.id ?? null,
        },
      });
      await logAudit(
        actor?.id,
        "financial.budget.create",
        "finance_budgets",
        created.id,
        null,
        { budgetEstimateCr: String(body.newBudgetCr) },
        { ...auditContext, schemeId: scheme.id, subschemeId, financialYearId: fy.id },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    throw error;
  }
}

export async function GET() {
  try {
    await requireAnyPermission("VIEW_ALL_DATA", "VIEW_ASSIGNED_DATA");

    const actor = await getDbUserBySession();
    const roleIds = actor?.userRoles?.map((ur: { roleId: string }) => ur.roleId) ?? [];
    const priority = await getDashboardPrioritySchemeIds(actor?.id, roleIds);

    const fy = await prisma.financialYear.findFirst({
      orderBy: { endDate: "desc" },
    });

    if (!fy) {
      return NextResponse.json({ entries: [], financialYearLabel: null });
    }

    const schemes = await prisma.scheme.findMany({
      include: {
        vertical: true,
        subschemes: { orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });

    const budgets = await prisma.financeBudget.findMany({
      where: { financialYearId: fy.id },
      include: {
        scheme: { include: { vertical: true } },
        createdBy: { select: { name: true } },
        financialYear: { select: { label: true } },
        revisions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { createdBy: { select: { name: true } } },
        },
      },
    });

    const snapshots = await prisma.financeExpenditureSnapshot.findMany({
      where: { financialYearId: fy.id },
      orderBy: { asOfDate: "desc" },
      include: { createdBy: { select: { name: true } } },
    });

    const budgetsByScheme = new Map<string, typeof budgets>();
    for (const b of budgets) {
      const list = budgetsByScheme.get(b.schemeId) ?? [];
      list.push(b);
      budgetsByScheme.set(b.schemeId, list);
    }

    const snapshotsByScheme = new Map<string, typeof snapshots>();
    for (const s of snapshots) {
      const list = snapshotsByScheme.get(s.schemeId) ?? [];
      list.push(s);
      snapshotsByScheme.set(s.schemeId, list);
    }

    const entries = schemes.map((scheme) => {
      const schemeBudgets = budgetsByScheme.get(scheme.id) ?? [];
      const schemeSnapshots = snapshotsByScheme.get(scheme.id) ?? [];
      const subIds = new Set(scheme.subschemes.map((s) => s.id));

      let annualBudget = 0;
      let latest: (typeof snapshots)[number] | null = null;
      let so = 0;
      let ifms = 0;
      let aggregateWorkflow: "draft" | "submitted" = "draft";

      if (subIds.size > 0) {
        const subBudgetSum = schemeBudgets
          .filter((b) => b.subschemeId && subIds.has(b.subschemeId))
          .reduce((sum, b) => sum + toNumber(b.budgetEstimateCr), 0);
        const schemeLevelBudget = schemeBudgets.find((b) => b.subschemeId === null);
        annualBudget = subBudgetSum > 0 ? subBudgetSum : toNumber(schemeLevelBudget?.budgetEstimateCr ?? 0);

        const latestBySub = new Map<string, (typeof snapshots)[number]>();
        for (const snap of schemeSnapshots) {
          if (!snap.subschemeId || !subIds.has(snap.subschemeId)) continue;
          const prev = latestBySub.get(snap.subschemeId);
          if (!prev || snap.asOfDate > prev.asOfDate) {
            latestBySub.set(snap.subschemeId, snap);
          }
        }
      const subschemeDetails = scheme.subschemes.map((sub) => {
        const snap = latestBySub.get(sub.id);
        const budget = schemeBudgets.find((b) => b.subschemeId === sub.id);
        return {
          id: sub.id,
          code: sub.code,
          name: sub.name,
          so: toNumber(snap?.soExpenditureCr ?? 0),
          ifms: toNumber(snap?.ifmsExpenditureCr ?? 0),
          annualBudget: toNumber(budget?.budgetEstimateCr ?? 0),
        };
      });

      if (latestBySub.size > 0) {
        so = 0;
        ifms = 0;
        let maxDate = new Date(0);
        let anyDraft = false;
        for (const snap of latestBySub.values()) {
          so += toNumber(snap.soExpenditureCr);
          ifms += toNumber(snap.ifmsExpenditureCr);
          if (snap.asOfDate > maxDate) maxDate = snap.asOfDate;
          if (snap.workflowStatus === "draft") anyDraft = true;
          latest = snap;
        }
        aggregateWorkflow = anyDraft ? "draft" : "submitted";
        const refDate = maxDate.getTime() > 0 ? maxDate : latest?.asOfDate ?? new Date();
        const status = deriveFinancialEntryStatus({
          workflowStatus: aggregateWorkflow,
          asOfDate: refDate,
        });
        return buildEntry({
          scheme,
          schemeBudgets,
          latest,
          annualBudget,
          so,
          ifms,
          status,
          fyLabel: fy.label,
          priority,
          subschemeDetails,
        });
      }

      latest = null;
      so = 0;
      ifms = 0;
      aggregateWorkflow = "draft";
      return buildEntry({
        scheme,
        schemeBudgets,
        latest,
        annualBudget,
        so: 0,
        ifms: 0,
        status: "not_started",
        fyLabel: fy.label,
        priority,
        subschemeDetails,
      });
      } else {
        const row = schemeBudgets.find((b) => b.subschemeId === null);
        annualBudget = row ? toNumber(row.budgetEstimateCr) : 0;
        const schemeOnly = schemeSnapshots.filter((s) => s.subschemeId === null).sort((a, b) => b.asOfDate.getTime() - a.asOfDate.getTime());
        latest = schemeOnly[0] ?? null;
        if (latest) {
          so = toNumber(latest.soExpenditureCr);
          ifms = toNumber(latest.ifmsExpenditureCr);
          aggregateWorkflow = latest.workflowStatus === "submitted" ? "submitted" : "draft";
        }
      }

      const status = latest
        ? deriveFinancialEntryStatus({
            workflowStatus: aggregateWorkflow,
            asOfDate: latest.asOfDate,
          })
        : ("not_started" as const);

      return buildEntry({
        scheme,
        schemeBudgets,
        latest,
        annualBudget,
        so,
        ifms,
        status,
        fyLabel: fy.label,
        priority,
      });
    });

    entries.sort((a, b) => {
      const pa = priority.get(a.schemeId);
      const pb = priority.get(b.schemeId);
      if (pa !== undefined && pb === undefined) return -1;
      if (pa === undefined && pb !== undefined) return 1;
      if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb;
      return a.scheme.localeCompare(b.scheme);
    });

    return NextResponse.json({ entries, financialYearLabel: fy.label });
  } catch (error) {
    const auth = toAuthErrorResponse(error);
    if (auth) {
      return NextResponse.json({ detail: auth.detail }, { status: auth.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json(
        {
          detail:
            "Database schema is out of date. Run migrations: npx prisma migrate deploy",
        },
        { status: 500 },
      );
    }
    const detail =
      error instanceof Error ? error.message : "Failed to load financial budgets";
    return NextResponse.json({ detail }, { status: 500 });
  }
}

function buildEntry(params: {
  scheme: {
    id: string;
    code: string;
    name: string;
    vertical: { name: string };
    subschemes: Array<{ id: string; code: string; name: string }>;
  };
  schemeBudgets: Array<{
    id: string;
    subschemeId: string | null;
    locked: boolean;
    updatedAt: Date;
    createdBy: { name: string } | null;
    revisions: Array<{
      createdAt: Date;
      createdBy: { name: string } | null;
      reason: string;
    }>;
  }>;
  latest: {
    asOfDate: Date;
    soExpenditureCr: Prisma.Decimal;
    ifmsExpenditureCr: Prisma.Decimal;
    remarks: string | null;
    workflowStatus: "draft" | "submitted";
    createdBy: { name: string } | null;
  } | null;
  annualBudget: number;
  so: number;
  ifms: number;
  status: ReturnType<typeof deriveFinancialEntryStatus> | "not_started";
  fyLabel: string;
  priority: Map<string, number>;
  subschemeDetails?: Array<{ id: string; code: string; name: string; so: number; ifms: number; annualBudget: number }>;
}) {
  const { scheme, schemeBudgets, latest, annualBudget, so, ifms, status } = params;
  const budgetRow = schemeBudgets.find((b) => b.subschemeId === null) ?? schemeBudgets[0];
  const locked = budgetRow?.locked ?? false;

  return {
    id: scheme.code,
    schemeId: scheme.id,
    scheme: scheme.name,
    vertical: scheme.vertical.name,
    status,
    annualBudget,
    so,
    ifms,
    lastUpdated: (latest?.asOfDate ?? budgetRow?.updatedAt ?? new Date()).toISOString().slice(0, 10),
    locked,
    submitter: latest?.createdBy?.name ?? budgetRow?.createdBy?.name ?? "",
    updates: (budgetRow?.revisions ?? []).map((revision) => ({
      timestamp: revision.createdAt.toISOString().slice(0, 10),
      actor: revision.createdBy?.name ?? "",
      status,
      note: revision.reason,
      so: undefined,
      ifms: undefined,
    })),
    dashboardPriority: params.priority.has(scheme.id),
    subschemes: params.subschemeDetails ?? scheme.subschemes.map((s) => ({ id: s.id, code: s.code, name: s.name })),
  };
}
