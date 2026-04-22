"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { UserRole, getCurrentUser, type MockUser } from "@/lib/auth";
import { fetchActionItems } from "@/src/lib/services/actionItemService";
import { fetchKPISubmissions } from "@/src/lib/services/kpiService";
import { fetchMeetings, type MeetingListItem } from "@/src/lib/services/meetingService";
import type { ActionItem, KPISubmission } from "@/types";
import { LayoutDashboard, LayoutGrid, IndianRupee, ListChecks, Activity, UserCog, ShieldCheck, ClipboardList, FileText, CalendarDays, Layers, Gauge } from "lucide-react";

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

function isAssignedToUser(item: ActionItem, user: MockUser) {
  const target = normalize(user.name);
  return target.length > 0 && normalize(item.assignedTo).includes(target);
}

function isPendingAction(item: ActionItem) {
  return item.status !== "COMPLETED";
}

function isOverdue(item: ActionItem) {
  if (item.status === "OVERDUE") return true;
  const due = new Date(item.dueDate);
  const now = new Date();
  return due < now;
}

function isDueWithinWeek(item: ActionItem) {
  const due = new Date(item.dueDate);
  const now = new Date();
  const week = new Date();
  week.setDate(now.getDate() + 7);
  return due >= now && due <= week;
}

function pendingAssignedBadgeState(items: ActionItem[], user: MockUser): { count: number; tone: "red" | "yellow" | "green" | null } {
  const mine = items.filter((item) => isAssignedToUser(item, user) && isPendingAction(item));
  const count = mine.length;
  if (count === 0) return { count: 0, tone: null };
  const anyOverdue = mine.some(isOverdue);
  if (anyOverdue) return { count, tone: "red" };
  const anyDueSoon = mine.some(isDueWithinWeek);
  if (anyDueSoon) return { count, tone: "yellow" };
  return { count, tone: "green" };
}

function isPendingKpiEntryForAssignee(submission: KPISubmission, assigneeDbUserId: string | null) {
  if (!assigneeDbUserId || !submission.assignedToUserId) return false;
  if (submission.assignedToUserId !== assigneeDbUserId) return false;
  return submission.status === "not_submitted" || submission.status === "draft";
}

/** Red if any overdue, else yellow if any delayed, else green (mirrors action-item badge semantics). */
function pendingKpiEntryBadgeState(
  submissions: KPISubmission[],
  assigneeDbUserId: string | null,
): { count: number; tone: "red" | "yellow" | "green" | null } {
  const mine = submissions.filter((s) => isPendingKpiEntryForAssignee(s, assigneeDbUserId));
  const count = mine.length;
  if (count === 0) return { count: 0, tone: null };
  const anyOverdue = mine.some((s) => s.measurementProgressStatus === "overdue");
  if (anyOverdue) return { count, tone: "red" };
  const anyDelayed = mine.some((s) => s.measurementProgressStatus === "delayed");
  if (anyDelayed) return { count, tone: "yellow" };
  return { count, tone: "green" };
}

async function fetchSessionDbUserId(): Promise<string | null> {
  const response = await fetch("/api/v1/rbac/me", { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as { user: { dbId: string | null } | null };
  return data.user?.dbId ?? null;
}

const BADGE_TONE_CLASS: Record<"red" | "yellow" | "green", string> = {
  red: "text-red-300",
  yellow: "text-amber-300",
  green: "text-emerald-300",
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: UserRole[];
  badge?: string;
  emphasis?: boolean;
  children?: NavItem[];
};

const items: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: Object.values(UserRole),
  },
  {
    label: "Financial Progress",
    href: "/financial",
    icon: IndianRupee,
    roles: Object.values(UserRole),
    children: [
      {
        label: "My Tasks",
        href: "/financial/entry/scheme",
        icon: IndianRupee,
        roles: [UserRole.FA],
        emphasis: true,
      },
      {
        label: "Summary",
        href: "/financial/entry/summary",
        icon: UserCog,
        roles: [UserRole.FA],
        emphasis: true,
      },
    ],
  },
  {
    label: "Scheme Budget vs Expense",
    href: "/financial/schemes-board",
    icon: LayoutGrid,
    roles: Object.values(UserRole),
  },
  {
    label: " Create Schemes",
    href: "/schemes",
    icon: Layers,
    roles: [UserRole.TASU],
  },
  {
    label: "Decision Tracker",
    href: "/action-items",
    icon: ListChecks,
    roles: Object.values(UserRole),
    children: [
      {
        label: "Create Item",
        href: "/action-items/create",
        icon: Activity,
        roles: [UserRole.TASU],
        emphasis: true,
      },
    ],
  },
  {
    label: "KPI Monitoring",
    href: "/kpis",
    icon: ClipboardList,
    roles: Object.values(UserRole),
    children: [
      {
        label: "My Tasks",
        href: "/kpis/entry",
        icon: ShieldCheck,
        roles: [UserRole.NODAL_OFFICER],
        emphasis: true,
      },
    ],
  },
  
  {
    label: "Meetings",
    href: "/meetings",
    icon: CalendarDays,
    roles: [UserRole.TASU, UserRole.AS, UserRole.PS_HUDD, UserRole.ACS],
  },
  // {
  //   label: "Reports & Export",
  //   href: "/reports",
  //   icon: FileText,
  //   roles: [UserRole.AS, UserRole.PS_HUDD, UserRole.ACS],
  // },
  {
    label: "Execution Efficiency",
    href: "/financial/execution-efficiency",
    icon: Gauge,
    roles: Object.values(UserRole),
  },
  {
    label: "Administration",
    href: "/admin",
    icon: UserCog,
    roles: [UserRole.ACS, UserRole.PS_HUDD, UserRole.AS],
    children: [
      {
        label: "Users",
        href: "/admin/users",
        icon: UserCog,
        roles: [UserRole.ACS, UserRole.PS_HUDD],
      },
    ],
  },
  {
    label: "My Profile",
    href: "/profile",
    icon: Activity,
    roles: Object.values(UserRole),
  },
];

const badgeColors: Record<UserRole, string> = {
  [UserRole.ACS]: "bg-[#1f3a93]",
  [UserRole.PS_HUDD]: "bg-[#1f3a93]",
  [UserRole.AS]: "bg-[#4169e1]",
  [UserRole.DIRECTOR]: "bg-[#4169e1]",
  [UserRole.FA]: "bg-[#1abc9c]",
  [UserRole.TASU]: "bg-[#1abc9c]",
  [UserRole.NODAL_OFFICER]: "bg-[#2ecc71]",
  [UserRole.VIEWER]: "bg-[#7f8c8d]",
};

/** Dashboard merged from legacy `/command-centre`; keep both paths highlighting the same nav item. */
function isTopNavActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/command-centre";
  }
  return pathname === href;
}

function formatMeetingSidebarLabel(m: MeetingListItem) {
  const d = new Date(`${m.meetingDate}T12:00:00`);
  const label = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
  const title = m.title?.trim();
  return title ? `${label} — ${title}` : label;
}

function MeetingScopeSelectInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchMeetings()
      .then((m) => {
        if (active) setMeetings(m);
      })
      .catch(() => {
        if (active) setMeetings([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(
    () => [...meetings].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)),
    [meetings],
  );

  const param = searchParams.get("meeting");
  const selectedId =
    param && sorted.some((m) => m.id === param) ? param : sorted[0]?.id ?? "";

  useEffect(() => {
    if (!sorted.length) return;
    if (pathname !== "/dashboard" && pathname !== "/command-centre") return;
    const p = searchParams.get("meeting");
    if (p && !sorted.some((m) => m.id === p)) {
      router.replace(`/dashboard?meeting=${encodeURIComponent(sorted[0].id)}`, { scroll: false });
    }
  }, [sorted, pathname, searchParams, router]);

  const onSelect = (id: string) => {
    if (!id) return;
    if (pathname === "/dashboard" || pathname === "/command-centre") {
      router.replace(`/dashboard?meeting=${encodeURIComponent(id)}`, { scroll: false });
    } else {
      router.push(`/dashboard?meeting=${encodeURIComponent(id)}`);
    }
  };

  if (!loaded) {
    return (
      <div className="mx-3 mb-3 h-[72px] animate-pulse rounded-lg bg-[var(--sidebar-border)]/25" aria-hidden />
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="mx-3 mb-3 rounded-lg border border-dashed border-[var(--sidebar-border)] px-2.5 py-2 text-[10px] leading-snug text-[var(--sidebar-text-muted)]">
        No meetings yet. Schedule one under Meetings to scope the dashboard.
      </div>
    );
  }

  return (
    <div className="mx-3 mb-3">
      <label className="flex flex-col gap-1.5">
        {/* <span className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sidebar-text-muted)]">
          <CalendarDays size={12} className="shrink-0 opacity-80" aria-hidden />
          Meeting scope
        </span> */}
        <select
          className="w-full rounded-md border border-(--sidebar-border) bg-(--bg-surface) px-2 py-1.5 text-[12px] font-medium text-[var(--sidebar-text-primary)] shadow-sm outline-none focus:ring-2 focus:ring-[var(--sidebar-active-bg)]/40"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          title="Topics, presentations, and meeting context on the dashboard follow this meeting (latest by default)."
        >
          {sorted.map((m) => (
            <option key={m.id} value={m.id}>
              {formatMeetingSidebarLabel(m)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function MeetingScopeSelect() {
  return (
    <Suspense
      fallback={<div className="mx-3 mb-3 h-[72px] animate-pulse rounded-lg bg-[var(--sidebar-border)]/25" aria-hidden />}
    >
      <MeetingScopeSelectInner />
    </Suspense>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [kpiSubmissions, setKpiSubmissions] = useState<KPISubmission[]>([]);
  const [assigneeDbUserId, setAssigneeDbUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const u = getCurrentUser();
      setUser(u);
      if (!u) {
        setAssigneeDbUserId(null);
        setKpiSubmissions([]);
        return;
      }
      void (async () => {
        try {
          const data = await fetchActionItems();
          if (active) setActionItems(data);
        } catch {
          if (active) setActionItems([]);
        }
      })();
      if (u.role === UserRole.NODAL_OFFICER) {
        void (async () => {
          try {
            const [dbId, kpiData] = await Promise.all([fetchSessionDbUserId(), fetchKPISubmissions()]);
            if (active) {
              setAssigneeDbUserId(dbId);
              setKpiSubmissions(kpiData.submissions);
            }
          } catch {
            if (active) {
              setAssigneeDbUserId(null);
              setKpiSubmissions([]);
            }
          }
        })();
      } else {
        setAssigneeDbUserId(null);
        setKpiSubmissions([]);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const actionItemsBadge = useMemo(() => {
    if (!user) return null;
    return pendingAssignedBadgeState(actionItems, user);
  }, [actionItems, user]);

  const kpiEntryBadge = useMemo(() => pendingKpiEntryBadgeState(kpiSubmissions, assigneeDbUserId), [kpiSubmissions, assigneeDbUserId]);

  const roleBadge = useMemo(() => {
    if (!user) return null;
    return (
      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white rounded-full ${badgeColors[user.role]}`}>
        {user.role.replace("_", " ")}
      </span>
    );
  }, [user]);

  const visibleItems = user ? items.filter(item => item.roles.includes(user.role)) : [];

  return (
    <aside className="w-64 h-full bg-(--bg-surface) border-r border-(--sidebar-border) flex flex-col sticky top-0">
      <div className="px-6 py-5 border-b border-(--sidebar-border) items-center justify-center flex">
        {/* <div className="text-sm font-semibold tracking-[0.6em] text-[var(--sidebar-text-muted)]">HUDD</div> */}
        {/* <div className="text-xs uppercase text-[var(--sidebar-text-muted)] mt-1">Government of Odisha</div> */}
        <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
          <img src="/logo.png" alt="HUDD Logo" className="h-full w-full object-contain" />
        </div>
        {/* {user && (
          <div className="mt-3 flex flex-col gap-1">
            <div className="text-[13px] font-bold text-[var(--sidebar-text-primary)]">{user.name}</div>
            <div className="flex items-center gap-1">{roleBadge}</div>
          </div>
        )} */}
      </div>

      <MeetingScopeSelect />

      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {visibleItems.map(item => {
          const childLinks =
            user && item.children?.length
              ? item.children.filter(child => child.roles.includes(user.role))
              : [];

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm font-medium ${isTopNavActive(pathname, item.href) ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-primary)]" : "text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text-primary)]"}`}
              >
                <item.icon size={16} />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate">{item.label}</span>
                  {item.href === "/action-items" && actionItemsBadge && actionItemsBadge.count > 0 && actionItemsBadge.tone && (
                    <span
                      className={`shrink-0 tabular-nums text-[13px] font-semibold ${BADGE_TONE_CLASS[actionItemsBadge.tone]}`}
                      title="Pending action items assigned to you"
                    >
                      ({actionItemsBadge.count})
                    </span>
                  )}
                </span>
                {item.badge && <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white bg-[var(--sidebar-active-bg)] px-2 py-0.5 rounded-full ml-auto shrink-0 opacity-80">{item.badge}</span>}
              </Link>
              {childLinks.length > 0 && (
                <ul
                  className="mt-2 ml-3 flex list-none flex-col gap-0.5 border-l-2 border-[var(--sidebar-text-muted)]/30 py-0.5 pl-3"
                  aria-label={`${item.label} — related links`}
                >
                  {childLinks.map(child => {
                    const active = pathname === child.href;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={[
                            "flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] leading-snug transition-colors",
                            active
                              ? "bg-[var(--sidebar-active-bg)] font-medium text-[var(--sidebar-text-primary)]"
                              : child.emphasis
                                ? "bg-[var(--sidebar-hover-bg)]/70 text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-hover-bg)]"
                                : "text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)]/50 hover:text-[var(--sidebar-text-primary)]",
                          ].join(" ")}
                        >
                          <span className="shrink-0 opacity-90" aria-hidden>
                            <child.icon size={14} />
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate">{child.label}</span>
                            {child.href === "/kpis/entry" && kpiEntryBadge.count > 0 && kpiEntryBadge.tone && (
                              <span
                                className={`shrink-0 tabular-nums text-[13px] font-semibold ${BADGE_TONE_CLASS[kpiEntryBadge.tone]}`}
                                title="KPI entries pending for you (action owner)"
                              >
                                ({kpiEntryBadge.count})
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-[var(--sidebar-border)] text-[11px] text-[var(--sidebar-text-muted)]">HUDD Identifier</div>
    </aside>
  );
}
