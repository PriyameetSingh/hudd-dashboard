"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/src/lib/route-guards";
import { fetchActionItems } from "@/src/lib/services/actionItemService";
import { ActionItem, ActionItemStatus } from "@/types";
import { UserRole } from "@/lib/auth";
import StatusBadge from "@/src/components/ui/StatusBadge";
import PriorityBadge from "@/src/components/ui/PriorityBadge";

const STATUS_FILTERS: { id: string; label: string; match: (status: ActionItemStatus) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "pending", label: "Pending Action", match: (status) => ["OPEN", "IN_PROGRESS", "PROOF_UPLOADED"].includes(status) },
  { id: "review", label: "Under Review", match: (status) => status === "UNDER_REVIEW" },
  { id: "completed", label: "Completed", match: (status) => status === "COMPLETED" },
  { id: "overdue", label: "Overdue", match: (status) => status === "OVERDUE" },
];

const STATUS_STEPS: ActionItemStatus[] = ["OPEN", "IN_PROGRESS", "PROOF_UPLOADED", "UNDER_REVIEW", "COMPLETED"];

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-[var(--alert-critical)]",
  High: "bg-[var(--alert-warning)]",
  Medium: "bg-blue-500",
  Low: "bg-[var(--text-muted)]",
};

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

export default function ActionItemsPage() {
  const user = useRequireAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [verticalFilter, setVerticalFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchActionItems();
        if (!active) return;
        setItems(data);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const roleFiltered = useMemo(() => {
    if (!user) return [];
    if (user.role === UserRole.TASU) return items;
    if (user.role === UserRole.NODAL_OFFICER) {
      const target = normalize(user.name);
      return items.filter((item) => normalize(item.assignedTo).includes(target));
    }
    if ([UserRole.AS, UserRole.PS_HUDD, UserRole.ACS].includes(user.role)) {
      return items.filter((item) => item.status === "UNDER_REVIEW");
    }
    return items;
  }, [items, user]);

  const filtered = useMemo(() => {
    const activeFilter = STATUS_FILTERS.find((entry) => entry.id === filter) ?? STATUS_FILTERS[0];
    return roleFiltered.filter((item) => {
      const matchesQuery =
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.vertical.toLowerCase().includes(query.toLowerCase()) ||
        item.schemeId.toLowerCase().includes(query.toLowerCase());
      const matchesVertical = verticalFilter === "all" || item.vertical === verticalFilter;
      const matchesAssignee = assigneeFilter === "all" || item.assignedTo === assigneeFilter;
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
      const matchesDue = (() => {
        if (dueFilter === "all") return true;
        const due = new Date(item.dueDate);
        const now = new Date();
        if (dueFilter === "overdue") return due < now;
        if (dueFilter === "week") {
          const week = new Date();
          week.setDate(now.getDate() + 7);
          return due >= now && due <= week;
        }
        if (dueFilter === "month") {
          const month = new Date();
          month.setDate(now.getDate() + 30);
          return due >= now && due <= month;
        }
        return true;
      })();
      return matchesQuery && activeFilter.match(item.status) && matchesVertical && matchesAssignee && matchesPriority && matchesDue;
    });
  }, [roleFiltered, query, filter, verticalFilter, assigneeFilter, priorityFilter, dueFilter]);

  const stats = useMemo(() => {
    const total = roleFiltered.length;
    const overdue = roleFiltered.filter((item) => item.status === "OVERDUE").length;
    const completed = roleFiltered.filter((item) => item.status === "COMPLETED").length;
    const dueThisWeek = roleFiltered.filter((item) => {
      const due = new Date(item.dueDate);
      const now = new Date();
      const week = new Date();
      week.setDate(now.getDate() + 7);
      return due >= now && due <= week;
    }).length;
    return { total, overdue, dueThisWeek, completed };
  }, [roleFiltered]);

  const verticalOptions = useMemo(() => ["all", ...Array.from(new Set(items.map((item) => item.vertical)))], [items]);
  const assigneeOptions = useMemo(() => ["all", ...Array.from(new Set(items.map((item) => item.assignedTo)))], [items]);
  const priorityOptions = useMemo(() => ["all", ...Array.from(new Set(items.map((item) => item.priority)))], [items]);

  const isViewer = user?.role === UserRole.VIEWER;
  const showStats = user && [UserRole.TASU, UserRole.AS, UserRole.PS_HUDD].includes(user.role);

  return (
    <AppShell title="Action Items">
      <div className="relative space-y-6 px-6 py-6">
        {isViewer && (
          <div className="pointer-events-none absolute right-6 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Read-only
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Priority Actions</p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Action Items Tracker</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Follow up on critical directives, approvals, and escalations across HUDD schemes.
            </p>
          </div>
          {user?.role === UserRole.TASU && (
            <Link
              href="/action-items/create"
              className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)]"
            >
              Create Item
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setFilter(entry.id)}
              className={`rounded-full border px-4 py-1 text-[11px] uppercase tracking-[0.3em] transition ${
                filter === entry.id
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by scheme or title"
            className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <select
            value={verticalFilter}
            onChange={(event) => setVerticalFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            {verticalOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Vertical" : option}
              </option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            {assigneeOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Assigned to" : option}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Priority" : option}
              </option>
            ))}
          </select>
          <select
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            <option value="all">Due Date</option>
            <option value="week">Due this week</option>
            <option value="month">Due this month</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {showStats && (
          <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4 text-sm text-[var(--text-muted)]">
            <span>Total: <strong className="text-[var(--text-primary)]">{stats.total}</strong></span>
            <span>Overdue: <strong className="text-[var(--alert-critical)]">{stats.overdue}</strong></span>
            <span>Due This Week: <strong className="text-[var(--text-primary)]">{stats.dueThisWeek}</strong></span>
            <span>Completed: <strong className="text-[var(--text-primary)]">{stats.completed}</strong></span>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
            Loading action items...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
            No action items match your current filters.
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((item) => {
              const currentStatus = item.status === "OVERDUE" ? "OPEN" : item.status;
              const currentIndex = STATUS_STEPS.indexOf(currentStatus);
              return (
                <div
                  key={item.id}
                  className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition hover:border-[var(--border-strong)]"
                >
                  <div className={`absolute left-0 top-0 h-full w-1 ${PRIORITY_COLORS[item.priority] ?? "bg-[var(--border)]"}`} />
                  {item.status === "OVERDUE" && (
                    <div className="mb-3 rounded-lg border border-[var(--alert-critical)] bg-[rgba(255,59,59,0.12)] px-3 py-1 text-xs text-[var(--alert-critical)]">
                      {item.daysOverdue ?? 1} days overdue
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={item.priority} />
                        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                          {item.vertical}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{item.title}</h3>
                      <p className="mt-2 text-sm text-[var(--text-muted)]">{item.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={item.status} />
                      <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{item.schemeId}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span>Assigned to {item.assignedTo}</span>
                    <span>·</span>
                    <span>Reviewer {item.reviewer}</span>
                    <span>·</span>
                    <span>Due {item.dueDate}</span>
                    <span>·</span>
                    <span>{item.vertical}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
                    {STATUS_STEPS.map((step, index) => (
                      <span
                        key={step}
                        className={`rounded-full border px-2 py-1 ${index <= currentIndex ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]" : "border-[var(--border)]"}`}
                      >
                        {step.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/action-items/${item.id}`}
                      className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]"
                    >
                      View Details
                    </Link>
                    {user?.role === UserRole.NODAL_OFFICER && !isViewer && (
                      <>
                        <button className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">Update Status</button>
                        <button className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">Upload Proof</button>
                      </>
                    )}
                    {user?.role === UserRole.TASU && !isViewer && (
                      <>
                        <button className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">Reassign</button>
                        <button className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">Escalate</button>
                      </>
                    )}
                    {[UserRole.AS, UserRole.PS_HUDD, UserRole.ACS].includes(user?.role ?? UserRole.VIEWER) && !isViewer && (
                      <>
                        <button className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">Approve</button>
                        <button className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">Reject</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
