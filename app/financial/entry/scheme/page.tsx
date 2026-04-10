"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Lock, Plus, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import {
  fetchFinancialBudgets,
  submitFinancialSnapshot,
  patchFinancialBudget,
  createFinanceBudgetSupplement,
} from "@/src/lib/services/financialService";
import { FinancialEntry } from "@/types";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

// We need a plugin for the horizontal line
const horizontalLinePlugin = {
  id: "horizontalLine",
  beforeDraw: (chart: any) => {
    const { ctx, chartArea, scales } = chart;
    const { y } = scales;

    if (chart.config.options.plugins.horizontalLine?.value !== undefined) {
      const yValue = chart.config.options.plugins.horizontalLine.value;
      const yPixel = y.getPixelForValue(yValue);

      if (yPixel >= chartArea.top && yPixel <= chartArea.bottom) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#95a5a6"; // gray dashed line
        ctx.moveTo(chartArea.left, yPixel);
        ctx.lineTo(chartArea.right, yPixel);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
};
ChartJS.register(horizontalLinePlugin);

const STATUS_COLORS: Record<string, string> = {
  submitted_this_week: "#2ecc71",
  submitted_pending: "#2ecc71",
  draft: "#3498db",
  overdue: "#e74c3c",
  not_started: "#95a5a6",
};

export default function SchemeEntryPage() {
  useRequireRole([UserRole.FA], "/");

  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [financialYearLabel, setFinancialYearLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<FinancialEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscheme selection
  const [selectedSubschemeCode, setSelectedSubschemeCode] = useState<string>("");

  // Card 3 state : IFMS
  const [ifmsValue, setIfmsValue] = useState<number | "">("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");

  // Card 2 state : SO Edit
  const [isEditingSO, setIsEditingSO] = useState(false);
  const [editSoValue, setEditSoValue] = useState<number | "">("");
  const [editSoRemarks, setEditSoRemarks] = useState("");

  // Card 1 state : Supplement
  const [addingSupplement, setAddingSupplement] = useState(false);
  const [supplementAmount, setSupplementAmount] = useState<number | "">("");
  const [supplementReason, setSupplementReason] = useState("");
  const [supplementRefNo, setSupplementRefNo] = useState("");

  // Card 1 state: Revise Budget
  const [revisingBudget, setRevisingBudget] = useState(false);
  const [reviseBudgetAmount, setReviseBudgetAmount] = useState<number | "">("");
  const [reviseBudgetReason, setReviseBudgetReason] = useState("");

  // Local alert state
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "draft" | "error", message: string } | null>(null);

  const triggerAlert = (type: "success" | "draft" | "error", message: string) => {
    setAlertInfo({ type, message });
    if (type !== "error") {
      setTimeout(() => setAlertInfo(null), 3500);
    }
  };

  const loadEntries = useCallback(async () => {
    try {
      const data = await fetchFinancialBudgets();
      setEntries(data.entries);
      setFinancialYearLabel(data.financialYearLabel);
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load financial data";
      setLoadError(msg);
      return null;
    }
  }, []);

  const applyEntry = useCallback((entry: FinancialEntry | null) => {
    setSelected(entry);
    setRemarks("");
    setAlertInfo(null);
    setAddingSupplement(false);
    setRevisingBudget(false);
    setIsEditingSO(false);

    if (!entry) return;

    if (entry.subschemes && entry.subschemes.length > 0) {
      const first = entry.subschemes[0];
      setSelectedSubschemeCode(first.code);
      setIfmsValue(first.ifms ?? 0);
    } else {
      setSelectedSubschemeCode("");
      setIfmsValue(entry.ifms);
    }
    setAsOfDate(new Date().toISOString().slice(0, 10));
  }, []);

  const applySubscheme = useCallback((code: string, entry: FinancialEntry) => {
    const sub = entry.subschemes?.find((s) => s.code === code);
    if (!sub) return;
    setSelectedSubschemeCode(code);
    setIfmsValue(sub.ifms ?? 0);
    setRemarks("");
    setAlertInfo(null);
    setAddingSupplement(false);
    setRevisingBudget(false);
    setIsEditingSO(false);
    setAsOfDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const data = await fetchFinancialBudgets();
        if (!active) return;
        setEntries(data.entries);
        setFinancialYearLabel(data.financialYearLabel);
        applyEntry(data.entries[0] ?? null);
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
  }, [applyEntry]);

  // Derived Values
  const hasSubschemes = (selected?.subschemes?.length ?? 0) > 0;
  const isBudgetLocked = selected?.locked ?? false;

  const activeOriginalBudgetCr = hasSubschemes
    ? (selected?.subschemes?.find((s) => s.code === selectedSubschemeCode)?.annualBudget ?? 0)
    : (selected?.annualBudget ?? 0);

  const activeTotalSupplementCr = hasSubschemes
    ? (selected?.subschemes?.find((s) => s.code === selectedSubschemeCode)?.totalSupplementCr ?? 0)
    : (selected?.totalSupplementCr ?? 0);

  const activeEffectiveBudgetCr = hasSubschemes
    ? (selected?.subschemes?.find((s) => s.code === selectedSubschemeCode)?.effectiveBudgetCr ?? 0)
    : (selected?.effectiveBudgetCr ?? 0);

  const activeSupplements = hasSubschemes
    ? (selected?.subschemes?.find((s) => s.code === selectedSubschemeCode)?.supplements ?? [])
    : (selected?.supplements ?? []);

  const activeHistory = hasSubschemes
    ? (selected?.subschemes?.find((s) => s.code === selectedSubschemeCode)?.history ?? [])
    : (selected?.history ?? []);

  const currentSO = hasSubschemes
    ? (selected?.subschemes?.find((s) => s.code === selectedSubschemeCode)?.so ?? 0)
    : (selected?.so ?? 0);

  const currentIFMS = hasSubschemes
    ? (selected?.subschemes?.find((s) => s.code === selectedSubschemeCode)?.ifms ?? 0)
    : (selected?.ifms ?? 0);

  const utilisation = activeEffectiveBudgetCr ? ((currentIFMS / activeEffectiveBudgetCr) * 100).toFixed(1) : "0.0";
  const lapseRisk = (100 - Number(utilisation)).toFixed(1);
  const soPercent = activeEffectiveBudgetCr ? ((currentSO / activeEffectiveBudgetCr) * 100).toFixed(1) : "0.0";

  // Aggregated supplement text
  let supCountText = "No adjustments";
  if (activeSupplements.length > 0) {
    const topups = activeSupplements.filter(s => s.amountCr > 0).length;
    const divs = activeSupplements.filter(s => s.amountCr < 0).length;
    const parts = [];
    if (topups > 0) parts.push(`${topups} top-up${topups > 1 ? 's' : ''}`);
    if (divs > 0) parts.push(`${divs} diversion${divs > 1 ? 's' : ''}`);
    supCountText = parts.join(", ");
  }

  // Submit operations
  const handleSaveDraft = () => persistSnapshot("draft");
  const handleSaveSubmit = () => persistSnapshot("submitted");

  const persistSnapshot = async (workflowStatus: "draft" | "submitted") => {
    if (!selected || !financialYearLabel) return;
    if (addingSupplement || revisingBudget || isEditingSO) {
      if (!window.confirm("You have open unsaved forms. Proceed anyway?")) {
        return;
      }
    }

    if (ifmsValue === "" || Number(ifmsValue) < 0) {
      triggerAlert("error", "IFMS value must be a non-negative number.");
      return;
    }

    setIsSubmitting(true);
    setAlertInfo(null);
    try {
      await submitFinancialSnapshot({
        schemeCode: selected.id,
        subschemeCode: hasSubschemes ? selectedSubschemeCode : null,
        asOfDate,
        soExpenditureCr: currentSO,
        ifmsExpenditureCr: Number(ifmsValue),
        remarks,
        financialYearLabel,
        workflowStatus,
      });

      if (workflowStatus === "draft") {
        triggerAlert("draft", "Draft saved.");
      } else {
        triggerAlert("success", "Update saved securely.");
        const data = await loadEntries();
        if (data) {
          const next = data.entries.find((e) => e.id === selected.id) ?? data.entries[0] ?? null;
          if (next) {
            applyEntry(next);
            if (hasSubschemes && selectedSubschemeCode) {
              const sub = next.subschemes?.find(s => s.code === selectedSubschemeCode);
              if (sub) {
                applySubscheme(selectedSubschemeCode, next);
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      triggerAlert("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSupplement = async () => {
    if (!selected || !financialYearLabel) return;
    if (supplementAmount === "" || isNaN(Number(supplementAmount)) || Number(supplementAmount) === 0) {
      triggerAlert("error", "Enter a valid non-zero amount.");
      return;
    }
    if (!supplementReason.trim()) {
      triggerAlert("error", "Reason is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createFinanceBudgetSupplement({
        schemeCode: selected.id,
        subschemeCode: hasSubschemes ? selectedSubschemeCode : null,
        financialYearLabel,
        amountCr: Number(supplementAmount),
        reason: supplementReason,
        referenceNo: supplementRefNo,
      });
      setAddingSupplement(false);
      setSupplementAmount("");
      setSupplementReason("");
      setSupplementRefNo("");
      await loadEntries();
      triggerAlert("success", "Supplement added successfully.");
    } catch (e: unknown) {
      triggerAlert("error", e instanceof Error ? e.message : "Failed to add supplement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviseBudget = async () => {
    if (!selected || !financialYearLabel) return;
    if (reviseBudgetAmount === "" || isNaN(Number(reviseBudgetAmount)) || Number(reviseBudgetAmount) <= 0) {
      triggerAlert("error", "Enter a valid positive budget amount.");
      return;
    }
    if (!reviseBudgetReason.trim()) {
      triggerAlert("error", "Reason is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await patchFinancialBudget({
        schemeCode: selected.id,
        subschemeCode: hasSubschemes ? selectedSubschemeCode : null,
        financialYearLabel,
        newBudgetCr: Number(reviseBudgetAmount),
        reason: reviseBudgetReason
      });
      setRevisingBudget(false);
      setReviseBudgetAmount("");
      setReviseBudgetReason("");
      await loadEntries();
      triggerAlert("success", "Budget revised successfully.");
    } catch (e: unknown) {
      triggerAlert("error", e instanceof Error ? e.message : "Failed to revise budget.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSO = async () => {
    if (!selected || !financialYearLabel) return;
    if (editSoValue === "" || isNaN(Number(editSoValue)) || Number(editSoValue) < 0) {
      triggerAlert("error", "Enter a valid non-negative SO amount.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Per instructions SO update logic; substituting submitFinancialSnapshot for SO update
      await submitFinancialSnapshot({
        schemeCode: selected.id,
        subschemeCode: hasSubschemes ? selectedSubschemeCode : null,
        asOfDate: new Date().toISOString().slice(0, 10),
        soExpenditureCr: Number(editSoValue),
        ifmsExpenditureCr: currentIFMS,
        remarks: editSoRemarks,
        financialYearLabel,
        workflowStatus: "submitted",
      });
      setIsEditingSO(false);
      setEditSoValue("");
      setEditSoRemarks("");
      await loadEntries();
      triggerAlert("success", "SO updated successfully.");
    } catch (e: unknown) {
      triggerAlert("error", e instanceof Error ? e.message : "Failed to update SO.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedSchemes = useMemo(() => {
    return entries.filter(e => e.scheme.toLowerCase().includes(query.toLowerCase()));
  }, [entries, query]);

  // Chart configuration
  const chartData = {
    labels: activeHistory.map(h => new Date(h.asOfDate).toLocaleString('en-IN', { month: 'short', year: '2-digit' })),
    datasets: [
      {
        label: "IFMS Actual",
        data: activeHistory.map(h => h.ifms),
        backgroundColor: "rgba(46, 204, 113, 0.8)",
        borderRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      horizontalLine: { value: currentSO }
    },
    scales: {
      x: {
        ticks: { autoSkip: false, maxRotation: 45, minRotation: 0, font: { size: 10 } },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 } }
      }
    }
  };

  return (
    <AppShell title="Financial Data Entry">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[var(--bg-document)]">
        {/* SCHEME SELECTOR SIDEBAR */}
        <div className="w-72 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] flex flex-col">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search scheme..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg-document)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {groupedSchemes.map(entry => {
              const isActive = selected?.id === entry.id;
              const hasSubs = (entry.subschemes?.length ?? 0) > 0;
              return (
                <div key={entry.id} className="space-y-1">
                  <button
                    onClick={() => applyEntry(entry)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg transition-colors ${isActive ? 'bg-[var(--bg-content-surface)] border border-[var(--accent)] shadow-sm' : 'hover:bg-[var(--bg-content-surface)] border border-transparent'}`}
                  >
                    <span className={`text-sm font-medium truncate pr-2 ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{entry.scheme}</span>
                    <span
                      className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[entry.status] || '#95a5a6' }}
                    />
                  </button>
                  {isActive && hasSubs && (
                    <div className="ml-4 pl-3 border-l-2 border-[var(--accent)] space-y-1">
                      {entry.subschemes?.map(sub => {
                        const isActiveSub = sub.code === selectedSubschemeCode;
                        return (
                          <button
                            key={sub.code}
                            onClick={() => applySubscheme(sub.code, entry)}
                            className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${isActiveSub ? 'bg-[var(--bg-content-surface)] font-medium text-[var(--text-primary)] border border-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:bg-[var(--bg-content-surface)]'}`}
                          >
                            <span className="block font-semibold">{sub.code}</span>
                            <span className="block truncate opacity-80">{sub.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* ALERTS */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
            {alertInfo && (
              <div className={`px-4 py-3 rounded-lg shadow-lg border text-sm flex items-center gap-2 transition-all ${alertInfo.type === 'error' ? 'bg-[rgba(200,30,30,0.1)] border-[#f8b4b4] text-[#e74c3c]' :
                alertInfo.type === 'success' ? 'bg-[rgba(46,204,113,0.1)] border-[#b0e8ce] text-[#2ecc71]' :
                  'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]'
                }`}>
                <span>{alertInfo.message}</span>
              </div>
            )}
          </div>

          {!loading && !loadError && selected && (
            <>
              {/* HEADER */}
              <div className="px-8 py-6 border-b border-[var(--border)] bg-[var(--bg-document)]">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
                      {selected.scheme}
                    </h1>
                    {hasSubschemes && selectedSubschemeCode && (
                      <div className="mt-2 flex gap-2">
                        {selected.subschemes?.map(sub => (
                          <button
                            key={sub.code}
                            onClick={() => applySubscheme(sub.code, selected)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition ${sub.code === selectedSubschemeCode ? 'bg-[var(--text-primary)] text-black' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)]'}`}
                          >
                            {sub.code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {isBudgetLocked && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-surface)] px-3 py-1.5 rounded-full border border-[var(--border)]">
                      <Lock className="w-3.5 h-3.5" />
                      Locked
                    </div>
                  )}
                </div>
              </div>

              {/* CARDS */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

                {/* CARD 1: Annual Budget */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-content-surface)]">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Annual Budget</h2>
                    {!isBudgetLocked && (
                      <button
                        onClick={() => setRevisingBudget(true)}
                        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] px-3 py-1 rounded border border-[var(--border)]"
                      >
                        Revise Budget
                      </button>
                    )}
                  </div>
                  <div className="p-5">

                    {/* Revise Form */}
                    {revisingBudget && (
                      <div className="mb-5 p-4 rounded-lg bg-[rgba(0,0,0,0.02)] border border-[var(--border)]">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Revise Budget Estimate</h3>
                          <button onClick={() => setRevisingBudget(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <input type="number" step="0.01" min="0" placeholder="New Budget (₹ Cr)" className="w-full text-sm p-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] rounded-md" value={reviseBudgetAmount} onChange={e => setReviseBudgetAmount(e.target.value ? Number(e.target.value) : "")} />
                          </div>
                          <div className="flex-[2]">
                            <input type="text" placeholder="Reason (Required)" className="w-full text-sm p-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] rounded-md" value={reviseBudgetReason} onChange={e => setReviseBudgetReason(e.target.value)} />
                          </div>
                          <button onClick={handleReviseBudget} disabled={isSubmitting} className="bg-[var(--text-primary)] text-[var(--bg-document)] font-semibold text-sm px-4 rounded-md">Confirm</button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <div className="text-xs text-[var(--text-muted)] mb-1">Original</div>
                        <div className="text-2xl font-semibold">₹ {activeOriginalBudgetCr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-muted)] mb-1">Supplementary</div>
                        <div className={`text-2xl font-semibold ${activeTotalSupplementCr > 0 ? 'text-[#2ecc71]' : activeTotalSupplementCr < 0 ? 'text-[#e74c3c]' : 'text-[var(--text-primary)]'}`}>
                          {activeTotalSupplementCr > 0 ? '+' : ''}{activeTotalSupplementCr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">{supCountText}</div>
                      </div>
                      <div className="bg-[var(--bg-content-surface)] border border-[var(--border)] p-3 rounded-lg flex flex-col justify-center shadow-sm">
                        <div className="text-[11px] text-[#3498db] font-semibold mb-1 uppercase tracking-wider">Effective</div>
                        <div className="text-2xl font-bold text-[#3498db]">₹ {activeEffectiveBudgetCr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr</div>
                      </div>
                    </div>

                    {activeSupplements.length > 0 && (
                      <div className="mt-6">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3 border-b border-[var(--border)] pb-2">Recent Adjustments</div>
                        <div className="space-y-2.5">
                          {activeSupplements.map(sup => (
                            <div key={sup.id} className="flex items-start justify-between bg-[var(--bg-content-surface)] p-2.5 rounded border border-[var(--border)]">
                              <div>
                                <div className="font-medium text-sm text-[var(--text-primary)]">{sup.reason}</div>
                                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex gap-2">
                                  <span>{new Date(sup.createdAt).toLocaleDateString('en-IN')}</span>
                                  <span>•</span>
                                  <span>{sup.createdByName}</span>
                                  {sup.referenceNo && (
                                    <><span>•</span><span>Ref: {sup.referenceNo}</span></>
                                  )}
                                </div>
                              </div>
                              <div className={`text-sm font-bold ${sup.amountCr > 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
                                {sup.amountCr > 0 ? '+' : ''}{sup.amountCr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isBudgetLocked && !addingSupplement && (
                      <button
                        onClick={() => setAddingSupplement(true)}
                        className="mt-5 text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5 hover:underline"
                      >
                        <Plus className="w-4 h-4" /> Add supplement
                      </button>
                    )}

                    {addingSupplement && (
                      <div className="mt-5 p-4 rounded-lg bg-[var(--bg-document)] border border-[var(--border)] shadow-inner">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add Supplement</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Amount (₹ Cr) — accepts negative</label>
                            <input type="number" step="0.01" className="w-full text-sm p-2.5 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] rounded-md" value={supplementAmount} onChange={e => setSupplementAmount(e.target.value ? Number(e.target.value) : "")} />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Reference No. (optional)</label>
                            <input type="text" className="w-full text-sm p-2.5 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] rounded-md" value={supplementRefNo} onChange={e => setSupplementRefNo(e.target.value)} />
                          </div>
                        </div>
                        <div className="mb-4">
                          <label className="block text-xs text-[var(--text-muted)] mb-1">Reason</label>
                          <textarea className="w-full text-sm p-2.5 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] rounded-md resize-none h-20" value={supplementReason} onChange={e => setSupplementReason(e.target.value)} />
                        </div>
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => setAddingSupplement(false)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium px-4 py-2">Cancel</button>
                          <button disabled={isSubmitting} onClick={handleAddSupplement} className="bg-[#2ecc71] h-9 hover:bg-[#27ae60] text-white font-semibold text-sm px-6 rounded-md shadow-sm transition">Confirm</button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* CARD 2: Expenditure Status */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-content-surface)]">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Expenditure Status</h2>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="grid grid-cols-2 gap-8 flex-1">
                      {/* Left: SO */}
                      <div className="flex flex-col border-r border-[var(--border)] pr-8">
                        {!isEditingSO ? (
                          <div className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--border)]">
                            <div>
                              <div className="text-xs text-[var(--text-muted)] mb-1">SO Sanction Amount</div>
                              <div className="text-3xl font-light text-[var(--text-primary)]">₹ {currentSO.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr</div>
                            </div>
                            <button onClick={() => setIsEditingSO(true)} className="px-4 py-1.5 rounded border border-[var(--border)] text-sm font-medium hover:bg-[var(--bg-content-surface)]">Edit</button>
                          </div>
                        ) : (
                          <div className="bg-[rgba(52,152,219,0.05)] border border-[rgba(52,152,219,0.2)] p-4 rounded-lg mb-8">
                            <div className="text-xs font-semibold text-[#2980b9] uppercase tracking-wider mb-3">Update Sanction Amount</div>
                            <div className="space-y-3">
                              <input type="number" step="0.01" min="0" placeholder="New SO Amount (₹ Cr)" className="w-full text-sm p-2 bg-[var(--bg-primary)] border border-[#b3d4ec] rounded-md shadow-sm text-[var(--text-primary)]" value={editSoValue} onChange={e => setEditSoValue(e.target.value ? Number(e.target.value) : "")} />
                              <input type="text" placeholder="Remarks or Reference" className="w-full text-sm p-2 bg-[var(--bg-primary)] border border-[#b3d4ec] rounded-md shadow-sm text-[var(--text-primary)]" value={editSoRemarks} onChange={e => setEditSoRemarks(e.target.value)} />
                              <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsEditingSO(false)} className="text-xs font-medium text-[#2980b9] px-3 py-1.5 hover:bg-[rgba(52,152,219,0.1)] rounded">Cancel</button>
                                <button onClick={handleUpdateSO} disabled={isSubmitting} className="text-xs font-semibold text-white bg-[#3498db] px-4 py-1.5 rounded shadow-sm hover:bg-[#2980b9] transition">Confirm</button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-auto pt-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                <span>SO Sanctioned</span>
                                <span className="font-semibold text-[var(--text-primary)]">{soPercent}% of Effective Budget</span>
                              </div>
                              <div className="h-1.5 w-full bg-[var(--bg-content-surface)] rounded-full overflow-hidden">
                                <div className="h-full bg-[#3498db] transition-all" style={{ width: `${Math.min(100, Number(soPercent))}%` }} />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                <span>IFMS Actual</span>
                                <span className="font-semibold text-[var(--text-primary)]">{utilisation}% of Effective Budget</span>
                              </div>
                              <div className="h-1.5 w-full bg-[var(--bg-content-surface)] rounded-full overflow-hidden">
                                <div className="h-full bg-[#2ecc71] transition-all" style={{ width: `${Math.min(100, Number(utilisation))}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Chart */}
                      <div className="flex flex-col">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">IFMS Spending History</h3>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-[rgba(46,204,113,0.8)]" /> IFMS</span>
                            <span className="flex items-center gap-1.5"><div className="w-3 h-0 border-t-2 border-dashed border-[#95a5a6]" /> Current SO</span>
                          </div>
                        </div>
                        <div className="flex-1 relative min-h-[160px]">
                          {activeHistory.length > 0 ? (
                            <Bar data={chartData} options={chartOptions as any} />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-muted)] font-medium">No IFMS history available.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom strip */}
                  <div className="bg-[var(--bg-content-surface)] border-t border-[var(--border)] p-4 flex items-center gap-6">
                    <div className="flex-1 flex items-center gap-4 bg-[var(--bg-primary)] p-2 border border-[var(--border)] rounded-lg">
                      <div className="w-12 h-12 rounded-full border-4 border-[#2ecc71] flex items-center justify-center font-bold text-sm text-[#2ecc71]">{utilisation}%</div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Utilisation</div>
                        <div className="text-xs mt-0.5"><span className="font-semibold text-[var(--text-primary)]">₹{currentIFMS.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> / ₹{activeEffectiveBudgetCr.toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center gap-4 bg-[var(--bg-primary)] p-2 border border-[var(--border)] rounded-lg">
                      <div className="w-12 h-12 rounded-full border-4 border-[#e74c3c] flex items-center justify-center font-bold text-sm text-[#e74c3c]">{lapseRisk}%</div>
                      <div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Lapse Risk</div>
                        <div className="text-xs mt-0.5"><span className="font-semibold text-[var(--text-primary)]">₹{(activeEffectiveBudgetCr - currentIFMS).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> remaining</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 3: Update IFMS */}
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
                  <div className="px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Add IFMS Update</h2>
                  </div>
                  <div className="p-5 flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Updated IFMS Expenditure (₹ Cr)</label>
                      <input type="number" min="0" step="0.01" className="w-full p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md text-sm font-semibold shadow-sm focus:border-[var(--text-primary)] focus:outline-none text-[var(--text-primary)]" value={ifmsValue} onChange={e => setIfmsValue(e.target.value ? Number(e.target.value) : "")} />
                    </div>
                    <div className="w-48">
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Data as of Date</label>
                      <input type="date" className="w-full p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md text-sm shadow-sm focus:border-[var(--text-primary)] focus:outline-none text-[var(--text-primary)]" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
                    </div>
                    <div className="flex-[2]">
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Remarks</label>
                      <textarea rows={1} className="w-full p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md text-sm resize-none shadow-sm focus:border-[var(--text-primary)] focus:outline-none text-[var(--text-primary)]" placeholder="Provide context..." value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER BAR */}
              <div className="h-16 border-t border-[var(--border)] bg-[var(--bg-content-surface)] px-8 flex items-center justify-between shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-10 relative">
                <div className="text-xs text-[var(--text-muted)]">
                  Last updated {selected.lastUpdated} by <span className="font-medium text-[var(--text-primary)]">{selected.submitter || "Finance Desk"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleSaveDraft} disabled={isSubmitting} className="px-5 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.02)] transition">Save Draft</button>
                  <button onClick={handleSaveSubmit} disabled={isSubmitting} className="px-6 py-2 rounded-lg text-sm font-semibold border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)] shadow hover:opacity-90 transition">Save & Submit</button>
                </div>
              </div>
            </>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-[var(--text-muted)]">
              Loading data...
            </div>
          )}
          {!loading && loadError && !selected && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-[var(--bg-document)]">
              <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[#f8b4b4] rounded-xl p-6 shadow-sm">
                <h3 className="text-[#c81e1e] font-semibold mb-2">Initialization Error</h3>
                <p className="text-sm text-[var(--text-muted)]">{loadError}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border)] rounded text-sm font-medium hover:bg-[var(--bg-surface)] transition">Retry</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
