"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/src/lib/route-guards";
import { getFinancialEntries } from "@/src/lib/services/financialService";
import { FinancialEntry } from "@/types";
import { UserRole } from "@/lib/auth";
function formatCurrency(value: number) {
  return `₹${value.toFixed(1)} Cr`;
}

export default function FinancialOverviewPage() {
  const user = useRequireAuth();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoadError(null);
        const data = await getFinancialEntries();
        if (!active) return;
        setEntries(data);
      } catch (e) {
        if (!active) return;
        setLoadError(e instanceof Error ? e.message : "Could not load financial data.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const totalBudget = entries.reduce((sum, entry) => sum + entry.annualBudget, 0);
    const totalSo = entries.reduce((sum, entry) => sum + entry.so, 0);
    const totalIfms = entries.reduce((sum, entry) => sum + entry.ifms, 0);
    const pct = totalBudget ? ((totalIfms / totalBudget) * 100).toFixed(1) : "0.0";
    return { totalBudget, totalSo, totalIfms, pct };
  }, [entries]);

  const isViewer = user?.role === UserRole.VIEWER;

  return (
    <AppShell title="Financial Overview">
      <div className="relative space-y-6 px-6 py-6">
        {isViewer && (
          <div className="pointer-events-none absolute right-6 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Read-only
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">FY 2025-26</p>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Financial Command View</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Live SO vs IFMS entries across HUDD schemes.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total Budget", value: formatCurrency(summary.totalBudget), sub: "All schemes" },
            { label: "SO Orders", value: formatCurrency(summary.totalSo), sub: `${summary.pct}% of budget` },
            { label: "IFMS Actual", value: formatCurrency(summary.totalIfms), sub: "Utilised" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{card.value}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Scheme entries</p>
              <p className="text-sm text-[var(--text-muted)]">Updated entries requiring approvals and monitoring.</p>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{entries.length} schemes</span>
          </div>

          {loading && (
            <div className="mt-4 text-sm text-[var(--text-muted)]">Loading financial data...</div>
          )}
          {!loading && loadError && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {loadError}
            </div>
          )}
          {!loading && !loadError && entries.length === 0 && (
            <div className="mt-4 text-sm text-[var(--text-muted)]">No financial records available.</div>
          )}

          {!loading && !loadError && entries.length > 0 && (
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
                    const hasSubs = (entry.subschemes?.length ?? 0) > 0;
                    return (
                      <React.Fragment key={entry.id}>
                        {/* Scheme row — bold when it has subschemes (derived) */}
                        <tr
                          className={`border-b border-[var(--border)] text-[var(--text-primary)] ${hasSubs ? "bg-[var(--bg-card)]" : ""}`}
                        >
                          <td className="py-3 pr-4 font-semibold">
                            {entry.scheme}
                            {hasSubs && (
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
                        {/* Subscheme rows — indented */}
                        {hasSubs &&
                          (entry.subschemes ?? []).map((sub) => (
                            <tr
                              key={`${entry.id}-${sub.code}`}
                              className="border-b border-[var(--border)] text-[var(--text-muted)]"
                            >
                              <td className="py-2 pr-4 pl-6">
                                <span className="text-[var(--text-muted)] mr-1.5">↳</span>
                                <span className="font-medium text-[var(--text-primary)]">{sub.code}</span>
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
