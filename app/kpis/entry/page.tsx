"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import { fetchKPISubmissions, submitKPIMeasurement } from "@/src/lib/services/kpiService";
import { KPISubmission } from "@/types";
import StatusBadge from "@/src/components/ui/StatusBadge";

interface RowState {
  saving?: boolean;
  saved?: boolean;
  submitted?: boolean;
  error?: string;
}

export default function KPIEntryPage() {
  useRequireRole([UserRole.NODAL_OFFICER], "/dashboard");

  const [submissions, setSubmissions] = useState<KPISubmission[]>([]);
  const [financialYearLabel, setFinancialYearLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedSchemes, setExpandedSchemes] = useState<Record<string, boolean>>({});

  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [binaryResponses, setBinaryResponses] = useState<Record<string, boolean | null>>({});
  const [numeratorById, setNumeratorById] = useState<Record<string, number | "">>({});
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});

  const reload = async () => {
    const data = await fetchKPISubmissions();
    setSubmissions(data.submissions);
    setFinancialYearLabel(data.financialYearLabel);
    const num: Record<string, number | ""> = {};
    const rem: Record<string, string> = {};
    for (const s of data.submissions) {
      num[s.id] = s.numerator ?? "";
      rem[s.id] = s.remarks ?? "";
    }
    setNumeratorById(num);
    setRemarksById(rem);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await reload();
      } catch (e: unknown) {
        if (!active) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load KPIs");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  // Group all API-returned submissions by scheme (no client-side user filter —
  // the API already scopes data to the session user's assignments)
  const grouped = useMemo(() => {
    const schemeNames = Array.from(new Set(submissions.map((s) => s.scheme)));
    return schemeNames.map((scheme) => ({
      scheme,
      items: submissions.filter((s) => s.scheme === scheme),
    }));
  }, [submissions]);

  // Auto-expand all schemes and select first KPI when data loads
  useEffect(() => {
    if (grouped.length === 0) return;
    const expanded: Record<string, boolean> = {};
    grouped.forEach(({ scheme }) => { expanded[scheme] = true; });
    setExpandedSchemes(expanded);
    if (!selectedId && grouped[0]?.items[0]) {
      setSelectedId(grouped[0].items[0].id);
    }
  }, [grouped, selectedId]);

  const selectedItem = useMemo(
    () => submissions.find((s) => s.id === selectedId) ?? null,
    [submissions, selectedId],
  );

  const completion = useMemo(() => {
    const total = submissions.length;
    const submitted = submissions.filter((s) =>
      ["submitted", "submitted_pending", "approved"].includes(s.status),
    ).length;
    return { total, submitted };
  }, [submissions]);

  const canEditSelected = useMemo(() => {
    if (!selectedItem) return false;
    return selectedItem.currentUserCanEnter !== false;
  }, [selectedItem]);

  const getValidationError = (item: KPISubmission, newNum: number | ""): string | null => {
    if (item.status === "approved" && item.numerator != null && newNum !== "") {
      if (Number(newNum) < item.numerator) {
        return `Value cannot go below the approved value of ${item.numerator} ${item.unit}.`;
      }
    }
    return null;
  };

  const handleRowAction = async (id: string, mode: "draft" | "submit") => {
    const item = submissions.find((row) => row.id === id);
    if (!item || !financialYearLabel) return;
    if (item.currentUserCanEnter === false) return;

    if (item.type !== "BINARY") {
      const err = getValidationError(item, numeratorById[id] ?? "");
      if (err) {
        setRowState((prev) => ({ ...prev, [id]: { error: err } }));
        return;
      }
    }

    setRowState((prev) => ({ ...prev, [id]: { saving: true } }));
    try {
      const measuredAt = new Date().toISOString().slice(0, 10);
      const num = numeratorById[id] === "" ? null : Number(numeratorById[id]);
      await submitKPIMeasurement({
        kpiDefinitionId: item.id,
        financialYearLabel,
        measuredAt,
        numeratorValue: Number.isFinite(num as number) ? num : null,
        // denominator is always read-only here; do not send it
        yesValue: item.type === "BINARY" ? (binaryResponses[id] ?? null) : null,
        remarks: remarksById[id] ?? "",
        workflowStatus: mode === "draft" ? "draft" : "submitted",
      });
      await reload();
      setRowState((prev) => ({
        ...prev,
        [id]: { saving: false, saved: mode === "draft", submitted: mode === "submit" },
      }));
      setTimeout(() => {
        setRowState((prev) => ({ ...prev, [id]: {} }));
      }, 2200);
    } catch (e: unknown) {
      setRowState((prev) => ({
        ...prev,
        [id]: { saving: false, error: e instanceof Error ? e.message : "Save failed" },
      }));
    }
  };

  const toggleScheme = (scheme: string) =>
    setExpandedSchemes((prev) => ({ ...prev, [scheme]: !prev[scheme] }));

  const statusDot = (status: KPISubmission["status"]) => {
    if (status === "approved") return "bg-[var(--alert-success)]";
    if (status === "submitted" || status === "submitted_pending") return "bg-[var(--alert-warning,#f59e0b)]";
    if (status === "draft") return "bg-[var(--text-muted)]";
    return "bg-[var(--border)]";
  };

  return (
    <AppShell title="KPI Entry">
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* ── Left sidebar ── */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-card)] overflow-y-auto">
          <div className="border-b border-[var(--border)] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-muted)]">KPI Entry</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {financialYearLabel ?? "—"}
            </p>
            {!loading && (
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {completion.submitted} / {completion.total} submitted
              </p>
            )}
          </div>

          {loading && (
            <div className="px-4 py-6 text-xs text-[var(--text-muted)]">Loading…</div>
          )}
          {loadError && (
            <div className="px-4 py-4 text-xs text-[var(--alert-critical)]">{loadError}</div>
          )}
          {!loading && grouped.length === 0 && (
            <div className="px-4 py-6 text-xs text-[var(--text-muted)]">No KPIs assigned.</div>
          )}

          <nav className="flex-1 py-2">
            {grouped.map(({ scheme, items }) => (
              <div key={scheme}>
                {/* Scheme header */}
                <button
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={() => toggleScheme(scheme)}
                >
                  <span className="truncate">{scheme}</span>
                  <span className="ml-2 shrink-0 text-[10px]">
                    {expandedSchemes[scheme] ? "▲" : "▼"}
                  </span>
                </button>

                {/* KPI list under scheme */}
                {expandedSchemes[scheme] && (
                  <ul>
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => setSelectedId(item.id)}
                          className={`flex w-full items-start gap-2 px-4 py-2 text-left transition ${
                            selectedId === item.id
                              ? "bg-[var(--bg-surface)] border-l-2 border-[var(--text-primary)]"
                              : "hover:bg-[var(--bg-surface)] border-l-2 border-transparent"
                          }`}
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(item.status)}`}
                          />
                          <span className="text-xs leading-snug text-[var(--text-primary)]">
                            {item.description}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Main detail panel ── */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-primary)] px-8 py-8">
          {!selectedItem && !loading && (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              Select a KPI from the sidebar to enter data.
            </div>
          )}

          {selectedItem && (() => {
            const item = selectedItem;
            const row = rowState[item.id] ?? {};
            const binaryValue = binaryResponses[item.id] ?? item.yes ?? null;
            const numVal = numeratorById[item.id];
            const denVal = item.denominator;
            const computed =
              numVal !== "" && numVal != null && denVal != null && denVal !== 0
                ? (((Number(numVal) / denVal) * 100).toFixed(1))
                : null;

            const isApproved = item.status === "approved";
            const approvedNum = item.numerator;
            const validationError =
              item.type !== "BINARY" ? getValidationError(item, numVal ?? "") : null;

            return (
              <div className="mx-auto max-w-2xl space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-muted)]">
                      {item.scheme} · {item.vertical}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                      {item.description}
                    </h2>
                    {(item.assignedToName || item.reviewerName) && (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {item.assignedToName && (
                          <span>
                            Action owner: <span className="text-[var(--text-primary)]">{item.assignedToName}</span>
                          </span>
                        )}
                        {item.assignedToName && item.reviewerName ? " · " : ""}
                        {item.reviewerName && (
                          <span>
                            Reviewer: <span className="text-[var(--text-primary)]">{item.reviewerName}</span>
                          </span>
                        )}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1">
                        {item.type}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1">
                        {item.category}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1">
                        {item.unit}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {/* Approved-decrease warning */}
                {isApproved && approvedNum != null && (
                  <div className="rounded-xl border border-[var(--alert-warning,#f59e0b)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-xs text-[var(--alert-warning,#f59e0b)]">
                    Last approved value: <strong>{approvedNum} {item.unit}</strong>. New numerator cannot be set lower than this.
                  </div>
                )}

                {!canEditSelected && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
                    You can view this KPI, but only the assigned action owner may enter or update progress (unless an administrator overrides).
                  </div>
                )}

                {/* Entry form */}
                <div className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 ${!canEditSelected ? "pointer-events-none opacity-50" : ""}`}>
                  {item.type === "BINARY" ? (
                    <div className="space-y-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Response</p>
                      <div className="flex gap-3">
                        <button
                          className={`rounded-xl border px-6 py-2.5 text-xs uppercase tracking-[0.3em] transition ${
                            binaryValue === true
                              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-primary)]"
                          }`}
                          onClick={() => setBinaryResponses((prev) => ({ ...prev, [item.id]: true }))}
                        >
                          Yes
                        </button>
                        <button
                          className={`rounded-xl border px-6 py-2.5 text-xs uppercase tracking-[0.3em] transition ${
                            binaryValue === false
                              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                              : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-primary)]"
                          }`}
                          onClick={() => setBinaryResponses((prev) => ({ ...prev, [item.id]: false }))}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-3">
                      {/* Numerator */}
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                          Numerator
                        </label>
                        <input
                          type="number"
                          value={numeratorById[item.id] ?? ""}
                          min={isApproved && approvedNum != null ? approvedNum : undefined}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : Number(e.target.value);
                            setNumeratorById((prev) => ({ ...prev, [item.id]: val }));
                            // clear error on change
                            if (rowState[item.id]?.error) {
                              setRowState((prev) => ({ ...prev, [item.id]: {} }));
                            }
                          }}
                          className={`w-full rounded-xl border px-4 py-2.5 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] focus:outline-none focus:ring-1 ${
                            validationError
                              ? "border-[var(--alert-critical)] focus:ring-[var(--alert-critical)]"
                              : "border-[var(--border)] focus:ring-[var(--text-primary)]"
                          }`}
                        />
                        {validationError && (
                          <p className="text-[11px] text-[var(--alert-critical)]">{validationError}</p>
                        )}
                      </div>

                      {/* Denominator — always read-only */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                          Denominator
                          {/* <span className="rounded px-1.5 py-0.5 text-[8px] bg-[var(--bg-surface)] border border-[var(--border)]">
                            Read-only
                          </span> */}
                        </label>
                        <input
                          type="number"
                          value={denVal ?? ""}
                          readOnly
                          disabled
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-muted)] opacity-60 cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                        Percentage{" "}
                      </label>
                      <input type="number" value={computed != null ? `${computed}%` : "—"} readOnly disabled className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-muted)] opacity-60 cursor-not-allowed" />
                    </div>
                    </div>
                  )}

                  {/* Computed % row */}
                  {/* {item.type !== "BINARY" && computed != null && (
                    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-[var(--text-muted)]">
                      Computed:{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {Number(numeratorById[item.id]) ?? 0} / {denVal ?? 0} ={" "}
                        {computed}%
                      </span>
                    </div>
                  )} */}

                  {/* Remarks */}
                  <div className="mt-5 space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                      Remarks{" "}
                      <span className="normal-case tracking-normal text-[var(--text-muted)] opacity-60">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={remarksById[item.id] ?? ""}
                      onChange={(e) =>
                        setRemarksById((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Add any notes or context…"
                      className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--text-primary)]"
                    />
                  </div>

                  {/* Error message */}
                  {row.error && (
                    <div className="mt-4 rounded-xl border border-[var(--alert-critical)] bg-[rgba(239,68,68,0.08)] px-4 py-2.5 text-xs text-[var(--alert-critical)]">
                      {row.error}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      disabled={row.saving || !!validationError}
                      onClick={() => handleRowAction(item.id, "draft")}
                      className="rounded-xl border border-[var(--border)] px-5 py-2 text-xs uppercase tracking-[0.25em] text-[var(--text-muted)] transition hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {row.saving ? "Saving…" : row.saved ? "Draft Saved ✓" : "Save Draft"}
                    </button>
                    <button
                      disabled={row.saving || !!validationError}
                      onClick={() => handleRowAction(item.id, "submit")}
                      className="rounded-xl bg-[var(--text-primary)] px-5 py-2 text-xs uppercase tracking-[0.25em] text-[var(--bg-primary)] transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {row.saving ? "Submitting…" : row.submitted ? "Submitted ✓" : "Submit"}
                    </button>
                  </div>
                </div>

                {/* Meta footer */}
                <div className="text-[11px] text-[var(--text-muted)]">
                  Last updated: {item.lastUpdated}
                  {financialYearLabel && <> · FY {financialYearLabel}</>}
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </AppShell>
  );
}
