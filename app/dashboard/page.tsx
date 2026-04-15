"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, UserRole } from "@/lib/auth";

/** Post-login home: same dashboard for every role; approval/action cards vary per user (role-based summaries). */
const DASHBOARD_PATH = "/command-centre";

const ROUTES = Object.fromEntries(
  (Object.values(UserRole) as UserRole[]).map((role) => [role, DASHBOARD_PATH]),
) as Record<UserRole, string>;

export default function DashboardRoute() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    const destination = ROUTES[user.role] ?? DASHBOARD_PATH;
    router.replace(destination);
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-5 text-sm font-medium">
        Routing to your workspace...
      </div>
    </div>
  );
}
