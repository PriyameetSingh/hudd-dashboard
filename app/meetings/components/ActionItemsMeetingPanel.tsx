"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchActionItems } from "@/src/lib/services/actionItemService";
import type { MeetingListItem } from "@/src/lib/services/meetingService";
import type { ActionItem } from "@/types";

function statusTone(status: string) {
  switch (status) {
    case "COMPLETED":
      return "text-[var(--alert-success)]";
    case "OVERDUE":
      return "text-[var(--alert-critical)]";
    default:
      return "text-[var(--text-muted)]";
  }
}

export default function ActionItemsMeetingPanel({ meeting }: { meeting: MeetingListItem }) {
  const ids = useMemo(() => new Set(meeting.actionItems.map((a) => a.id)), [meeting.actionItems]);
  const [loading, setLoading] = useState(() => meeting.actionItems.length > 0);
  const [items, setItems] = useState<ActionItem[] | null>(() =>
    meeting.actionItems.length === 0 ? [] : null,
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (meeting.actionItems.length === 0) return;
    let alive = true;
    fetchActionItems()
      .then((all) => {
        if (!alive) return;
        setItems(all.filter((i) => ids.has(i.id)));
        setErr(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Failed to load action items");
        setItems(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [ids, meeting.actionItems.length]);

  const progress = useMemo(() => {
    const list = items ?? [];
    const done = list.filter((i) => i.status === "COMPLETED").length;
    return { total: list.length, done };
  }, [items]);

  if (meeting.actionItems.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No action items are linked to this meeting.</p>;
  }

  if (loading || items === null) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]">
        <Loader2 className="animate-spin" size={18} />
        Loading action items…
      </div>
    );
  }

  if (err) {
    return <p className="text-sm text-[var(--alert-critical)]">{err}</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        Progress: <strong className="text-[var(--text-primary)]">{progress.done}</strong> / {progress.total}{" "}
        completed
      </p>
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-[var(--text-primary)]">{a.title}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Due {a.dueDate} · {a.assignedTo}
              </p>
            </div>
            <span className={`text-xs font-semibold uppercase tracking-wide ${statusTone(a.status)}`}>
              {a.status.replace(/_/g, " ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
