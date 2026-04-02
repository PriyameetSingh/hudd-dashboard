"use client";

import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { UserRole } from "@/lib/auth";

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  owner: string;
  status: "Scheduled" | "Completed" | "Pending";
}

const meetings: Meeting[] = [
  {
    id: "meet-01",
    title: "Weekly HUDD Review",
    date: "22 Mar 2026",
    time: "10:30 AM",
    venue: "HUDD War Room",
    owner: "Principal Secretary",
    status: "Scheduled",
  },
  {
    id: "meet-02",
    title: "ULB Acceleration Sprint",
    date: "24 Mar 2026",
    time: "02:00 PM",
    venue: "Conference Hall B",
    owner: "Additional Secretary",
    status: "Pending",
  },
  {
    id: "meet-03",
    title: "Finance Lapse Risk Review",
    date: "26 Mar 2026",
    time: "04:00 PM",
    venue: "Virtual",
    owner: "Finance Advisor",
    status: "Completed",
  },
];

export default function MeetingsPage() {
  useRequireRole([UserRole.TASU, UserRole.AS, UserRole.PS_HUDD, UserRole.ACS], "/dashboard");

  return (
    <AppShell title="Meetings">
      <div className="space-y-6 px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Coordination Desk</p>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Meeting Calendar</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Live coordination touchpoints across verticals.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">{meeting.status}</p>
                <p className="text-xs text-[var(--text-muted)]">{meeting.date}</p>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{meeting.title}</h3>
              <div className="mt-2 text-sm text-[var(--text-muted)]">
                {meeting.time} · {meeting.venue}
              </div>
              <div className="mt-4 text-xs text-[var(--text-muted)]">Owner: {meeting.owner}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
