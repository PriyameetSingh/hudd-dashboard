"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import { fetchFinanceSummary, saveFinanceSummary } from "@/src/lib/services/financialService";
import { FinanceSummaryRow } from "@/types";

const SUMMARY_HEADS: Array<{ headCode: "PLAN_TYPE" | "TRANSFER" | "ADMIN_EXPENDITURE"; label: string }> = [
  { headCode: "PLAN_TYPE", label: "Plan Type" },
  { headCode: "TRANSFER", label: "Transfer" },
  { headCode: "ADMIN_EXPENDITURE", label: "Admin Expenditure" },
];

export default function SummaryEntryPage() {
  useRequireRole([UserRole.FA], "/");

  const now = new Date();

  const [asOfDate, setAsOfDate] = useState(now.toISOString().slice(0, 10));
  const [financialYearLabel, setFinancialYearLabel] = useState<string | null>(null);
  const [summaryRows, setSummaryRows] = useState<FinanceSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultRows = (): FinanceSummaryRow[] =>
    SUMMARY_HEADS.map((h) => ({
      headCode: h.headCode,
      label: h.label,
      budgetEstimateCr: 0,
      soExpenditureCr: 0,
      ifmsExpenditureCr: 0,
    }));

  const loadSummary = useCallback(async (dateStr: string, fy: string | null) => {
    if (!fy) return;
    setSummaryLoading(true);
    try {
      const data = await fetchFinanceSummary({ asOfDate: dateStr, financialYearLabel: fy });
      setSummaryRows(data.rows.length === 0 ? defaultRows() : data.rows);
    } catch {
      setSummaryRows(defaultRows());
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const data = await fetchFinanceSummary({ asOfDate: now.toISOString().slice(0, 10) });
        if (!active) return;
        setFinancialYearLabel(data.financialYearLabel ?? null);
        setSummaryRows(data.rows.length === 0 ? defaultRows() : data.rows);
      } catch {
        if (active) setSummaryRows(defaultRows());
      }
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (financialYearLabel) {
      loadSummary(asOfDate, financialYearLabel);
    }
  }, [asOfDate, financialYearLabel, loadSummary]);

  const totals = useMemo(
    () =>
      summaryRows.reduce(
        (acc, r) => ({
          budgetEstimateCr: acc.budgetEstimateCr + r.budgetEstimateCr,
          soExpenditureCr: acc.soExpenditureCr + r.soExpenditureCr,
          ifmsExpenditureCr: acc.ifmsExpenditureCr + r.ifmsExpenditureCr,
        }),
        { budgetEstimateCr: 0, soExpenditureCr: 0, ifmsExpenditureCr: 0 },
      ),
    [summaryRows],
  );

  const handleSave = async () => {
    if (!financialYearLabel) {
      setError("Financial year not loaded.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await saveFinanceSummary({
        asOfDate,
        financialYearLabel,
        rows: summaryRows.map((r) => ({
          headCode: r.headCode as "PLAN_TYPE" | "TRANSFER" | "ADMIN_EXPENDITURE",
          budgetEstimateCr: r.budgetEstimateCr,
          soExpenditureCr: r.soExpenditureCr,
          ifmsExpenditureCr: r.ifmsExpenditureCr,
        })),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadSummary(asOfDate, financialYearLabel);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRow = (headCode: string, field: keyof Pick<FinanceSummaryRow, "budgetEstimateCr" | "soExpenditureCr" | "ifmsExpenditureCr">, value: number) => {
    setSummaryRows((prev) => prev.map((r) => (r.headCode === headCode ? { ...r, [field]: value } : r)));
  };

  return (
    <AppShell title="Financial Entry — Summary Heads">
      <div className="px-6 py-8">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-lg space-y-6">
          {success && (
            <div className="rounded-xl border border-[var(--alert-success)] bg-[rgba(0,200,83,0.1)] px-4 py-3 text-sm text-[var(--alert-success)]">
              Summary data saved and active.
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-[var(--alert-critical)] bg-[rgba(255,59,59,0.1)] px-4 py-3 text-sm text-[var(--alert-critical)]">
              {error}
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Summary-level Financial Entry</p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Finance Summary Heads</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {financialYearLabel ? `FY ${financialYearLabel}` : "Loading financial year..."}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="text-[12px] text-[var(--text-muted)]">
              Data as of
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="ml-3 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)] mb-3">
              Plan Type / Transfer / Admin Expenditure
            </p>
            {summaryLoading && (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            )}
            {!summaryLoading && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    <tr>
                      <th className="py-2 pr-4">Head</th>
                      <th className="py-2 pr-4">Budget Estimate (₹ Cr)</th>
                      <th className="py-2 pr-4">SO Expenditure (₹ Cr)</th>
                      <th className="py-2 pr-4">IFMS Expenditure (₹ Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr key={row.headCode} className="border-t border-[var(--border)]">
                        <td className="py-3 pr-4 text-[var(--text-primary)] font-medium">{row.label}</td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                            value={row.budgetEstimateCr}
                            onChange={(e) => updateRow(row.headCode, "budgetEstimateCr", Number(e.target.value))}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                            value={row.soExpenditureCr}
                            onChange={(e) => updateRow(row.headCode, "soExpenditureCr", Number(e.target.value))}
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                            value={row.ifmsExpenditureCr}
                            onChange={(e) => updateRow(row.headCode, "ifmsExpenditureCr", Number(e.target.value))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border)] font-semibold text-[var(--text-primary)]">
                      <td className="py-3">Totals</td>
                      <td className="py-3 pr-4">{totals.budgetEstimateCr.toFixed(2)}</td>
                      <td className="py-3 pr-4">{totals.soExpenditureCr.toFixed(2)}</td>
                      <td className="py-3 pr-4">{totals.ifmsExpenditureCr.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-xl bg-[var(--text-primary)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isSubmitting || summaryLoading}
              onClick={handleSave}
            >
              {isSubmitting ? "Saving..." : "Save Summary"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
