"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, RotateCw, Minimize2 } from "lucide-react";
import { MOCK_USERS, UserRole, getCurrentUser, refreshSessionUserFromApi, setCurrentUser } from "@/lib/auth";

const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.ACS]: "#1f3a93",
  [UserRole.PS_HUDD]: "#1f3a93",
  [UserRole.AS]: "#4169e1",
  [UserRole.DIRECTOR]: "#4169e1",
  [UserRole.FA]: "#1abc9c",
  [UserRole.TASU]: "#1abc9c",
  [UserRole.NODAL_OFFICER]: "#2ecc71",
  [UserRole.VIEWER]: "#7f8c8d",
};

const formatRole = (role: UserRole) => role.replace(/_/g, " ");

export default function MockAuthProvider() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshSessionUserFromApi();
      if (cancelled) return;
      setUser(getCurrentUser());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) {
    return null;
  }

  const handleRoleChange = async (role: UserRole) => {
    const target = MOCK_USERS.find((entry) => entry.role === role);
    if (!target) return;
    setCurrentUser(target);
    await refreshSessionUserFromApi();
    window.location.reload();
  };

  if (minimized) {
    return (
      <button
        className="fixed left-4 bottom-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
        onClick={() => {
          setMinimized(false);
          setOpen(true);
        }}
        aria-label="Open mock auth switcher"
      >
        <ShieldCheck size={18} color={ROLE_COLORS[user.role]} />
      </button>
    );
  }

  return (
    <div className="fixed left-4 bottom-4 z-40 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          className="flex flex-1 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] shadow-xl"
          onClick={() => setOpen(prev => !prev)}
        >
          <ShieldCheck size={16} color={ROLE_COLORS[user.role]} />
          <span>{`Viewing as ${formatRole(user.role)}`}</span>
          <span className="text-[10px] ml-auto text-[var(--text-muted)]">Switch Role</span>
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-xl"
          onClick={() => {
            setMinimized(true);
            setOpen(false);
          }}
          aria-label="Minimize mock auth switcher"
        >
          <Minimize2 size={12} />
        </button>
      </div>

      {open && (
        <div className="w-[320px] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Mock auth</p>
              <p className="text-base font-semibold text-[var(--text-primary)]">Select a role</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-[var(--text-muted)]" aria-label="Close">
              <RotateCw size={18} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            This mock selector is strictly for prototype review. In production, this will be replaced by organisational SSO.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {MOCK_USERS.map(mock => (
              <button
                key={mock.id}
                onClick={() => handleRoleChange(mock.role)}
                className="group flex flex-col gap-1 rounded-xl border border-transparent bg-[var(--bg-surface)] p-3 text-left transition hover:border-[var(--border)]"
              >
                <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{formatRole(mock.role)}</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{mock.name}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{mock.department}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
