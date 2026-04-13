"use client";

import { useEffect, useState } from "react";
import { KPISubmission } from "@/types";
import { SearchableKpiUserField } from "@/components/schemes/AddKpiModal";
import { fetchSchemesOverview } from "@/src/lib/services/schemeService";
import { updateKpiDefinitionAssignments } from "@/src/lib/services/kpiService";

type Props = {
  open: boolean;
  submission: KPISubmission | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ReassignKpiModal({ open, submission, onClose, onSaved }: Props) {
  const [users, setUsers] = useState<Array<{ id: string; code: string | null; name: string; email: string }> | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [draftAssignedToId, setDraftAssignedToId] = useState("");
  const [draftReviewerId, setDraftReviewerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !submission) return;
    setUsers(null);
    setUsersError(null);
    setDraftAssignedToId(submission.assignedToUserId ?? "");
    setDraftReviewerId(submission.reviewerUserId ?? "");
    setMsg(null);
    let cancelled = false;
    fetchSchemesOverview()
      .then((data) => {
        if (!cancelled) setUsers(data.reference.users);
      })
      .catch((e: unknown) => {
        if (!cancelled) setUsersError(e instanceof Error ? e.message : "Could not load users");
      });
    return () => {
      cancelled = true;
    };
  }, [open, submission]);

  if (!open || !submission) return null;

  const handleSave = async () => {
    if (!draftAssignedToId || !draftReviewerId) {
      setMsg("Select both an action owner and a reviewer.");
      return;
    }
    if (draftAssignedToId === draftReviewerId) {
      setMsg("Action owner and reviewer must be different users.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await updateKpiDefinitionAssignments(submission.id, {
        assignedToId: draftAssignedToId,
        reviewerId: draftReviewerId,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reassign-kpi-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="reassign-kpi-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Reassign KPI
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {submission.scheme} — {submission.description}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {usersError && <p className="text-sm text-[var(--alert-critical)]">{usersError}</p>}
          {!usersError && users === null && (
            <p className="text-sm text-[var(--text-muted)]">Loading user directory…</p>
          )}
          {users && users.length < 2 && (
            <p className="text-sm text-[var(--text-muted)]">At least two active users are required to reassign.</p>
          )}
          {users && users.length >= 2 && (
            <>
              <SearchableKpiUserField
                label="Action owner"
                users={users}
                value={draftAssignedToId}
                onChange={setDraftAssignedToId}
                excludeUserId={draftReviewerId}
                disabled={busy}
              />
              <SearchableKpiUserField
                label="Reviewer"
                users={users}
                value={draftReviewerId}
                onChange={setDraftReviewerId}
                excludeUserId={draftAssignedToId}
                disabled={busy}
              />
            </>
          )}
          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={busy || !users || users.length < 2}
              onClick={handleSave}
              className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-primary)] disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save assignments"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
