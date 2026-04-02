"use client";

import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole, MOCK_USERS } from "@/lib/auth";
import RoleBadge from "@/src/components/ui/RoleBadge";
import PendingBadge from "@/src/components/ui/PendingBadge";

export default function AdminUsersPage() {
  useRequireRole([UserRole.ACS, UserRole.PS_HUDD], "/dashboard");

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
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS.map((user) => (
                <tr key={user.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{user.name}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{user.department}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{user.assignedSchemes.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
