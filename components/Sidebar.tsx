"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UserRole, getCurrentUser } from "@/lib/auth";
import { useTheme } from "./ThemeProvider";
import { LayoutDashboard, IndianRupee, ListChecks, Activity, UserCog, ShieldCheck, ClipboardList, FileText, CalendarDays } from "lucide-react";

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
        label: "Enter Data",
        href: "/financial/entry",
        icon: UserCog,
        roles: [UserRole.FA],
        emphasis: true,
      },
    ],
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
      {
        label: "Schemes",
        href: "/admin/schemes",
        icon: ShieldCheck,
        roles: [UserRole.AS, UserRole.ACS],
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
  const { theme } = useTheme();

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
    <aside className="w-64 h-full bg-[var(--bg-surface)] border-r border-[var(--border)] flex flex-col sticky top-0">
      <div className="px-6 py-5 border-b border-[var(--border)]">
        <div className="text-sm font-semibold tracking-[0.6em] text-[var(--text-muted)]">HUDD NEXUS</div>
        <div className="text-xs uppercase text-[var(--text-muted)] mt-1">Government of Odisha</div>
        {user && (
          <div className="mt-3 flex flex-col gap-1">
            <div className="text-[13px] font-bold text-[var(--text-primary)]">{user.name}</div>
            <div className="flex items-center gap-1">{roleBadge}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {visibleItems.map(item => (
          <div key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm font-medium ${pathname === item.href ? "bg-[var(--border)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
            >
              <item.icon size={16} />
              {item.label}
              {item.badge && <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white bg-[var(--border)] px-2 py-0.5 rounded-full ml-auto">{item.badge}</span>}
            </Link>
            {item.children && (
              <div className="ml-6 mt-1 flex flex-col gap-1">
                {item.children.filter(child => user && child.roles.includes(user.role)).map(child => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs transition ${pathname === child.href ? "bg-[var(--border)] text-[var(--text-primary)]" : child.emphasis ? "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
                  >
                    <child.icon size={14} />
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">{theme === "dark" ? "Dark" : "Light"} / HUDD Identifier</div>
    </aside>
  );
}
