"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/src/lib/route-guards";
import { fetchKPISubmissions, reviewKpiMeasurement } from "@/src/lib/services/kpiService";
import { KPISubmission } from "@/types";
import { UserRole } from "@/lib/auth";
import StatusBadge from "@/src/components/ui/StatusBadge";
import PendingBadge from "@/src/components/ui/PendingBadge";

interface TabConfig {
  id: string;
  label: string;
  filter: (item: KPISubmission) => boolean;
}

export default function KPIsPage() {
  const user = useRequireAuth();
  const [submissions, setSubmissions] = useState<KPISubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchKPISubmissions();
        if (!active) return;
        setSubmissions(data.submissions);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const tabs = useMemo<TabConfig[]>(() => {
    const baseTabs: TabConfig[] = [
      { id: "all", label: "All KPIs", filter: () => true },
      {
        id: "submitted",
        label: "Submitted",
        filter: (item) => item.status === "submitted" || item.status === "submitted_pending",
      },
      {
        id: "approved",
        label: "Approved",
        filter: (item) => item.status === "approved",
      },
      {
        id: "not_submitted",
        label: "Not Submitted",
        filter: (item) => item.status === "not_submitted" || item.status === "draft",
      },
    ];
    if (user?.role === UserRole.DIRECTOR) {
      const pendingTab: TabConfig = {
        id: "pending_review",
        label: "Pending Review",
        filter: (item) => item.status === "submitted_pending",
      };
      return [baseTabs[0], pendingTab, ...baseTabs.slice(1)];
    }
    return baseTabs;
  }, [user?.role]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "all");
    }
  }, [tabs, activeTab]);

  const filtered = useMemo(() => {
    const tab = tabs.find((item) => item.id === activeTab) ?? tabs[0];
    return submissions.filter(tab.filter);
  }, [submissions, tabs, activeTab]);

  const summary = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((item) => item.status === "submitted_pending").length;
    const approved = submissions.filter((item) => item.status === "approved").length;
    const awaiting = submissions.filter((item) => item.status === "not_submitted" || item.status === "draft").length;
    return { total, pending, approved, awaiting };
  }, [submissions]);

  const isViewer = user?.role === UserRole.VIEWER;
  const isDirector = user?.role === UserRole.DIRECTOR;

  const pendingQueue = useMemo(() => submissions.filter((item) => item.status === "submitted_pending"), [submissions]);

  return (
    <AppShell title="KPI Tracker">
      <div className="relative space-y-6 px-6 py-6">
        {isViewer && (
          <div className="pointer-events-none absolute right-6 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Read-only
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">HUDD NEXUS</p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">KPI Performance Monitor</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Latest outcome and output submissions across priority schemes.</p>
          </div>
          {user?.role === UserRole.NODAL_OFFICER && (
            <Link
              href="/kpis/entry"
              className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)]"
            >
              Enter KPIs
            </Link>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total KPIs", value: summary.total },
            { label: "Pending Review", value: summary.pending },
            { label: "Approved", value: summary.approved },
            { label: "Awaiting Entry", value: summary.awaiting },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-1 text-[11px] uppercase tracking-[0.3em] transition ${
                activeTab === tab.id
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {summary.pending > 0 && <PendingBadge count={summary.pending} />}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          {actionMessage && (
            <div className="mb-4 rounded-xl border border-[var(--alert-success)] bg-[rgba(0,200,83,0.1)] px-4 py-2 text-sm text-[var(--alert-success)]">
              {actionMessage}
            </div>
          )}
          {loading && <div className="text-sm text-[var(--text-muted)]">Loading KPI submissions...</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-sm text-[var(--text-muted)]">No KPI submissions match this filter.</div>
          )}
          {!loading && isDirector && activeTab === "pending_review" && (
            <div className="space-y-4">
              {pendingQueue.length === 0 && (
                <div className="text-sm text-[var(--text-muted)]">No KPI submissions awaiting director review.</div>
              )}
              {pendingQueue.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">{item.scheme}</p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{item.description}</h3>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">{item.vertical} · {item.category}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm text-[var(--text-muted)]">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em]">Submitted By</p>
                      <p className="mt-1 text-sm text-[var(--text-primary)]">Shri Amit Kumar</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em]">Submitted On</p>
                      <p className="mt-1 text-sm text-[var(--text-primary)]">{item.lastUpdated}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em]">Values</p>
                      <p className="mt-1 text-sm text-[var(--text-primary)]">
                        {item.type === "BINARY" ? (item.yes ? "Yes" : "No") : `${item.numerator ?? 0} / ${item.denominator ?? 0}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em]">Unit</p>
                      <p className="mt-1 text-sm text-[var(--text-primary)]">{item.unit}</p>
                    </div>
                  </div>
                  {!isViewer && item.latestMeasurementId && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] disabled:opacity-50"
                        disabled={reviewBusyId === item.id}
                        onClick={async () => {
                          if (!item.latestMeasurementId) return;
                          setReviewBusyId(item.id);
                          try {
                            await reviewKpiMeasurement(item.latestMeasurementId, { decision: "approve" });
                            const data = await fetchKPISubmissions();
                            setSubmissions(data.submissions);
                            setActionMessage(`Approved ${item.scheme} — ${item.description}.`);
                          } catch (e: unknown) {
                            setActionMessage(e instanceof Error ? e.message : "Approval failed");
                          } finally {
                            setReviewBusyId(null);
                          }
                        }}
                      >
                        {reviewBusyId === item.id ? "Working..." : "Approve"}
                      </button>
                      <button
                        className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] disabled:opacity-50"
                        disabled={reviewBusyId === item.id}
                        onClick={async () => {
                          if (!item.latestMeasurementId) return;
                          const note = typeof window !== "undefined" ? window.prompt("Rejection note (required)") : null;
                          if (!note?.trim()) {
                            setActionMessage("Rejection cancelled or empty note.");
                            return;
                          }
                          setReviewBusyId(item.id);
                          try {
                            await reviewKpiMeasurement(item.latestMeasurementId, { decision: "reject", note });
                            const data = await fetchKPISubmissions();
                            setSubmissions(data.submissions);
                            setActionMessage(`Rejected ${item.scheme} — ${item.description}.`);
                          } catch (e: unknown) {
                            setActionMessage(e instanceof Error ? e.message : "Reject failed");
                          } finally {
                            setReviewBusyId(null);
                          }
                        }}
                      >
                        Reject with Comment
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!loading && (!isDirector || activeTab !== "pending_review") && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 pr-4">Scheme</th>
                    <th className="py-3 pr-4">Metric</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Unit</th>
                    <th className="py-3 pr-4">Last Updated</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--border)] text-[var(--text-primary)]">
                      <td className="py-3 pr-4 font-medium">{item.scheme}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.vertical} · {item.category}</p>
                      </td>
                      <td className="py-3 pr-4 text-[var(--text-muted)]">{item.type}</td>
                      <td className="py-3 pr-4 text-[var(--text-muted)]">{item.unit}</td>
                      <td className="py-3 pr-4 text-[var(--text-muted)]">{item.lastUpdated}</td>
                      <td className="py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
