"use client";

import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import CommandCentre from "@/components/CommandCentre";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";

const ROUTE_MAP: Record<string, string> = {
  schemes: "/financial/schemes-board",
  actions: "/action-items",
  agents: "/reports",
};

export default function CommandCentrePage() {
  useRequireRole([UserRole.ACS, UserRole.PS_HUDD, UserRole.AS, UserRole.VIEWER], "/dashboard");
  const router = useRouter();

  const handleActive = (id: string) => {
    const route = ROUTE_MAP[id];
    if (route) router.push(route);
  };

  return (
    <AppShell title="Command Centre">
      <CommandCentre setActive={handleActive} />
    </AppShell>
  );
}
