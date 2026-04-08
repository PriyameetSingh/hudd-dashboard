"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import { fetchKPISubmissions, submitKPIMeasurement } from "@/src/lib/services/kpiService";
import { KPISubmission } from "@/types";
import StatusBadge from "@/src/components/ui/StatusBadge";

interface SchemeCardState {
  saving?: boolean;
  saved?: boolean;
}

interface RowState {
  saving?: boolean;
  saved?: boolean;
  submitted?: boolean;
}

export default function KPIEntryPage() {
  const user = useRequireRole([UserRole.NODAL_OFFICER], "/dashboard");
  const [submissions, setSubmissions] = useState<KPISubmission[]>([]);
  const [financialYearLabel, setFinancialYearLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardState, setCardState] = useState<Record<string, SchemeCardState>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [binaryResponses, setBinaryResponses] = useState<Record<string, boolean | null>>({});
  const [numeratorById, setNumeratorById] = useState<Record<string, number | "">>({});
  const [denominatorById, setDenominatorById] = useState<Record<string, number | "">>({});
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});

  const reload = async () => {
    const data = await fetchKPISubmissions();
    setSubmissions(data.submissions);
    setFinancialYearLabel(data.financialYearLabel);
    const num: Record<string, number | ""> = {};
    const den: Record<string, number | ""> = {};
    const rem: Record<string, string> = {};
    for (const s of data.submissions) {
      num[s.id] = s.numerator ?? "";
      den[s.id] = s.denominator ?? "";
      rem[s.id] = s.remarks ?? "";
    }
    setNumeratorById(num);
    setDenominatorById(den);
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
    return () => {
      active = false;
    };
  }, []);

  const assignedSchemes = useMemo(() => {
    if (!user) return [] as string[];
    const allSchemes = Array.from(new Set(submissions.map((item) => item.scheme)));
    if (user.assignedSchemes.some((scheme) => scheme.toLowerCase() === "all schemes")) {
      return allSchemes;
    }
    return user.assignedSchemes.filter((scheme) => allSchemes.includes(scheme));
  }, [user, submissions]);

  const grouped = useMemo(() => {
    return assignedSchemes.map((scheme) => ({
      scheme,
      items: submissions.filter((item) => item.scheme === scheme),
    }));
  }, [assignedSchemes, submissions]);

  const completion = useMemo(() => {
    const total = submissions.length;
    const submitted = submissions.filter((item) => ["submitted", "submitted_pending", "approved"].includes(item.status)).length;
    return { total, submitted };
  }, [submissions]);

  const handleSave = async (scheme: string) => {
    setCardState((prev) => ({ ...prev, [scheme]: { saving: true } }));
    try {
      await reload();
      setCardState((prev) => ({ ...prev, [scheme]: { saved: true } }));
      setTimeout(() => {
        setCardState((prev) => ({ ...prev, [scheme]: { saved: false } }));
      }, 1600);
    } catch {
      setCardState((prev) => ({ ...prev, [scheme]: {} }));
    } finally {
      setCardState((prev) => ({ ...prev, [scheme]: { saving: false } }));
    }
  };

  const handleRowAction = async (id: string, mode: "draft" | "submit") => {
    const item = submissions.find((row) => row.id === id);
    if (!item || !financialYearLabel) {
      return;
    }
    setRowState((prev) => ({ ...prev, [id]: { saving: true } }));
    try {
      const measuredAt = new Date().toISOString().slice(0, 10);
      const num = numeratorById[id] === "" ? null : Number(numeratorById[id]);
      const den =
        item.denominator != null
          ? undefined
          : denominatorById[id] === "" || denominatorById[id] === undefined
            ? undefined
            : Number(denominatorById[id]);
      await submitKPIMeasurement({
        kpiDefinitionId: item.id,
        financialYearLabel,
        measuredAt,
        numeratorValue: Number.isFinite(num as number) ? num : null,
        denominatorValue: den,
        yesValue: item.type === "BINARY" ? binaryResponses[id] ?? null : null,
        remarks: remarksById[id] ?? "",
        workflowStatus: mode === "draft" ? "draft" : "submitted",
      });
      await reload();
      setRowState((prev) => ({
        ...prev,
        [id]: { saving: false, saved: mode === "draft", submitted: mode === "submit" },
      }));
    } catch {
      setRowState((prev) => ({ ...prev, [id]: { saving: false } }));
    }
  };

  return (
    <AppShell title="KPI Entry">
      <div className="space-y-6 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Your KPI Submissions — {new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}</p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">KPI Entry Workspace</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Submit outcome/output data for your assigned schemes. Entries are reviewed by AS before approval.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 text-sm text-[var(--text-muted)]">
            <p className="text-xs uppercase tracking-[0.3em]">Completion</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{completion.submitted} of {completion.total} KPIs submitted</p>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
            Loading KPI templates...
          </div>
        )}
        {loadError && (
          <div className="rounded-2xl border border-[var(--alert-critical)] bg-[var(--bg-card)] p-4 text-sm text-[var(--alert-critical)]">
            {loadError}
          </div>
        )}

        {!loading && grouped.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
            No KPIs assigned to your profile yet.
          </div>
        )}

        <div className="grid gap-6">
          {grouped.map(({ scheme, items }) => {
            const state = cardState[scheme];
            const schemeComplete = items.every((item) => ["submitted", "submitted_pending", "approved"].includes(item.status));
            const badge = items[0] ? `${items[0].vertical} · ${items[0].category}` : "";
            return (
              <div key={scheme} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Scheme</p>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)]">{scheme}</h2>
                    {badge && (
                      <div className="mt-2 text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1">{badge}</span>
                      </div>
                    )}
                  </div>
                  <button
                    className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] disabled:opacity-60"
                    onClick={() => handleSave(scheme)}
                    disabled={state?.saving}
                  >
                    {state?.saving ? "Saving..." : state?.saved ? "Saved" : "Save Draft"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4">
                    {items.map((item) => {
                    const row = rowState[item.id];
                    const binaryValue = binaryResponses[item.id] ?? item.yes ?? null;
                    const numVal = numeratorById[item.id] === "" ? null : Number(numeratorById[item.id]);
                    const denVal = denominatorById[item.id] === "" ? null : Number(denominatorById[item.id]);
                    const computed =
                      numVal != null && denVal != null && !Number.isNaN(numVal) && !Number.isNaN(denVal) && denVal !== 0
                        ? ((numVal / denVal) * 100).toFixed(1)
                        : "0.0";
                    return (
                    <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.description}</p>
                          <p className="text-xs text-[var(--text-muted)]">{item.vertical} · {item.unit}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1">{item.type}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      {item.type === "BINARY" ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            className={`rounded-xl border px-4 py-2 text-xs uppercase tracking-[0.3em] ${binaryValue === true ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
                            onClick={() => setBinaryResponses((prev) => ({ ...prev, [item.id]: true }))}
                          >
                            Yes
                          </button>
                          <button
                            className={`rounded-xl border px-4 py-2 text-xs uppercase tracking-[0.3em] ${binaryValue === false ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
                            onClick={() => setBinaryResponses((prev) => ({ ...prev, [item.id]: false }))}
                          >
                            No
                          </button>
                          <label className="flex-1 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            Remarks
                            <input
                              type="text"
                              value={remarksById[item.id] ?? ""}
                              onChange={(e) => setRemarksById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            Numerator
                            <input
                              type="number"
                              value={numeratorById[item.id] ?? ""}
                              onChange={(e) =>
                                setNumeratorById((prev) => ({ ...prev, [item.id]: e.target.value === "" ? "" : Number(e.target.value) }))
                              }
                              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                          </label>
                          <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            Denominator
                            <input
                              type="number"
                              value={denominatorById[item.id] ?? ""}
                              onChange={(e) =>
                                setDenominatorById((prev) => ({ ...prev, [item.id]: e.target.value === "" ? "" : Number(e.target.value) }))
                              }
                              readOnly={item.denominator != null}
                              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
                            />
                          </label>
                          <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            Remarks
                            <input
                              type="text"
                              value={remarksById[item.id] ?? ""}
                              onChange={(e) => setRemarksById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                          </label>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                        <span>
                          Computed: {numVal ?? 0} / {denVal ?? 0} = {computed}%
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]"
                            onClick={() => handleRowAction(item.id, "draft")}
                          >
                            {row?.saving ? "Saving..." : row?.saved ? "Draft Saved" : "Save Draft"}
                          </button>
                          <button
                            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]"
                            onClick={() => handleRowAction(item.id, "submit")}
                          >
                            {row?.saving ? "Submitting..." : row?.submitted ? "Submitted" : "Submit"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
                {schemeComplete && (
                  <div className="mt-5 rounded-xl border border-[var(--alert-success)] bg-[rgba(0,200,83,0.1)] px-4 py-2 text-sm text-[var(--alert-success)]">
                    All KPIs for this scheme submitted ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
