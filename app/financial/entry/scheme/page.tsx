"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Lock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import {
  fetchFinancialBudgets,
  submitFinancialSnapshot,
  patchFinancialBudget,
} from "@/src/lib/services/financialService";
import { FinancialEntry } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  submitted_this_week: "#2ecc71",
  submitted_pending: "#2ecc71",
  draft: "#3498db",
  overdue: "#e74c3c",
  not_started: "#95a5a6",
};

export default function SchemeEntryPage() {
  useRequireRole([UserRole.FA], "/");

  const now = new Date();
  const monthLabel = now.toLocaleString("en-IN", { month: "long" });

  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [financialYearLabel, setFinancialYearLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<FinancialEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soValue, setSoValue] = useState(0);
  const [ifmsValue, setIfmsValue] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [asOfDate, setAsOfDate] = useState(now.toISOString().slice(0, 10));
  const [subschemeCode, setSubschemeCode] = useState("");
  const [budgetRevise, setBudgetRevise] = useState(false);
  const [reviseReason, setReviseReason] = useState("");
  const [newBudgetCr, setNewBudgetCr] = useState(0);

  const loadEntries = useCallback(async () => {
    try {
      const data = await fetchFinancialBudgets();
      setEntries(data.entries);
      setFinancialYearLabel(data.financialYearLabel);
      return data;
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to load financial data");
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const data = await fetchFinancialBudgets();
        if (!active) return;
        setEntries(data.entries);
        setFinancialYearLabel(data.financialYearLabel);
        const initial = data.entries[0] ?? null;
        setSelected(initial);
        setSoValue(initial?.so ?? 0);
        setIfmsValue(initial?.ifms ?? 0);
        setNewBudgetCr(initial?.annualBudget ?? 0);
      } catch (e: unknown) {
        if (!active) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load financial data");
      } finally {
        if (active) setLoading(false);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (selected.subschemes && selected.subschemes.length > 0) {
      setSubschemeCode((prev) =>
        selected.subschemes!.some((s) => s.code === prev) ? prev : selected.subschemes![0].code,
      );
    } else {
      setSubschemeCode("");
    }
  }, [selected?.id, selected?.subschemes]);

  const grouped = useMemo(() => {
    return entries.reduce<Record<string, FinancialEntry[]>>((acc, entry) => {
      const key = entry.vertical;
      acc[key] = acc[key] ?? [];
      if (!query || entry.scheme.toLowerCase().includes(query.toLowerCase())) {
        acc[key].push(entry);
      }
      return acc;
    }, {});
  }, [entries, query]);

  const hasSubschemes = (selected?.subschemes?.length ?? 0) > 0;
  const isBudgetLocked = selected?.locked ?? false;
  const utilisation = selected?.annualBudget ? ((ifmsValue / selected.annualBudget) * 100).toFixed(1) : "0.0";
  const lapseRisk = (100 - Number(utilisation)).toFixed(1);

  const selectEntry = (entry: FinancialEntry) => {
    setSelected(entry);
    setSoValue(entry.so);
    setIfmsValue(entry.ifms);
    setNewBudgetCr(entry.annualBudget);
    setRemarks("");
    setSubschemeCode(entry.subschemes?.[0]?.code ?? "");
    setBudgetRevise(false);
    setReviseReason("");
    setSubmissionSuccess(false);
    setError(null);
  };

  const persistSnapshot = async (workflowStatus: "draft" | "submitted") => {
    if (!selected || !financialYearLabel) {
      setError("Missing scheme or financial year.");
      return;
    }
    if (hasSubschemes && !subschemeCode.trim()) {
      setError("Select a subscheme for this scheme.");
      return;
    }
    if (budgetRevise && !reviseReason.trim()) {
      setError("Provide a reason for the budget revision.");
      return;
    }
    if (budgetRevise && newBudgetCr <= 0) {
      setError("Enter a valid revised budget amount.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      if (budgetRevise) {
        await patchFinancialBudget({
          schemeCode: selected.id,
          subschemeCode: hasSubschemes ? subschemeCode.trim() : null,
          newBudgetCr,
          reason: reviseReason,
          financialYearLabel,
        });
      }

      await submitFinancialSnapshot({
        schemeCode: selected.id,
        subschemeCode: hasSubschemes ? subschemeCode.trim() : null,
        asOfDate,
        soExpenditureCr: soValue,
        ifmsExpenditureCr: ifmsValue,
        remarks,
        financialYearLabel,
        workflowStatus,
      });

      if (workflowStatus === "draft") {
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 2000);
      } else {
        setSubmissionSuccess(true);
        setBudgetRevise(false);
        setReviseReason("");
        const data = await loadEntries();
        if (data) {
          const next = data.entries.find((e) => e.id === selected.id) ?? data.entries[0] ?? null;
          setSelected(next);
          if (next) {
            setSoValue(next.so);
            setIfmsValue(next.ifms);
            setNewBudgetCr(next.annualBudget);
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Financial Entry — Scheme Data">
      <div className="px-6 py-8">
        {loading && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
            Loading financial entries...
          </div>
        )}
        {!loading && loadError && (
          <div className="rounded-2xl border border-[var(--alert-critical)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--alert-critical)]">
            {loadError}
          </div>
        )}
        {!loading && !loadError && !selected && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
            No financial entries available.
          </div>
        )}

        {!loading && !loadError && selected && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-lg">
            {submissionSuccess && (
              <div className="mb-4 rounded-xl border border-[var(--alert-success)] bg-[rgba(0,200,83,0.1)] px-4 py-3 text-sm text-[var(--alert-success)]">
                Entry saved and active.
              </div>
            )}
            {draftSaved && (
              <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-muted)]">
                Draft saved.
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-xl border border-[var(--alert-critical)] bg-[rgba(255,59,59,0.1)] px-4 py-3 text-sm text-[var(--alert-critical)]">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 justify-between mb-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Scheme-wise Financial Entry</p>
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{selected.scheme}</h1>
                <div className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                  <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.3em]">{selected.vertical}</span>
                  <span>{financialYearLabel ? `FY ${financialYearLabel}` : "FY"}</span>
                  <span>{monthLabel}</span>
                </div>
              </div>
              {isBudgetLocked && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Lock size={16} />
                  <span>Budget locked for current FY</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-12 gap-6">
              <aside className="col-span-4 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Search scheme</label>
                  <input
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-inner"
                    placeholder="e.g. PMAY-U"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {Object.entries(grouped).map(([vertical, schemes]) => (
                  <div key={vertical} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
                    <div className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{vertical}</div>
                    <div className="mt-3 space-y-2">
                      {schemes.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => selectEntry(entry)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
                            selected.id === entry.id
                              ? "border-[var(--text-primary)] bg-[var(--bg-primary)]"
                              : "border-transparent hover:border-[var(--border)]"
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.scheme}</p>
                            <p className="text-[11px] text-[var(--text-muted)]">Updated {entry.lastUpdated}</p>
                          </div>
                          <span
                            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.3em]"
                            style={{ color: STATUS_COLORS[entry.status] ?? "#95a5a6" }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: STATUS_COLORS[entry.status] ?? "#95a5a6",
                                display: "inline-block",
                              }}
                            />
                            <span>
                              {entry.annualBudget ? ((entry.ifms / entry.annualBudget) * 100).toFixed(1) : "0.0"}%
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </aside>

              <section className="col-span-8 space-y-6">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Annual Budget (₹ Cr)</p>
                      <div className="text-3xl font-bold text-[var(--text-primary)]">
                        {(budgetRevise ? newBudgetCr : selected.annualBudget).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {selected.status === "submitted_this_week" || selected.status === "submitted_pending"
                          ? "approved"
                          : selected.status.replace(/_/g, " ")}
                      </span>
                      {!isBudgetLocked && (
                        <button
                          className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] uppercase tracking-[0.3em]"
                          onClick={() => {
                            setBudgetRevise((prev) => !prev);
                            setNewBudgetCr(selected.annualBudget);
                            setReviseReason("");
                          }}
                        >
                          {budgetRevise ? "Cancel Revision" : "Revise"}
                        </button>
                      )}
                    </div>
                  </div>
                  {budgetRevise && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                        New Annual Budget (₹ Cr)
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={newBudgetCr}
                          onChange={(e) => setNewBudgetCr(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                      </label>
                      <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                        Reason for revision
                        <textarea
                          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                          rows={2}
                          value={reviseReason}
                          onChange={(e) => setReviseReason(e.target.value)}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {hasSubschemes && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Subscheme</p>
                    <select
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      value={subschemeCode}
                      onChange={(e) => setSubschemeCode(e.target.value)}
                    >
                      <option value="">Select subscheme</option>
                      {selected.subschemes?.map((s) => (
                        <option key={s.id} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-4">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Weekly Expenditure Update</p>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                      As per SO Order (₹ Cr)
                      <input
                        type="number"
                        value={soValue}
                        onChange={(e) => setSoValue(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </label>
                    <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                      As per IFMS (₹ Cr)
                      <input
                        type="number"
                        value={ifmsValue}
                        onChange={(e) => setIfmsValue(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-[1.2fr_1.2fr] gap-4">
                    <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                      Data as of
                      <input
                        type="date"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2"
                      />
                    </label>
                    <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                      Remarks
                      <textarea
                        rows={2}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 grid gap-3 md:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">% Utilised (IFMS)</p>
                      <p className="text-2xl font-semibold text-[var(--alert-success)]">{utilisation}%</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Lapse Risk</p>
                      <p className="text-2xl font-semibold text-[var(--alert-warning)]">{lapseRisk}%</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <button
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
                      disabled={isSubmitting}
                      onClick={() => persistSnapshot("draft")}
                    >
                      Save Draft
                    </button>
                    <button
                      className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                      onClick={() => persistSnapshot("submitted")}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Save & Submit"}
                    </button>
                    <p className="text-xs text-[var(--text-muted)]">
                      Last updated: {selected.lastUpdated} by {selected.submitter || "Finance Desk"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
