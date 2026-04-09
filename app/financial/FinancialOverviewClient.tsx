"use client";

import React, { useMemo } from "react";
import AppShell from "@/components/AppShell";
import type { FinanceSummaryBreakdown } from "@/lib/financial-budget-entries";
import { UserRole } from "@/lib/auth";
import type { FinancialEntry } from "@/types";

function formatCurrency(value: number) {
  return `₹${value.toFixed(1)} Cr`;
}

type Props = {
  entries: FinancialEntry[];
  financialYearLabel: string | null;
  summary: FinanceSummaryBreakdown | null;
  userRole?: UserRole;
};

export default function FinancialOverviewClient({
  entries,
  financialYearLabel,
  summary,
  userRole,
}: Props) {
  const summaryTotals = useMemo(() => {
    const totalBudget = entries.reduce((sum, entry) => sum + entry.annualBudget, 0);
    const totalSo = entries.reduce((sum, entry) => sum + entry.so, 0);
    const totalIfms = entries.reduce((sum, entry) => sum + entry.ifms, 0);
    const pct = totalBudget ? ((totalIfms / totalBudget) * 100).toFixed(1) : "0.0";
    return { totalBudget, totalSo, totalIfms, pct };
  }, [entries]);

  const isViewer = userRole === UserRole.VIEWER;
  const fyDisplay = financialYearLabel ?? "—";

  return (
    <AppShell title="Financial Overview">
      <div className="relative space-y-6 px-6 py-6">
        {isViewer && (
          <div className="pointer-events-none absolute right-6 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Read-only
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">{fyDisplay}</p>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Financial Command View</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Live SO vs IFMS from finance budgets and expenditure snapshots (database).
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total Budget", value: formatCurrency(summaryTotals.totalBudget), sub: "All schemes" },
            { label: "SO Orders", value: formatCurrency(summaryTotals.totalSo), sub: `${summaryTotals.pct}% of budget` },
            { label: "IFMS Actual", value: formatCurrency(summaryTotals.totalIfms), sub: "Utilised" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{card.value}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{card.sub}</p>
            </div>
          ))}
        </div>

        {summary && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Budget breakdown (summary heads)</p>
                <p className="text-sm text-[var(--text-muted)]">
                  Plan type, transfer, and admin — latest snapshot
                  {summary.asOfDate ? ` · as of ${summary.asOfDate}` : ""}.
                </p>
              </div>
            </div>
            {summary.rows.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-3 pr-4">Head</th>
                      <th className="py-3 pr-4">Budget (₹ Cr)</th>
                      <th className="py-3 pr-4">SO (₹ Cr)</th>
                      <th className="py-3">IFMS (₹ Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((row) => (
                      <tr key={row.headCode} className="border-b border-[var(--border)] text-[var(--text-primary)]">
                        <td className="py-3 pr-4 font-medium">{row.label}</td>
                        <td className="py-3 pr-4">{row.budgetEstimateCr.toFixed(1)}</td>
                        <td className="py-3 pr-4">{row.soExpenditureCr.toFixed(1)}</td>
                        <td className="py-3">{row.ifmsExpenditureCr.toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold text-[var(--text-primary)]">
                      <td className="py-3 pr-4">Total</td>
                      <td className="py-3 pr-4">{summary.totals.budgetEstimateCr.toFixed(1)}</td>
                      <td className="py-3 pr-4">{summary.totals.soExpenditureCr.toFixed(1)}</td>
                      <td className="py-3">{summary.totals.ifmsExpenditureCr.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">No finance summary heads recorded for this year yet.</p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Scheme entries</p>
              <p className="text-sm text-[var(--text-muted)]">
                Per-scheme budgets, subschemes, and revision history from the database.
              </p>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{entries.length} schemes</span>
          </div>

          {entries.length === 0 && (
            <div className="mt-4 text-sm text-[var(--text-muted)]">No schemes or financial year configured.</div>
          )}

          {entries.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 pr-4">Scheme / Subscheme</th>
                    <th className="py-3 pr-4">Vertical</th>
                    <th className="py-3 pr-4">Budget (₹ Cr)</th>
                    <th className="py-3 pr-4">SO (₹ Cr)</th>
                    <th className="py-3 pr-4">IFMS (₹ Cr)</th>
                    <th className="py-3">% as per IFMS</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const subs = entry.subschemes ?? [];
                    const hasSubs = subs.length > 0;
                    const hasNumericSubs = subs.some(
                      (s) =>
                        (s.annualBudget !== undefined && s.annualBudget > 0) ||
                        (s.so !== undefined && s.so > 0) ||
                        (s.ifms !== undefined && s.ifms > 0),
                    );
                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          className={`border-b border-[var(--border)] text-[var(--text-primary)] ${hasSubs ? "bg-[var(--bg-card)]" : ""}`}
                        >
                          <td className="py-3 pr-4 font-semibold">
                            <span className="text-[var(--text-muted)] mr-1.5 font-mono text-xs">{entry.id}</span>
                            {entry.scheme}
                            {hasSubs && hasNumericSubs && (
                              <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-normal">
                                derived
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-[var(--text-muted)]">{entry.vertical}</td>
                          <td className="py-3 pr-4 text-[var(--text-secondary)]">{entry.annualBudget.toFixed(1)}</td>
                          <td className="py-3 pr-4 text-[var(--text-secondary)]">{entry.so.toFixed(1)}</td>
                          <td className="py-3 pr-4 text-[var(--text-secondary)]">{entry.ifms.toFixed(1)}</td>
                          <td className="py-3">
                            {entry.annualBudget ? ((entry.ifms / entry.annualBudget) * 100).toFixed(1) : "0.0"}%
                          </td>
                        </tr>
                        {hasSubs &&
                          subs.map((sub) => (
                            <tr
                              key={`${entry.id}-${sub.code}`}
                              className="border-b border-[var(--border)] text-[var(--text-muted)]"
                            >
                              <td className="py-2 pr-4 pl-6">
                                <span className="text-[var(--text-muted)] mr-1.5">↳</span>
                                <span className="font-mono text-xs font-medium text-[var(--text-primary)]">{sub.code}</span>
                                <span className="ml-1.5 text-[11px]">{sub.name}</span>
                              </td>
                              <td className="py-2 pr-4" />
                              <td className="py-2 pr-4">{(sub.annualBudget ?? 0).toFixed(1)}</td>
                              <td className="py-2 pr-4">{(sub.so ?? 0).toFixed(1)}</td>
                              <td className="py-2 pr-4">{(sub.ifms ?? 0).toFixed(1)}</td>
                              <td className="py-2">
                                {(sub.annualBudget ?? 0)
                                  ? (((sub.ifms ?? 0) / (sub.annualBudget ?? 1)) * 100).toFixed(1)
                                  : "0.0"}
                                %
                              </td>
                            </tr>
                          ))}
                        {(entry.updates?.length ?? 0) > 0 && (
                          <tr className="border-b border-[var(--border)] bg-[var(--bg-surface)]/40">
                            <td className="py-2 pr-4 pl-4 text-xs text-[var(--text-muted)]" colSpan={6}>
                              <span className="font-semibold uppercase tracking-wide text-[10px] text-[var(--text-muted)]">
                                Budget revisions
                              </span>
                              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[var(--text-secondary)]">
                                {entry.updates!.map((u, i) => (
                                  <li key={`${entry.id}-rev-${i}`}>
                                    <span className="text-[var(--text-muted)]">{u.timestamp}</span>
                                    {u.actor ? ` · ${u.actor}` : ""}
                                    {u.note ? ` — ${u.note}` : ""}
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
