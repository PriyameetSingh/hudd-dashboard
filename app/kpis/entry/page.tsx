"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import { fetchKPISubmissions } from "@/src/lib/services/kpiService";
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
  const [loading, setLoading] = useState(true);
  const [cardState, setCardState] = useState<Record<string, SchemeCardState>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [binaryResponses, setBinaryResponses] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchKPISubmissions();
        if (!active) return;
        setSubmissions(data);
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

  const handleSave = (scheme: string) => {
    setCardState((prev) => ({ ...prev, [scheme]: { saving: true } }));
    setTimeout(() => {
      setCardState((prev) => ({ ...prev, [scheme]: { saved: true } }));
      setTimeout(() => {
        setCardState((prev) => ({ ...prev, [scheme]: { saved: false } }));
      }, 1600);
    }, 700);
  };

  const handleRowAction = (id: string, mode: "draft" | "submit") => {
    setRowState((prev) => ({ ...prev, [id]: { saving: true } }));
    setTimeout(() => {
      setRowState((prev) => ({
        ...prev,
        [id]: { saving: false, saved: mode === "draft", submitted: mode === "submit" },
      }));
      setTimeout(() => {
        setRowState((prev) => ({
          ...prev,
          [id]: { saving: false, saved: false, submitted: prev[id]?.submitted },
        }));
      }, 1400);
    }, 600);
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
                    const computed = item.numerator && item.denominator ? ((item.numerator / item.denominator) * 100).toFixed(1) : "0.0";
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
                              defaultValue={item.remarks ?? ""}
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
                              defaultValue={item.numerator ?? undefined}
                              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                          </label>
                          <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            Denominator
                            <input
                              type="number"
                              defaultValue={item.denominator ?? undefined}
                              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                          </label>
                          <label className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                            Remarks
                            <input
                              type="text"
                              defaultValue={item.remarks ?? ""}
                              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                          </label>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                        <span>Computed: {item.numerator ?? 0} / {item.denominator ?? 0} = {computed}%</span>
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
