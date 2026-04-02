"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, UserRole } from "@/lib/auth";

const ROUTES: Record<UserRole, string> = {
  [UserRole.ACS]: "/command-centre",
  [UserRole.PS_HUDD]: "/command-centre",
  [UserRole.AS]: "/command-centre",
  [UserRole.VIEWER]: "/command-centre",
  [UserRole.FA]: "/financial/entry",
  [UserRole.NODAL_OFFICER]: "/kpis/entry",
  [UserRole.TASU]: "/action-items",
  [UserRole.DIRECTOR]: "/kpis",
};

export default function DashboardRoute() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    const destination = ROUTES[user.role] ?? "/command-centre";
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
