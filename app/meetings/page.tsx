"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";
import { fetchMeetings, MeetingListItem } from "@/src/lib/services/meetingService";

export default function MeetingsPage() {
  useRequireRole([UserRole.TASU, UserRole.AS, UserRole.PS_HUDD, UserRole.ACS], "/dashboard");

  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchMeetings();
        if (!active) return;
        setMeetings(data);
      } catch (e: unknown) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load meetings");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell title="Meetings">
      <div className="space-y-6 px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Coordination Desk</p>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Meeting Calendar</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">HUDD dashboard meetings and linked action items.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--alert-critical)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--alert-critical)]">
            {error}
          </div>
        )}

        {loading && <div className="text-sm text-[var(--text-muted)]">Loading meetings...</div>}

        {!loading && meetings.length === 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-sm text-[var(--text-muted)]">
            No meetings recorded yet.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">{meeting.meetingDate}</p>
                <p className="text-xs text-[var(--text-muted)]">{meeting.createdByName ?? "—"}</p>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{meeting.title ?? "Untitled meeting"}</h3>
              {meeting.notes && <p className="mt-2 text-sm text-[var(--text-muted)]">{meeting.notes}</p>}
              <div className="mt-4 text-xs text-[var(--text-muted)]">
                <p className="text-[10px] uppercase tracking-[0.3em]">Discussion topics</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {meeting.topics.length === 0 && <li>No topics recorded</li>}
                  {meeting.topics.map((t) => (
                    <li key={t.id}>{t.topic}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 text-xs text-[var(--text-muted)]">
                <p className="text-[10px] uppercase tracking-[0.3em]">Action items</p>
                <ul className="mt-2 space-y-1">
                  {meeting.actionItems.length === 0 && <li>None linked</li>}
                  {meeting.actionItems.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span>{a.title}</span>
                      <span className="text-[10px] uppercase">{a.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
