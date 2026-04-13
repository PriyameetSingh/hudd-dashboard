"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { UserRole } from "@/lib/auth";
import { fetchFinancialBudgets } from "@/src/lib/services/financialService";
import type { FinancialEntry } from "@/types";

function effBudget(e: FinancialEntry) {
  return e.effectiveBudgetCr ?? e.annualBudget + (e.totalSupplementCr ?? 0);
}

function utilPct(e: FinancialEntry): number {
  const b = effBudget(e);
  if (!b || b <= 0) return 0;
  return (e.ifms / b) * 100;
}

type Bucket = "on_track" | "at_risk" | "critical";

function bucketFor(pct: number): Bucket {
  if (pct > 75) return "on_track";
  if (pct >= 40) return "at_risk";
  return "critical";
}

const BUCKET_META: Record<Bucket, { title: string; subtitle: string; border: string }> = {
  on_track: {
    title: "On track",
    subtitle: "IFMS utilisation > 75%",
    border: "border-emerald-500/60",
  },
  at_risk: {
    title: "At risk",
    subtitle: "40% – 75%",
    border: "border-amber-500/60",
  },
  critical: {
    title: "Critical",
    subtitle: "< 40%",
    border: "border-rose-500/60",
  },
};

type Props = { userRole?: UserRole };

export default function SchemesBoardClient({ userRole }: Props) {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchFinancialBudgets();
        if (!alive) return;
        setEntries(data.entries);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const verticals = useMemo(() => ["all", ...Array.from(new Set(entries.map((e) => e.vertical)))], [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (vertical !== "all" && e.vertical !== vertical) return false;
      if (!q) return true;
      return (
        e.scheme.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.vertical.toLowerCase().includes(q)
      );
    });
  }, [entries, query, vertical]);

  const columns = useMemo(() => {
    const cols: Record<Bucket, FinancialEntry[]> = { on_track: [], at_risk: [], critical: [] };
    for (const e of filtered) {
      cols[bucketFor(utilPct(e))].push(e);
    }
    for (const k of Object.keys(cols) as Bucket[]) {
      cols[k].sort((a, b) => utilPct(b) - utilPct(a));
    }
    return cols;
  }, [filtered]);

  const isViewer = userRole === UserRole.VIEWER;

  return (
    <AppShell title="Scheme utilisation board">
      <div className="relative space-y-5 px-6 py-6">
        {isViewer && (
          <div className="pointer-events-none absolute right-6 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Read-only
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Financial</p>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Budget vs expenditure</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            Schemes grouped by IFMS utilisation (IFMS ÷ effective budget). Buckets are computed — drag-and-drop not required.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-[11px] text-[var(--text-muted)]">
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Scheme name or code"
              className="mt-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--bg-document)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>
          <label className="flex flex-col text-[11px] text-[var(--text-muted)]">
            Vertical
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-document)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {verticals.map((v) => (
                <option key={v} value={v}>
                  {v === "all" ? "All verticals" : v}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-[var(--alert-warning)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-primary)]">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-[var(--text-muted)]">Loading schemes…</p>}

        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-3">
            {(["on_track", "at_risk", "critical"] as const).map((key) => (
              <div
                key={key}
                className={`flex min-h-[320px] flex-col rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-card)] p-4 ${BUCKET_META[key].border}`}
              >
                <div className="mb-3 border-b border-[var(--border)] pb-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{BUCKET_META[key].title}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{BUCKET_META[key].subtitle}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                    {columns[key].length} schemes
                  </p>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  {columns[key].map((e) => {
                    const pct = utilPct(e);
                    return (
                      <div
                        key={e.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--bg-document)] p-3 shadow-sm"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">{e.id}</span>
                          <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium leading-snug text-[var(--text-primary)]">{e.scheme}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{e.vertical}</p>
                        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-[var(--text-secondary)]">
                          <span>Budget {effBudget(e).toFixed(1)}</span>
                          <span>IFMS {e.ifms.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {columns[key].length === 0 && (
                    <p className="text-center text-xs text-[var(--text-muted)]">No schemes in this band.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
