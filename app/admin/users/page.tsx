"use client";

import AppShell from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRequireRole } from "@/src/lib/route-guards";
import { MockUser, Permission, ROLE_PERMISSIONS, UserRole, MOCK_USERS } from "@/lib/auth";
import RoleBadge from "@/src/components/ui/RoleBadge";
import PendingBadge from "@/src/components/ui/PendingBadge";

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

export default function AdminUsersPage() {
  useRequireRole([UserRole.ACS, UserRole.PS_HUDD], "/dashboard");

  const [users, setUsers] = useState<DbUserRow[]>([]);

  const [alert, setAlert] = useState("");

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

  const toggleRolePermission = useCallback(async (role: UserRole, permission: Permission) => {
    const perms = rolePermissions[role] ?? [];
    const has = perms.includes(permission);
    setRolePermissions((prev) => ({
      ...prev,
      [role]: has ? (prev[role] ?? []).filter((p) => p !== permission) : [...(prev[role] ?? []), permission],
    }));

    const response = await fetch(`/api/v1/rbac/roles/${role}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionCode: permission, granted: !has }),
    });

    if (!response.ok) {
      await refreshRoles();
      setAlert("Unable to persist role permission change.");
      return;
    }

    setAlert("");
  }, [refreshRoles, rolePermissions]);

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
  }, [managePermissionCount, refreshUsers, users]);

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

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Role configuration</p>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Assign permissions to roles</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              These toggles only update the UI for now; the backend hook (link below) will persist them when ready.
            </p>
            <a
              className="text-sm font-semibold text-[var(--text-primary)]"
              href="/admin/roles"
              aria-disabled="true"
            >
              Go to role management (coming soon)
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(rolePermissions).map(([roleKey, perms]) => {
              const role = roleKey as UserRole;
              return (
                <div
                  key={role}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{role.replace(/_/g, " ")}</h3>
                    <span className="text-[var(--text-muted)] text-xs">Dummy UI</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PERMISSION_LIST.map((permission) => {
                      const granted = perms.includes(permission);
                      return (
                        <button
                          key={`${role}-${permission}`}
                          onClick={() => toggleRolePermission(role, permission)}
                          className={`text-[10px] rounded-full border px-2 py-1 transition-colors whitespace-nowrap ${
                            granted
                              ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                              : "border-[var(--border)] bg-transparent text-[var(--text-muted)]"
                          }`}
                        >
                          {permission.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Pending Approvals</p>
            <PendingBadge count={3} />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Roles Assigned</p>
            <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">8</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-surface)] text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Officer</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Assigned Schemes</th>
                <th className="px-4 py-3">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.code ?? user.email} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{user.name}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.roles[0] ?? UserRole.VIEWER} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{user.department ?? ""}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{mockUserByCode.get(user.code ?? "")?.assignedSchemes?.join(", ") ?? ""}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {PERMISSION_LIST.map((permission) => {
                        const override = user.overrides.find((entry) => entry.code === permission) ?? null;
                        const granted = user.effectivePermissions.includes(permission);
                        return (
                          <button
                            key={`${user.code ?? user.email}-${permission}`}
                            onClick={() => togglePermission(user.code ?? "", permission)}
                            className={`text-[10px] rounded-full border px-2 py-1 transition-colors whitespace-nowrap ${
                              override?.effect === "deny"
                                ? "border-[var(--alert-critical)] bg-[rgba(255,59,59,0.12)] text-[var(--alert-critical)]"
                                : granted
                                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                                  : "border-[var(--border)] bg-transparent text-[var(--text-muted)]"
                            }`}
                            title={granted ? "Revoke" : "Grant"}
                          >
                            {permission.replace(/_/g, " ")}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {alert && (
            <p className="m-4 text-xs text-[var(--alert-critical)]">{alert}</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
