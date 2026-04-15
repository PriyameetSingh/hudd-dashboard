"use client";

import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import CommandCentre from "@/components/CommandCentre";
import { useRequireAuth } from "@/src/lib/route-guards";

const ROUTE_MAP: Record<string, string> = {
  schemes: "/financial/schemes-board",
  actions: "/action-items",
  agents: "/reports",
};

export default function CommandCentrePage() {
  useRequireAuth();
  const router = useRouter();

  const handleActive = (id: string) => {
    const route = ROUTE_MAP[id];
    if (route) router.push(route);
  };

  return (
    <AppShell title="Dashboard">
      <CommandCentre setActive={handleActive} />
    </AppShell>
  );
}
