"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useRequireAuth } from "@/src/lib/route-guards";
import { addActionItemProof, getActionItemById, updateActionItem } from "@/src/lib/services/actionItemService";
import { ActionItem, UserRole } from "@/types";
import { MOCK_USERS, hasPermission, Permission } from "@/lib/auth";
import RoleBadge from "@/src/components/ui/RoleBadge";
import StatusBadge from "@/src/components/ui/StatusBadge";
import PriorityBadge from "@/src/components/ui/PriorityBadge";
import StatusTimeline from "@/src/components/ui/StatusTimeline";
import ProofUpload from "@/src/components/ui/ProofUpload";
import ConfirmModal from "@/src/components/ui/ConfirmModal";

const DESIGNATIONS: Record<UserRole, string> = {
  [UserRole.ACS]: "Additional Chief Secretary",
  [UserRole.PS_HUDD]: "Principal Secretary",
  [UserRole.AS]: "Additional Secretary",
  [UserRole.FA]: "Finance Advisor",
  [UserRole.TASU]: "TASU Lead",
  [UserRole.NODAL_OFFICER]: "Nodal Officer",
  [UserRole.DIRECTOR]: "Director",
  [UserRole.VIEWER]: "Audit Viewer",
};

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const matchUser = (name: string) => {
  const target = normalize(name);
  return (
    MOCK_USERS.find((user) => {
      const normalized = normalize(user.name);
      return normalized.includes(target) || target.includes(normalized);
    }) ?? null
  );
};

function isDesignatedReviewer(item: ActionItem, u: { id: string; name: string }): boolean {
  const code = item.reviewerUserCode?.trim().toLowerCase();
  if (code && code === u.id.trim().toLowerCase()) return true;
  return normalize(item.reviewer) === normalize(u.name);
}

function isAssignedOfficer(item: ActionItem, u: { id: string; name: string }): boolean {
  const code = item.assignedToUserCode?.trim().toLowerCase();
  if (code && code === u.id.trim().toLowerCase()) return true;
  return normalize(item.assignedTo) === normalize(u.name);
}

export default function ActionItemDetailPage() {
  const user = useRequireAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [item, setItem] = useState<ActionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [manualUpdateText, setManualUpdateText] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const data = await getActionItemById(id);
    setItem(data ?? null);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getActionItemById(id);
        if (!active) return;
        setItem(data ?? null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const assignedUser = useMemo(() => (item ? matchUser(item.assignedTo) : null), [item]);
  const reviewerUser = useMemo(() => (item ? matchUser(item.reviewer) : null), [item]);

  const isViewer = user?.role === UserRole.VIEWER;
  const isNodal = user?.role === UserRole.NODAL_OFFICER;
  const canReviewerAct = Boolean(
    item &&
      user &&
      [UserRole.AS, UserRole.PS_HUDD, UserRole.ACS].includes(user.role) &&
      item.status === "UNDER_REVIEW" &&
      isDesignatedReviewer(item, user),
  );
  const showNodalActions = Boolean(
    item && isNodal && !isViewer && user && isAssignedOfficer(item, user),
  );

  const canAddManualUpdate = useMemo(() => {
    if (!item || !user || isViewer) return false;
    return (
      hasPermission(user, Permission.UPDATE_ACTION_ITEMS) ||
      matchUser(item.assignedTo)?.id === user.id
    );
  }, [item, user, isViewer]);

  const closeLabel = actionSuccess ? "Completed" : "Mark Completed";

  const thread = useMemo(() => {
    if (!item) return [];
    return item.updates.map((update, index) => ({
      id: update.id ?? `${item.id}-upd-${index}`,
      author: update.actor,
      note: update.note,
      status: update.status,
      timestamp: update.timestamp,
    }));
  }, [item]);

  if (loading) {
    return (
      <AppShell title="Action Item">
        <div className="px-6 py-6 text-sm text-[var(--text-muted)]">Loading action item...</div>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell title="Action Item">
        <div className="px-6 py-6 text-sm text-[var(--text-muted)]">Action item not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Action Item">
      <div className="relative space-y-6 px-6 py-6">
        {isViewer && (
          <div className="pointer-events-none absolute right-6 top-4 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Read-only
          </div>
        )}

        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)]"
        >
          <ArrowLeft size={16} /> Back to list
        </button>

        {actionSuccess && (
          <div className="rounded-xl border border-[var(--alert-success)] bg-[rgba(0,200,83,0.1)] px-4 py-3 text-sm text-[var(--alert-success)]">
            {actionSuccess}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">{item.schemeId}</p>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{item.title}</h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{item.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={item.status} />
              <PriorityBadge priority={item.priority} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
            <span>Vertical: {item.vertical}</span>
            <span>Due {item.dueDate}</span>
            {item.daysOverdue && item.daysOverdue > 0 && (
              <span className="text-[var(--alert-critical)]">{item.daysOverdue} days overdue</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[{ label: "Assigned Officer", person: item.assignedTo, profile: assignedUser }, { label: "Reviewer", person: item.reviewer, profile: reviewerUser }].map((card) => (
            <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">{card.label}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{card.profile?.name ?? card.person}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {card.profile ? DESIGNATIONS[card.profile.role] : "HUDD Officer"}
                  </p>
                </div>
                {card.profile && <RoleBadge role={card.profile.role} />}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Status Timeline</p>
            <div className="mt-4">
              <StatusTimeline updates={item.updates} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Proof Files</p>
              <div className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
                {item.proofFiles.length === 0 && "No files uploaded yet."}
                {item.proofFiles.map((file) => (
                  <div key={file.name} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
                    <span>{file.name}</span>
                    <a href={file.link} target="_blank" rel="noreferrer" className="text-xs text-[var(--text-primary)] underline">
                      Open
                    </a>
                  </div>
                ))}
              </div>
            </div>
            {showNodalActions && (
              <>
                <button
                  className="w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await updateActionItem(id, { status: "IN_PROGRESS", note: "Marked in progress" });
                      await refresh();
                      setActionSuccess("Marked as in progress.");
                    } catch (e: unknown) {
                      setActionSuccess(e instanceof Error ? e.message : "Update failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Mark In Progress
                </button>
                <ProofUpload
                  accept="application/pdf,image/*,*/*"
                  disabled={isViewer || busy}
                  onUpload={async (files) => {
                    const f = files[0];
                    if (!f) return;
                    setBusy(true);
                    try {
                      const url = typeof window !== "undefined" ? URL.createObjectURL(f) : "";
                      await addActionItemProof(id, { name: f.name, url: url || `https://local.invalid/${encodeURIComponent(f.name)}` });
                      await refresh();
                      setActionSuccess("Proof uploaded.");
                    } catch (e: unknown) {
                      setActionSuccess(e instanceof Error ? e.message : "Upload failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <button
                  className="w-full rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] disabled:opacity-60"
                  onClick={() => setConfirmClose(true)}
                >
                  Upload Proof + Mark Complete
                </button>
              </>
            )}

            {canReviewerAct && !isViewer && (
              <>
                <button
                  className="w-full rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)]"
                  onClick={() => setConfirmApprove(true)}
                >
                  Approve Completion
                </button>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Rejection Comment</p>
                  <textarea
                    value={rejectComment}
                    onChange={(event) => setRejectComment(event.target.value)}
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    placeholder="Reason required before reject"
                  />
                  <button
                    className="mt-3 w-full rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50"
                    onClick={() => setConfirmReject(true)}
                    disabled={!rejectComment.trim().length}
                  >
                    Reject with Comment
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Updates</p>
          {canAddManualUpdate && (
            <div className="mt-4 space-y-3">
              <textarea
                value={manualUpdateText}
                onChange={(event) => setManualUpdateText(event.target.value)}
                rows={3}
                disabled={busy}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                placeholder="Add an update for this action item…"
              />
              <button
                type="button"
                className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] disabled:opacity-50"
                disabled={busy || !manualUpdateText.trim().length}
                onClick={async () => {
                  const note = manualUpdateText.trim();
                  if (!note) return;
                  setBusy(true);
                  try {
                    await updateActionItem(id, { note });
                    await refresh();
                    setManualUpdateText("");
                    setActionSuccess("Update posted.");
                  } catch (e: unknown) {
                    setActionSuccess(e instanceof Error ? e.message : "Could not post update");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Post update
              </button>
            </div>
          )}
          <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
            {thread.length === 0 && "No updates yet."}
            {thread.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>{entry.author}</span>
                  <span>{entry.timestamp}</span>
                </div>
                <div className="mt-2 text-sm text-[var(--text-primary)]">{entry.note}</div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">{entry.status.replace(/_/g, " ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmClose}
        title="Confirm completion"
        message="This action item will be marked as completed and moved to the completed queue."
        confirmLabel="Confirm & Close"
        onCancel={() => setConfirmClose(false)}
        onConfirm={async () => {
          setConfirmClose(false);
          setBusy(true);
          try {
            await updateActionItem(id, { status: "UNDER_REVIEW", note: "Submitted for reviewer approval" });
            await refresh();
            setActionSuccess("Submitted for review.");
          } catch (e: unknown) {
            setActionSuccess(e instanceof Error ? e.message : "Update failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmModal
        open={confirmApprove}
        title="Approve completion"
        message="This action item will be marked as approved and closed."
        confirmLabel="Approve"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={async () => {
          setConfirmApprove(false);
          setBusy(true);
          try {
            await updateActionItem(id, { reviewerDecision: "approve" });
            await refresh();
            setActionSuccess("Action item approved and closed.");
          } catch (e: unknown) {
            setActionSuccess(e instanceof Error ? e.message : "Approval failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      <ConfirmModal
        open={confirmReject}
        title="Reject completion"
        message="A rejection note will be sent back to the assigned officer."
        confirmLabel="Reject"
        tone="danger"
        onCancel={() => setConfirmReject(false)}
        onConfirm={async () => {
          setConfirmReject(false);
          setBusy(true);
          try {
            await updateActionItem(id, { reviewerDecision: "reject", rejectionReason: rejectComment });
            await refresh();
            setActionSuccess("Action item rejected with comment.");
            setRejectComment("");
          } catch (e: unknown) {
            setActionSuccess(e instanceof Error ? e.message : "Reject failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </AppShell>
  );
}
