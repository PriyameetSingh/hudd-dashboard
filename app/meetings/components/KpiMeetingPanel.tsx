"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchKPISubmissions } from "@/src/lib/services/kpiService";

export default function KpiMeetingPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [fy, setFy] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    fetchKPISubmissions()
      .then((data) => {
        if (!alive) return;
        setFy(data.financialYearLabel);
        const c: Record<string, number> = {};
        for (const s of data.submissions) {
          c[s.status] = (c[s.status] ?? 0) + 1;
        }
        setCounts(c);
        setErr(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Failed to load KPI data");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--text-muted)]">
        <Loader2 className="animate-spin" size={18} />
        Loading KPI submissions…
      </div>
    );
  }

  if (err) {
    return <p className="text-sm text-[var(--alert-critical)]">{err}</p>;
  }

  const approved = counts.approved ?? 0;
  const pending = (counts.submitted_pending ?? 0) + (counts.submitted ?? 0);
  const draft = counts.draft ?? 0;
  const notSubmitted = counts.not_submitted ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">FY {fy ?? "—"} · {total} KPI row(s)</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Approved", value: approved, tone: "text-[var(--alert-success)]" },
          { label: "Pending review / submitted", value: pending, tone: "text-amber-600 dark:text-amber-400" },
          { label: "Draft", value: draft, tone: "text-[var(--text-muted)]" },
          { label: "Not submitted", value: notSubmitted, tone: "text-[var(--text-muted)]" },
        ].map((row) => (
          <div key={row.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{row.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${row.tone}`}>{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
