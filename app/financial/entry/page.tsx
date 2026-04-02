"use client";

import { useMemo, useState, useEffect } from "react";
import { CalendarDays, Lock } from "lucide-react";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import { getFinancialEntries } from "@/src/lib/services/financialService";
import { FinancialEntry } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  submitted_this_week: "#2ecc71",
  submitted_pending: "#f39c12",
  draft: "#3498db",
  overdue: "#e74c3c",
  not_started: "#95a5a6",
};

export default function FinancialEntryPage() {
  useRequireRole([UserRole.FA], "/");

  const now = new Date();
  const monthLabel = now.toLocaleString("en-IN", { month: "long" });
  const fiscalYear = "FY 2025-26";

  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [selected, setSelected] = useState<FinancialEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soValue, setSoValue] = useState(0);
  const [ifmsValue, setIfmsValue] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [budgetRevise, setBudgetRevise] = useState(false);
  const [reviseReason, setReviseReason] = useState("");

  useEffect(() => {
    let active = true;
    const loadEntries = async () => {
      try {
        const data = await getFinancialEntries();
        if (!active) return;
        setEntries(data);
        const initial = data[0] ?? null;
        setSelected(initial);
        setSoValue(initial?.so ?? 0);
        setIfmsValue(initial?.ifms ?? 0);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadEntries();
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    return entries.reduce<Record<string, FinancialEntry[]>>((acc, entry) => {
      const key = entry.vertical;
      acc[key] = acc[key] ?? [];
      if (entry.scheme.toLowerCase().includes(query.toLowerCase())) {
        acc[key].push(entry);
      } else if (!query) {
        acc[key].push(entry);
      }
      return acc;
    }, {});
  }, [entries, query]);

  const currentStatusColor = selected ? STATUS_COLORS[selected.status] ?? "#95a5a6" : "#95a5a6";
  const utilisation = selected?.annualBudget ? ((ifmsValue / selected.annualBudget) * 100).toFixed(1) : "0.0";
  const lapseRisk = (100 - Number(utilisation)).toFixed(1);
  const isBudgetLocked = now.getMonth() > 3;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] px-6 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
          Loading financial entries...
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] px-6 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
          No financial entries available.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-6 py-8">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-lg">
        {submissionSuccess && (
          <div className="mb-4 rounded-xl border border-[var(--alert-success)] bg-[rgba(0,200,83,0.1)] px-4 py-3 text-sm text-[var(--alert-success)]">
            Submission recorded. Your update is queued for review.
          </div>
        )}
        {draftSaved && (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-muted)]">
            Draft saved. You can return to submit after review.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border border-[var(--alert-critical)] bg-[rgba(255,59,59,0.1)] px-4 py-3 text-sm text-[var(--alert-critical)]">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Financial Entry</p>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{selected.scheme}</h1>
              <div className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.3em]">{selected.vertical}</span>
                <span>{fiscalYear}</span>
                <span>{monthLabel}</span>
              </div>
            </div>
            {isBudgetLocked && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Lock size={16} />
                <span>Budget finalised for FY 2025-26</span>
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
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              {Object.entries(grouped).map(([vertical, schemes]) => (
                <div key={vertical} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
                  <div className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{vertical}</div>
                  <div className="mt-3 space-y-2">
                    {schemes.map(entry => (
                      <button
                        key={entry.id}
                        onClick={() => {
                          setSelected(entry);
                          setSoValue(entry.so);
                          setIfmsValue(entry.ifms);
                          setRemarks("");
                          setBudgetRevise(false);
                          setSubmissionSuccess(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${selected.id === entry.id ? "border-[var(--text-primary)] bg-[var(--bg-primary)]" : "border-transparent hover:border-[var(--border)]"}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.scheme}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">Updated {entry.lastUpdated}</p>
                        </div>
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: currentStatusColor }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[entry.status] }} />
                          <span>{entry.status.replace(/_/g, " ")}</span>
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
                    <div className="text-3xl font-bold text-[var(--text-primary)]">{selected.annualBudget.toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-muted)]">Status: {selected.status.replace(/_/g, " ")}</span>
                    {!isBudgetLocked && (
                      <button
                        className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] uppercase tracking-[0.3em]"
                        onClick={() => setBudgetRevise(prev => !prev)}
                      >
                        Revise
                      </button>
                    )}
                  </div>
                </div>
                {budgetRevise && (
                  <div className="mt-3 flex flex-col gap-2">
                    <label className="text-[11px] uppercase text-[var(--text-muted)]">Reason for revision</label>
                    <textarea
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      rows={2}
                      value={reviseReason}
                      onChange={e => setReviseReason(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-4">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Weekly Expenditure Update</p>
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                    As per SO Order (₹ Cr)
                    <input
                      type="number"
                      value={soValue}
                      onChange={e => setSoValue(Number(e.target.value))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                    As per IFMS (₹ Cr)
                    <input
                      type="number"
                      value={ifmsValue}
                      onChange={e => setIfmsValue(Number(e.target.value))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-[1.2fr_1.2fr] gap-4">
                  <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                    Data as of
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2">
                      <CalendarDays size={16} />
                      <span>{now.toLocaleDateString("en-IN")}</span>
                    </div>
                  </label>
                  <label className="space-y-1 text-[12px] text-[var(--text-muted)]">
                    Remarks
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
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
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)]"
                    onClick={() => {
                      if (budgetRevise && !reviseReason.trim()) {
                        setError("Provide a reason to revise the annual budget before saving.");
                        return;
                      }
                      setError(null);
                      setDraftSaved(true);
                      setTimeout(() => setDraftSaved(false), 1600);
                    }}
                  >
                    Save Draft
                  </button>
                  <button
                    className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={() => {
                      if (budgetRevise && !reviseReason.trim()) {
                        setError("Provide a reason to revise the annual budget before submission.");
                        return;
                      }
                      setError(null);
                      setShowModal(true);
                    }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit for Approval"}
                  </button>
                  <p className="text-xs text-[var(--text-muted)]">Last updated: {selected.lastUpdated} by {selected.submitter || "Finance Desk"}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[420px] rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Confirm submission</h2>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              You are submitting expenditure data for {selected.scheme} as of {now.toLocaleDateString("en-IN")}.
              This will be reviewed by AS before publishing to the dashboard. Confirm?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)]"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => {
                  setIsSubmitting(true);
                  setTimeout(() => {
                    setIsSubmitting(false);
                    setShowModal(false);
                    setSubmissionSuccess(true);
                  }, 650);
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
