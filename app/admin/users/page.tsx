"use client";

import AppShell from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRequireRole } from "@/src/lib/route-guards";
import { MockUser, Permission, ROLE_PERMISSIONS, UserRole, MOCK_USERS } from "@/lib/auth";
import RoleBadge from "@/src/components/ui/RoleBadge";

const PERMISSION_LIST = Object.values(Permission);

type OverrideEffect = "allow" | "deny";

type DbUserPermissionOverride = {
  code: Permission;
  effect: OverrideEffect;
};

type DbUserRow = {
  code: string | null;
  name: string;
  email: string;
  department: string | null;
  roles: UserRole[];
  overrides: DbUserPermissionOverride[];
  effectivePermissions: Permission[];
};

// ─── Permissions Modal ────────────────────────────────────────────────────────

interface PermissionsModalProps {
  user: DbUserRow;
  onToggle: (userCode: string, permission: Permission) => Promise<void>;
  onClose: () => void;
  alert: string;
}

function PermissionsModal({ user, onToggle, onClose, alert }: PermissionsModalProps) {
  const overrideCount = user.overrides.length;
  const grantedCount = user.effectivePermissions.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Permissions</p>
            <h2 className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{user.name}</h2>
            <div className="mt-1 flex items-center gap-3">
              <RoleBadge role={user.roles[0] ?? UserRole.VIEWER} />
              <span className="text-xs text-[var(--text-muted)]">
                {grantedCount} granted
                {overrideCount > 0 && (
                  <> · <span className="text-[var(--alert-warning)]">{overrideCount} override{overrideCount > 1 ? "s" : ""}</span></>
                )}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 border-b border-[var(--border)] px-6 py-2.5">
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-[var(--text-primary)] bg-[var(--text-primary)]" />
            Granted
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-[var(--alert-critical)] bg-[rgba(255,59,59,0.12)]" />
            Denied (override)
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-[var(--border)] bg-transparent" />
            Not granted
          </span>
        </div>

        {/* Permission toggles */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {PERMISSION_LIST.map((permission) => {
              const override = user.overrides.find((entry) => entry.code === permission) ?? null;
              const granted = user.effectivePermissions.includes(permission);
              return (
                <button
                  key={`modal-${user.code ?? user.email}-${permission}`}
                  onClick={() => onToggle(user.code ?? "", permission)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                    override?.effect === "deny"
                      ? "border-[var(--alert-critical)] bg-[rgba(255,59,59,0.12)] text-[var(--alert-critical)]"
                      : granted
                        ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                        : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  }`}
                  title={
                    override
                      ? `Override active — click to unset (${override.effect})`
                      : granted
                        ? "Click to deny (override)"
                        : "Click to grant (override)"
                  }
                >
                  {permission.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alert */}
        {alert && (
          <div className="border-t border-[var(--border)] px-6 py-3">
            <p className="text-xs text-[var(--alert-critical)]">{alert}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-[var(--border)] px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  useRequireRole([UserRole.ACS, UserRole.PS_HUDD], "/dashboard");

  const [users, setUsers] = useState<DbUserRow[]>([]);
  const [alert, setAlert] = useState("");
  const [selectedUser, setSelectedUser] = useState<DbUserRow | null>(null);

  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, Permission[]>>(() => {
    const entries = Object.values(UserRole).map((role) => [role, [...(ROLE_PERMISSIONS[role] ?? [])]]);
    return Object.fromEntries(entries) as Record<UserRole, Permission[]>;
  });

  const refreshRoles = useCallback(async () => {
    const response = await fetch("/api/v1/rbac/roles");
    if (!response.ok) throw new Error("Failed to load roles");
    const data = (await response.json()) as { roles: Array<{ code: UserRole; permissions: Permission[] }> };

    setRolePermissions((prev) => {
      const next: Record<UserRole, Permission[]> = { ...prev };
      for (const role of data.roles) {
        next[role.code] = role.permissions;
      }
      return next;
    });
  }, []);

  const refreshUsers = useCallback(async () => {
    const response = await fetch("/api/v1/rbac/users");
    if (!response.ok) throw new Error("Failed to load users");
    const data = (await response.json()) as { users: DbUserRow[] };
    setUsers(data.users);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await Promise.all([refreshRoles(), refreshUsers()]);
        if (!active) return;
        setAlert("");
      } catch {
        if (!active) return;
        setAlert("Unable to load permissions from database. Using fallback view.");
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [refreshRoles, refreshUsers]);

  const managePermissionCount = useMemo(() => {
    return users.filter((user) => user.effectivePermissions.includes(Permission.MANAGE_PERMISSIONS)).length;
  }, [users]);

  const mockUserByCode = useMemo(() => {
    const map = new Map<string, MockUser>();
    for (const user of MOCK_USERS) map.set(user.id, user);
    return map;
  }, []);

  const togglePermission = useCallback(async (userCode: string, permission: Permission) => {
    const target = users.find((user) => user.code === userCode);
    if (!target) return;

    const currentOverride = target.overrides.find((override) => override.code === permission) ?? null;
    const hasEffective = target.effectivePermissions.includes(permission);

    let nextEffect: "allow" | "deny" | "unset";
    if (currentOverride) {
      nextEffect = "unset";
    } else {
      nextEffect = hasEffective ? "deny" : "allow";
    }

    if (permission === Permission.MANAGE_PERMISSIONS && hasEffective && nextEffect === "deny" && managePermissionCount <= 1) {
      setAlert("At least one officer must retain the Manage Permissions privilege.");
      return;
    }

    setAlert("");

    const response = await fetch(`/api/v1/rbac/users/${userCode}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionCode: permission, effect: nextEffect }),
    });

    if (!response.ok) {
      setAlert("Unable to persist user permission change.");
      return;
    }

    await refreshUsers();

    // Keep the modal user data in sync after refresh
    setSelectedUser((prev) => {
      if (!prev || prev.code !== userCode) return prev;
      return users.find((u) => u.code === userCode) ?? prev;
    });
  }, [managePermissionCount, refreshUsers, users]);

  // Sync selectedUser when users list updates
  useEffect(() => {
    setSelectedUser((prev) => {
      if (!prev) return null;
      return users.find((u) => u.code === prev.code) ?? prev;
    });
  }, [users]);

  return (
    <AppShell title="Admin · Users">
      <div className="space-y-6 px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Administration</p>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">User Directory</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Manage HUDD role assignments and access visibility.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Active Users</p>
            <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{MOCK_USERS.length}</p>
          </div>
        </div>

        {alert && !selectedUser && (
          <p className="text-xs text-[var(--alert-critical)]">{alert}</p>
        )}

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-surface)] text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Officer</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Assigned Schemes</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const overrideCount = user.overrides.length;
                const grantedCount = user.effectivePermissions.length;
                return (
                  <tr key={user.code ?? user.email} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{user.name}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.roles[0] ?? UserRole.VIEWER} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{user.department ?? ""}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {mockUserByCode.get(user.code ?? "")?.assignedSchemes?.join(", ") ?? ""}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setAlert(""); setSelectedUser(user); }}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)] hover:border-[var(--text-muted)]"
                        title="Manage permissions for this user"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8.5 8.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M6 4v4M4 6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Permissions
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <PermissionsModal
          user={selectedUser}
          onToggle={togglePermission}
          onClose={() => { setSelectedUser(null); setAlert(""); }}
          alert={alert}
        />
      )}
    </AppShell>
  );
}
