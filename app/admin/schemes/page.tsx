"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import { getFinancialEntries } from "@/src/lib/services/financialService";
import { fetchKPISubmissions } from "@/src/lib/services/kpiService";
import { FinancialEntry, KPISubmission } from "@/types";
import StatusBadge from "@/src/components/ui/StatusBadge";

interface SchemeRow {
  name: string;
  vertical: string;
  financialStatus: FinancialEntry["status"];
  budget: number;
  kpiCount: number;
}

export default function AdminSchemesPage() {
  useRequireRole([UserRole.ACS, UserRole.AS], "/dashboard");

  const [financial, setFinancial] = useState<FinancialEntry[]>([]);
  const [kpis, setKpis] = useState<KPISubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [financialData, kpiData] = await Promise.all([
          getFinancialEntries(),
          fetchKPISubmissions(),
        ]);
        if (!active) return;
        setFinancial(financialData);
        setKpis(kpiData);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const schemes = useMemo<SchemeRow[]>(() => {
    return financial.map((entry) => ({
      name: entry.scheme,
      vertical: entry.vertical,
      financialStatus: entry.status,
      budget: entry.annualBudget,
      kpiCount: kpis.filter((kpi) => kpi.scheme === entry.scheme).length,
    }));
  }, [financial, kpis]);

  return (
    <AppShell title="Admin · Schemes">
      <div className="space-y-6 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Administration</p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Scheme Registry</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Monitor coverage, approvals, and KPI availability.</p>
          </div>
          <button className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)]">
            Add Scheme
          </button>
        </div>

        {loading && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
            Loading scheme registry...
          </div>
        )}

        {!loading && schemes.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
            No schemes found.
          </div>
        )}

        {!loading && schemes.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-surface)] text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Scheme</th>
                  <th className="px-4 py-3">Vertical</th>
                  <th className="px-4 py-3">Annual Budget (₹ Cr)</th>
                  <th className="px-4 py-3">KPI Metrics</th>
                  <th className="px-4 py-3">Financial Status</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((scheme) => (
                  <tr key={scheme.name} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{scheme.name}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{scheme.vertical}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{scheme.budget.toFixed(1)}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{scheme.kpiCount} KPIs</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={scheme.financialStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
