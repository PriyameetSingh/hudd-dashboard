"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchFinanceSummary } from "@/src/lib/services/financialService";

export default function FinancialMeetingPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [fy, setFy] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [totals, setTotals] = useState<{
    budgetEstimateCr: number;
    soExpenditureCr: number;
    ifmsExpenditureCr: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchFinanceSummary()
      .then((data) => {
        if (!alive) return;
        setFy(data.financialYearLabel);
        setAsOf(data.asOfDate);
        setTotals(data.totals);
        setErr(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Failed to load finance summary");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[var(--text-muted)]">
        <Loader2 className="animate-spin" size={18} />
        Loading financial summary…
      </div>
    );
  }

  if (err || !totals) {
    return <p className="text-sm text-[var(--alert-critical)]">{err ?? "No data"}</p>;
  }

  const pct =
    totals.budgetEstimateCr > 0
      ? ((totals.ifmsExpenditureCr / totals.budgetEstimateCr) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        FY {fy ?? "—"}
        {asOf ? ` · snapshot ${asOf}` : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Budget (est.)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            ₹{totals.budgetEstimateCr.toFixed(1)} Cr
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">SO expenditure</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            ₹{totals.soExpenditureCr.toFixed(1)} Cr
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">IFMS expenditure</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--accent)]">
            ₹{totals.ifmsExpenditureCr.toFixed(1)} Cr
          </p>
        </div>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        IFMS utilization vs budget estimate: <strong className="text-[var(--text-primary)]">{pct}%</strong>
      </p>
    </div>
  );
}
