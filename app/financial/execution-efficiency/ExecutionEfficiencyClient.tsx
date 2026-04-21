"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { UserRole } from "@/lib/auth";
import { Gauge, Lightbulb } from "lucide-react";

type SchemeFilter =
  | "all"
  | "SUJALA"
  | "MSBY"
  | "PMAY-U"
  | "AMRUT 2.0"
  | "SBM"
  | "Urban Mobility"
  | "Sewerage & Drainage";

type SchemeRow = {
  key: string;
  shortName: string;
  fullName: string;
  scoreLabel: string;
  physicalPct: number;
  financialPct: number;
  efficiencyLabel: string;
};

const SCHEME_FILTERS: { id: SchemeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "SUJALA", label: "SUJALA" },
  { id: "MSBY", label: "MSBY" },
  { id: "PMAY-U", label: "PMAY-U" },
  { id: "AMRUT 2.0", label: "AMRUT 2.0" },
  { id: "SBM", label: "SBM" },
  { id: "Urban Mobility", label: "Urban Mobility" },
  { id: "Sewerage & Drainage", label: "Sewerage & Drainage" },
];

const SCHEME_ROWS: SchemeRow[] = [
  { key: "sujala", shortName: "SUJALA", fullName: "SUJALA", scoreLabel: "–", physicalPct: 0, financialPct: 0, efficiencyLabel: "N/A" },
  { key: "msby", shortName: "MSBY", fullName: "MSBY", scoreLabel: "–", physicalPct: 0, financialPct: 0, efficiencyLabel: "N/A" },
  { key: "pmay", shortName: "PMAY", fullName: "PMAY-U", scoreLabel: "–", physicalPct: 0, financialPct: 0, efficiencyLabel: "N/A" },
  { key: "amrut", shortName: "AMRUT 2.0", fullName: "AMRUT 2.0", scoreLabel: "–", physicalPct: 0, financialPct: 0, efficiencyLabel: "N/A" },
  { key: "sbm", shortName: "SBM", fullName: "SBM", scoreLabel: "–", physicalPct: 0, financialPct: 0, efficiencyLabel: "N/A" },
  { key: "urban-mobility", shortName: "Urban Mobility", fullName: "Urban Mobility", scoreLabel: "–", physicalPct: 0, financialPct: 0, efficiencyLabel: "N/A" },
  { key: "sewerage", shortName: "Sewerage", fullName: "Sewerage & Drainage", scoreLabel: "–", physicalPct: 0, financialPct: 0, efficiencyLabel: "N/A" },
];

const RISK_INSIGHTS: string[] = [
  "FY 2026-27 — early in the fiscal year, no expenditure recorded yet.",
  "Total departmental budget: ₹10,726.87 Cr. Budget estimates unchanged from 1st meeting.",
  "Decision tracker shows 65 items carried forward; updated statuses for Metro Note (approved in Cabinet), Waterfront EFC (approved), and PM e-Bus Sewa (complied).",
  "Key focus: Cabinet proposals, Pothole-Free Cities certificates (93/115 ULBs submitted), and new PMAY ARH drive.",
];

function matchesFilter(row: SchemeRow, filter: SchemeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "PMAY-U") return row.key === "pmay";
  if (filter === "Sewerage & Drainage") return row.key === "sewerage";
  return row.fullName === filter || row.shortName === filter;
}

type Props = { userRole?: UserRole };

export default function ExecutionEfficiencyClient({ userRole }: Props) {
  const [schemeFilter, setSchemeFilter] = useState<SchemeFilter>("all");
  const isViewer = userRole === UserRole.VIEWER;

  const visibleRows = useMemo(
    () => SCHEME_ROWS.filter((r) => matchesFilter(r, schemeFilter)),
    [schemeFilter],
  );

  return (
    <AppShell title="Execution efficiency">
      <div className="relative space-y-8 px-6 py-6">
        {isViewer && (
          <div className="pointer-events-none absolute right-6 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Read-only
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)]">Financial vs physical</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            <Gauge className="size-7 shrink-0 text-[var(--sidebar-active-bg)]" aria-hidden />
            Execution Efficiency
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
            Financial vs Physical Progress · 2025-26 · Combined metric methodology under discussion
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SCHEME_FILTERS.map((f) => {
            const active = schemeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSchemeFilter(f.id)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--sidebar-active-bg)] bg-[var(--sidebar-active-bg)]/15 text-[var(--text-primary)]"
                    : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[var(--text-muted)]/40 hover:text-[var(--text-primary)]",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Financial vs Physical Progress</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Relative spend and delivery (illustrative quadrants)</p>
            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)]">
              <div className="flex min-h-[100px] flex-col justify-between bg-amber-50/80 p-3 dark:bg-amber-950/25">
                <span className="text-[10px] font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
                  Low financial %
                </span>
                <span className="text-xs font-medium leading-snug text-amber-950 dark:text-amber-100">
                  ⚠ Low spend
                  <br />
                  Low progress
                </span>
              </div>
              <div className="flex min-h-[100px] flex-col justify-between bg-emerald-50/80 p-3 dark:bg-emerald-950/25">
                <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-900/80 dark:text-emerald-200/90">
                  High financial %
                </span>
                <span className="text-xs font-medium leading-snug text-emerald-950 dark:text-emerald-100">
                  ⭐ Low spend
                  <br />
                  High progress
                </span>
              </div>
              <div className="flex min-h-[100px] flex-col justify-between bg-rose-50/80 p-3 dark:bg-rose-950/25">
                <span className="text-[10px] font-medium uppercase tracking-wide text-rose-900/80 dark:text-rose-200/90">
                  Low financial %
                </span>
                <span className="text-xs font-medium leading-snug text-rose-950 dark:text-rose-100">
                  ⚠ High spend
                  <br />
                  Low progress
                </span>
              </div>
              <div className="flex min-h-[100px] flex-col justify-between bg-sky-50/80 p-3 dark:bg-sky-950/25">
                <span className="text-[10px] font-medium uppercase tracking-wide text-sky-900/80 dark:text-sky-200/90">
                  High financial %
                </span>
                <span className="text-xs font-medium leading-snug text-sky-950 dark:text-sky-100">
                  ⚡ High spend
                  <br />
                  High progress
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                Efficient (≥1.2)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-slate-400" aria-hidden />
                Balanced (0.8–1.2)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" aria-hidden />
                Inefficient (&lt;0.8)
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Physical vs financial</h2>
            <div className="mt-4 flex min-h-[200px] flex-col items-stretch justify-center gap-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-primary)]/40 px-4 py-6">
              <p className="text-center text-xs font-semibold text-[var(--text-primary)]">Physical Progress (%)</p>
              <div className="relative mx-auto aspect-square w-full max-w-[180px] rounded-md border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--border)]" />
                <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[var(--border)]" />
              </div>
              <p className="text-center text-xs font-semibold text-[var(--text-primary)]">Financial (%)</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
              Scheme Execution Efficiency — Score = Physical% ÷ Financial% · &gt;1.2 Efficient · 0.8–1.2 Balanced · &lt;0.8
              Inefficient
            </p>
          </section>
        </div>

        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Scheme Execution Efficiency</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Score = Physical% ÷ Financial% · &gt;1.2 Efficient · 0.8–1.2 Balanced · &lt;0.8 Inefficient
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-primary)]/30 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-4 py-3 font-semibold">Scheme</th>
                  <th className="px-4 py-3 font-semibold">Programme</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Physical (%)</th>
                  <th className="px-4 py-3 font-semibold">Financial (%)</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.key} className="border-b border-[var(--border)]/80 last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.shortName}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{row.fullName}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text-muted)]">{row.scoreLabel}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text-primary)]">{row.physicalPct}%</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text-primary)]">{row.financialPct}%</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{row.efficiencyLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cost Efficiency Indicators</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Cost per output unit = Total Expenditure ÷ Physical Output
          </p>
        </section>

        <section className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              <Lightbulb className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Execution Risk Insights</h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                {RISK_INSIGHTS.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
