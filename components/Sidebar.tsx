"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UserRole, getCurrentUser } from "@/lib/auth";
import { useTheme } from "./ThemeProvider";
import { LayoutDashboard, IndianRupee, ListChecks, Activity, UserCog, ShieldCheck, ClipboardList, FileText, CalendarDays, Layers } from "lucide-react";

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
    label: "Command Centre",
    href: "/command-centre",
    icon: LayoutDashboard,
    roles: [UserRole.ACS, UserRole.PS_HUDD, UserRole.AS, UserRole.VIEWER],
    badge: "read-only",
  },
  {
    label: "Financial Overview",
    href: "/financial",
    icon: IndianRupee,
    roles: Object.values(UserRole),
    children: [
      {
        label: "Scheme Entry",
        href: "/financial/entry/scheme",
        icon: IndianRupee,
        roles: [UserRole.FA],
        emphasis: true,
      },
      {
        label: "Summary Entry",
        href: "/financial/entry/summary",
        icon: UserCog,
        roles: [UserRole.FA],
        emphasis: true,
      },
    ],
  },
  {
    label: "Schemes",
    href: "/schemes",
    icon: Layers,
    roles: Object.values(UserRole),
  },
  {
    label: "KPI Tracker",
    href: "/kpis",
    icon: ClipboardList,
    roles: Object.values(UserRole),
    children: [
      {
        label: "Enter KPIs",
        href: "/kpis/entry",
        icon: ShieldCheck,
        roles: [UserRole.NODAL_OFFICER],
        emphasis: true,
      },
    ],
  },
  {
    label: "Action Items",
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
    label: "Meetings",
    href: "/meetings",
    icon: CalendarDays,
    roles: [UserRole.TASU, UserRole.AS, UserRole.PS_HUDD, UserRole.ACS],
  },
  {
    label: "Reports & Export",
    href: "/reports",
    icon: FileText,
    roles: [UserRole.AS, UserRole.PS_HUDD, UserRole.ACS],
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

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const { theme, mounted } = useTheme();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

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
    <aside className="w-64 h-full bg-[var(--bg-surface)] border-r border-[var(--sidebar-border)] flex flex-col sticky top-0">
      <div className="px-6 py-5 border-b border-[var(--sidebar-border)]">
        <div className="text-sm font-semibold tracking-[0.6em] text-[var(--sidebar-text-muted)]">HUDD NEXUS</div>
        <div className="text-xs uppercase text-[var(--sidebar-text-muted)] mt-1">Government of Odisha</div>
        {user && (
          <div className="mt-3 flex flex-col gap-1">
            <div className="text-[13px] font-bold text-[var(--sidebar-text-primary)]">{user.name}</div>
            <div className="flex items-center gap-1">{roleBadge}</div>
          </div>
        )}
      </div>

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
                className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm font-medium ${pathname === item.href ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-text-primary)]" : "text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text-primary)]"}`}
              >
                <item.icon size={16} />
                {item.label}
                {item.badge && <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white bg-[var(--sidebar-active-bg)] px-2 py-0.5 rounded-full ml-auto opacity-80">{item.badge}</span>}
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
                          <span className="truncate">{child.label}</span>
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

      <div className="px-4 py-3 border-t border-[var(--sidebar-border)] text-[11px] text-[var(--sidebar-text-muted)]">{mounted ? (theme === "dark" ? "Dark" : "Light") : ""} / HUDD Identifier</div>
    </aside>
  );
}
