"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOCK_USERS, UserRole, refreshSessionUserFromApi, setCurrentUser } from "@/lib/auth";
import RoleBadge from "@/src/components/ui/RoleBadge";

const ROLE_TITLES: Record<UserRole, string> = {
  [UserRole.ACS]: "Additional Chief Secretary",
  [UserRole.PS_HUDD]: "Principal Secretary HUDD",
  [UserRole.AS]: "Additional Secretary",
  [UserRole.FA]: "Finance Advisor HUDD",
  [UserRole.TASU]: "TASU Programme Officer",
  [UserRole.NODAL_OFFICER]: "Nodal Officer",
  [UserRole.DIRECTOR]: "Director DMA",
  [UserRole.VIEWER]: "Auditor",
};

export default function LoginGrid() {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    const user = MOCK_USERS.find((entry) => entry.id === id);
    if (!user) return;
    setActiveId(id);
    setCurrentUser(user);
    await refreshSessionUserFromApi();
    router.replace("/dashboard");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {MOCK_USERS.map((user) => (
        <button
          key={user.id}
          onClick={() => handleSelect(user.id)}
          className="group flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-white/30 hover:bg-white/10"
          disabled={activeId === user.id}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-slate-400">Designation</p>
              <h3 className="mt-2 text-lg font-semibold text-white">{user.name}</h3>
              <p className="text-sm text-slate-300">{ROLE_TITLES[user.role]}</p>
              <p className="text-xs text-slate-400">{user.department}</p>
            </div>
            <RoleBadge role={user.role} />
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
            {user.assignedSchemes.map((scheme) => (
              <span
                key={`${user.id}-${scheme}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
              >
                {scheme}
              </span>
            ))}
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {activeId === user.id ? "Signing in..." : "Enter workspace"}
          </div>
        </button>
      ))}
    </div>
  );
}
