"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import type { FinanceSummaryBreakdown } from "@/lib/financial-budget-entries";
import { UserRole } from "@/lib/auth";
import type { FinancialEntry, FinanceSummaryRow } from "@/types";
import { fetchFinanceSummary } from "@/src/lib/services/financialService";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatCurrency(value: number) {
  return `₹${value.toFixed(1)} Cr`;
}

function effBudget(entry: FinancialEntry) {
  return entry.effectiveBudgetCr ?? entry.annualBudget + (entry.totalSupplementCr ?? 0);
}

type ComparePreset = "none" | "wow" | "since_last_meeting" | "meeting_pair" | "custom";

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
  const [preset, setPreset] = useState<ComparePreset>("none");
  const [snapshotDates, setSnapshotDates] = useState<string[]>([]);
  const [meetings, setMeetings] = useState<{ id: string; meetingDate: string; title: string | null }[]>([]);
  const [timeseries, setTimeseries] = useState<{ asOfDate: string; ifmsCr: number }[]>([]);
  const [baselineSummary, setBaselineSummary] = useState<Awaited<ReturnType<typeof fetchFinanceSummary>> | null>(null);
  const [currentHeadSummary, setCurrentHeadSummary] = useState<Awaited<ReturnType<typeof fetchFinanceSummary>> | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [customBaseline, setCustomBaseline] = useState("");
  const [customCurrent, setCustomCurrent] = useState("");
  const [meetingA, setMeetingA] = useState("");
  const [meetingB, setMeetingB] = useState("");

  const summaryTotals = useMemo(() => {
    const totalBudget = entries.reduce((sum, entry) => sum + effBudget(entry), 0);
    const totalSo = entries.reduce((sum, entry) => sum + entry.so, 0);
    const totalIfms = entries.reduce((sum, entry) => sum + entry.ifms, 0);
    const pct = totalBudget ? ((totalIfms / totalBudget) * 100).toFixed(1) : "0.0";
    return { totalBudget, totalSo, totalIfms, pct };
  }, [entries]);

  const currentSummaryAsOf = summary?.asOfDate ?? null;

  const resolvedDates = useMemo(() => {
    if (preset === "none") return { baseline: null as string | null, current: currentSummaryAsOf };
    const dates = snapshotDates;
    if (dates.length === 0) return { baseline: null, current: currentSummaryAsOf };

    if (preset === "wow") {
      return { baseline: dates.length >= 2 ? dates[1] : null, current: dates[0] ?? currentSummaryAsOf };
    }

    if (preset === "since_last_meeting" && meetings.length > 0) {
      const md = meetings[0].meetingDate;
      const onOrBefore = dates.filter((d) => d <= md);
      return {
        baseline: onOrBefore[0] ?? null,
        current: dates[0] ?? currentSummaryAsOf,
      };
    }

    if (preset === "meeting_pair" && meetingA && meetingB) {
      const early = meetingA < meetingB ? meetingA : meetingB;
      const late = meetingA < meetingB ? meetingB : meetingA;
      const bLine = dates.filter((d) => d <= early);
      const cLine = dates.filter((d) => d <= late);
      return {
        baseline: bLine[0] ?? null,
        current: cLine[0] ?? dates[0] ?? currentSummaryAsOf,
      };
    }

    if (preset === "custom" && customBaseline && customCurrent) {
      return { baseline: customBaseline, current: customCurrent };
    }

    return { baseline: null, current: currentSummaryAsOf };
  }, [
    preset,
    snapshotDates,
    meetings,
    currentSummaryAsOf,
    meetingA,
    meetingB,
    customBaseline,
    customCurrent,
  ]);

  const loadMeta = useCallback(async () => {
    try {
      const [dRes, mRes, tRes] = await Promise.all([
        fetch("/api/v1/financial/snapshot-dates", { cache: "no-store" }),
        fetch("/api/v1/meetings", { cache: "no-store" }),
        fetch("/api/v1/financial/ifms-timeseries", { cache: "no-store" }),
      ]);
      if (dRes.ok) {
        const j = (await dRes.json()) as { dates: string[] };
        setSnapshotDates(j.dates ?? []);
      }
      if (mRes.ok) {
        const j = (await mRes.json()) as {
          meetings: { id: string; meetingDate: string; title: string | null }[];
        };
        setMeetings(j.meetings ?? []);
      }
      if (tRes.ok) {
        const j = (await tRes.json()) as { points: { asOfDate: string; ifmsCr: number }[] };
        setTimeseries((j.points ?? []).map((p) => ({ asOfDate: p.asOfDate, ifmsCr: p.ifmsCr })));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (preset === "none" || !resolvedDates.baseline || !resolvedDates.current) {
      setBaselineSummary(null);
      setCurrentHeadSummary(null);
      return;
    }
    if (resolvedDates.baseline === resolvedDates.current) {
      setBaselineSummary(null);
      setCurrentHeadSummary(null);
      return;
    }
    let alive = true;
    setLoadingCompare(true);
    Promise.all([
      fetchFinanceSummary({ asOfDate: resolvedDates.baseline, financialYearLabel: financialYearLabel ?? undefined }),
      fetchFinanceSummary({ asOfDate: resolvedDates.current, financialYearLabel: financialYearLabel ?? undefined }),
    ])
      .then(([base, cur]) => {
        if (alive) {
          setBaselineSummary(base);
          setCurrentHeadSummary(cur);
        }
      })
      .catch(() => {
        if (alive) {
          setBaselineSummary(null);
          setCurrentHeadSummary(null);
        }
      })
      .finally(() => {
        if (alive) setLoadingCompare(false);
      });
    return () => {
      alive = false;
    };
  }, [preset, resolvedDates.baseline, resolvedDates.current, financialYearLabel]);

  const activeHeadSummary = useMemo(() => {
    if (preset !== "none" && currentHeadSummary?.rows?.length) {
      return {
        financialYearLabel: currentHeadSummary.financialYearLabel,
        asOfDate: currentHeadSummary.asOfDate,
        rows: currentHeadSummary.rows,
        totals: currentHeadSummary.totals,
      };
    }
    if (!summary?.rows.length) return null;
    return {
      financialYearLabel: summary.financialYearLabel,
      asOfDate: summary.asOfDate,
      rows: summary.rows,
      totals: summary.totals,
    };
  }, [preset, currentHeadSummary, summary]);

  const compareSummaryRows = useMemo(() => {
    if (!baselineSummary || !activeHeadSummary || preset === "none") return null;
    const byHead = new Map<string, FinanceSummaryRow>();
    for (const r of baselineSummary.rows) byHead.set(r.headCode, r);

    return activeHeadSummary.rows.map((row) => {
      const base = byHead.get(row.headCode);
      return {
        ...row,
        deltaIfms: base ? row.ifmsExpenditureCr - base.ifmsExpenditureCr : null,
        deltaSo: base ? row.soExpenditureCr - base.soExpenditureCr : null,
        baselineIfms: base?.ifmsExpenditureCr ?? null,
      };
    });
  }, [baselineSummary, activeHeadSummary, preset]);

  const headChartData = useMemo(() => {
    if (!compareSummaryRows) return [];
    return compareSummaryRows.map((r) => ({
      name: r.label.slice(0, 14),
      baseline: r.baselineIfms ?? 0,
      current: r.ifmsExpenditureCr,
    }));
  }, [compareSummaryRows]);

  const totalsDelta = useMemo(() => {
    if (!baselineSummary || !activeHeadSummary || preset === "none") return null;
    return {
      ifms: activeHeadSummary.totals.ifmsExpenditureCr - baselineSummary.totals.ifmsExpenditureCr,
      so: activeHeadSummary.totals.soExpenditureCr - baselineSummary.totals.soExpenditureCr,
      budget: activeHeadSummary.totals.budgetEstimateCr - baselineSummary.totals.budgetEstimateCr,
    };
  }, [baselineSummary, activeHeadSummary, preset]);

  const isViewer = userRole === UserRole.VIEWER;
  const fyDisplay = financialYearLabel ?? "—";

  const compareHint = useMemo(() => {
    if (preset === "none") return null;
    if (preset === "wow") return "Week on week: compares the two most recent snapshot dates with summary-head data.";
    if (preset === "since_last_meeting")
      return "Baseline = latest finance summary on or before the most recent meeting date; current = latest overall.";
    if (preset === "meeting_pair")
      return "Baseline = snapshot on or before the earlier selected meeting; current = on or before the later meeting.";
    if (preset === "custom") return "Compares finance summary heads at two as-of dates.";
    return null;
  }, [preset]);

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
            Live SO vs IFMS from finance budgets and expenditure snapshots (database). Use comparison mode for summary-head
            deltas (same basis as FA summary entries).
          </p>
        </div>

        {/* Comparison toolbar */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Comparison</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(
              [
                ["none", "Current only"],
                ["wow", "Week on week"],
                ["since_last_meeting", "Since last meeting"],
                ["meeting_pair", "Meeting vs meeting"],
                ["custom", "Custom dates"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreset(id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  preset === id
                    ? "border-[var(--text-primary)] bg-[var(--bg-hover)] text-[var(--text-primary)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === "meeting_pair" && (
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex flex-col text-[11px] text-[var(--text-muted)]">
                Earlier meeting
                <select
                  className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-document)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                  value={meetingA}
                  onChange={(e) => setMeetingA(e.target.value)}
                >
                  <option value="">Select</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.meetingDate}>
                      {m.meetingDate} {m.title ? `— ${m.title}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-[11px] text-[var(--text-muted)]">
                Later meeting
                <select
                  className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-document)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                  value={meetingB}
                  onChange={(e) => setMeetingB(e.target.value)}
                >
                  <option value="">Select</option>
                  {meetings.map((m) => (
                    <option key={`b-${m.id}`} value={m.meetingDate}>
                      {m.meetingDate} {m.title ? `— ${m.title}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {preset === "custom" && (
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex flex-col text-[11px] text-[var(--text-muted)]">
                Baseline as-of
                <select
                  className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-document)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                  value={customBaseline}
                  onChange={(e) => setCustomBaseline(e.target.value)}
                >
                  <option value="">Select date</option>
                  {snapshotDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-[11px] text-[var(--text-muted)]">
                Current as-of
                <select
                  className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-document)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                  value={customCurrent}
                  onChange={(e) => setCustomCurrent(e.target.value)}
                >
                  <option value="">Select date</option>
                  {snapshotDates.map((d) => (
                    <option key={`c-${d}`} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {compareHint && <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{compareHint}</p>}
          {preset !== "none" && resolvedDates.baseline && resolvedDates.current && (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Baseline <span className="font-mono">{resolvedDates.baseline}</span> → Current{" "}
              <span className="font-mono">{resolvedDates.current}</span>
              {loadingCompare ? " · Loading…" : ""}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Total Budget",
              value: formatCurrency(summaryTotals.totalBudget),
              sub: "All schemes (effective budget)",
            },
            {
              label: "SO Orders",
              value: formatCurrency(summaryTotals.totalSo),
              sub: `${summaryTotals.pct}% utilisation (scheme roll-up)`,
            },
            {
              label: "IFMS Actual",
              value: formatCurrency(summaryTotals.totalIfms),
              sub: "Utilised (scheme roll-up)",
            },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{card.value}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{card.sub}</p>
            </div>
          ))}
        </div>

        {totalsDelta && preset !== "none" && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Summary heads (FA) movement</span> vs baseline{" "}
            <span className="font-mono">{resolvedDates.baseline}</span>: IFMS{" "}
            <span className={totalsDelta.ifms >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
              {totalsDelta.ifms >= 0 ? "+" : ""}
              {totalsDelta.ifms.toFixed(1)} Cr
            </span>
            {" · "}
            SO{" "}
            <span className={totalsDelta.so >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
              {totalsDelta.so >= 0 ? "+" : ""}
              {totalsDelta.so.toFixed(1)} Cr
            </span>
            {" · "}
            Budget{" "}
            <span
              className={totalsDelta.budget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
            >
              {totalsDelta.budget >= 0 ? "+" : ""}
              {totalsDelta.budget.toFixed(1)} Cr
            </span>
          </div>
        )}

        {timeseries.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Department IFMS trend</p>
            <p className="text-sm text-[var(--text-muted)]">Sum of snapshot rows by as-of date (₹ Cr).</p>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeseries.map((t) => ({ ...t, label: t.asOfDate.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${Number(v ?? 0).toFixed(1)} Cr`, "IFMS"]}
                  />
                  <Line type="monotone" dataKey="ifmsCr" stroke="var(--text-primary)" dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {headChartData.length > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Summary heads — IFMS baseline vs current</p>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="baseline" name="Baseline IFMS" fill="var(--text-muted)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" name="Current IFMS" fill="var(--text-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeHeadSummary && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Budget breakdown (summary heads)</p>
                <p className="text-sm text-[var(--text-muted)]">
                  Plan type, transfer, and admin
                  {activeHeadSummary.asOfDate ? ` · as of ${activeHeadSummary.asOfDate}` : ""}.
                  {preset !== "none" && resolvedDates.current ? ` Current column uses snapshot ${resolvedDates.current}.` : ""}
                </p>
              </div>
            </div>
            {activeHeadSummary.rows.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-3 pr-4">Head</th>
                      <th className="py-3 pr-4">Budget (₹ Cr)</th>
                      <th className="py-3 pr-4">SO (₹ Cr)</th>
                      <th className="py-3 pr-4">IFMS (₹ Cr)</th>
                      {compareSummaryRows && <th className="py-3 pr-4">Δ IFMS</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeHeadSummary.rows.map((row) => {
                      const cmp = compareSummaryRows?.find((r) => r.headCode === row.headCode);
                      return (
                        <tr key={row.headCode} className="border-b border-[var(--border)] text-[var(--text-primary)]">
                          <td className="py-3 pr-4 font-medium">{row.label}</td>
                          <td className="py-3 pr-4">{row.budgetEstimateCr.toFixed(1)}</td>
                          <td className="py-3 pr-4">{row.soExpenditureCr.toFixed(1)}</td>
                          <td className="py-3 pr-4">{row.ifmsExpenditureCr.toFixed(1)}</td>
                          {compareSummaryRows && (
                            <td
                              className={`py-3 pr-4 font-medium ${
                                (cmp?.deltaIfms ?? 0) >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {cmp?.deltaIfms == null ? "—" : `${cmp.deltaIfms >= 0 ? "+" : ""}${cmp.deltaIfms.toFixed(1)}`}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    <tr className="font-semibold text-[var(--text-primary)]">
                      <td className="py-3 pr-4">Total</td>
                      <td className="py-3 pr-4">{activeHeadSummary.totals.budgetEstimateCr.toFixed(1)}</td>
                      <td className="py-3 pr-4">{activeHeadSummary.totals.soExpenditureCr.toFixed(1)}</td>
                      <td className="py-3 pr-4">{activeHeadSummary.totals.ifmsExpenditureCr.toFixed(1)}</td>
                      {totalsDelta && (
                        <td
                          className={`py-3 pr-4 ${totalsDelta.ifms >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                        >
                          {totalsDelta.ifms >= 0 ? "+" : ""}
                          {totalsDelta.ifms.toFixed(1)}
                        </td>
                      )}
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
                Per-scheme budgets, scheme components, and revision history from the database. Point-in-time deltas for each scheme
                require historical reconstruction; use summary comparison above for official head movement.
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
                    const pctParent = effBudget(entry) ? ((entry.ifms / effBudget(entry)) * 100).toFixed(1) : "0.0";
                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          className={`border-b border-[var(--border)] text-[var(--text-primary)] ${hasSubs ? "bg-[var(--bg-card)]" : ""}`}
                        >
                          <td className="py-3 pr-4 font-semibold">
                            <span className="mr-1.5 font-mono text-xs text-[var(--text-muted)]">{entry.id}</span>
                            {entry.scheme}
                            {hasSubs && hasNumericSubs && (
                              <span className="ml-2 text-[10px] font-normal uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                derived
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-[var(--text-muted)]">{entry.vertical}</td>
                          <td className="py-3 pr-4 text-[var(--text-secondary)]">{effBudget(entry).toFixed(1)}</td>
                          <td className="py-3 pr-4 text-[var(--text-secondary)]">{entry.so.toFixed(1)}</td>
                          <td className="py-3 pr-4 text-[var(--text-secondary)]">{entry.ifms.toFixed(1)}</td>
                          <td className="py-3">{pctParent}%</td>
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
