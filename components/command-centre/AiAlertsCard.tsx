"use client";

import { Sparkles } from "lucide-react";

/** Mock AI insights; replace with real model output later. */
export default function AiAlertsCard({ className = "" }: { className?: string }) {
  const alerts = [
    { title: "Utilisation pacing", body: "IFMS is trailing pro-rata FY pace in 2 high-budget verticals — review pipeline." },
    { title: "Scheme concentration", body: "Top 3 schemes account for a large share of spend — monitor variance vs KPIs." },
  ];
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3.5 ${className}`}
      style={{ borderStyle: "solid" }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">AI alerts</span>
        <span className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-muted)]">
          <Sparkles className="h-3 w-3" />
          Mock
        </span>
      </div>
      <ul className="space-y-2.5">
        {alerts.map((a) => (
          <li key={a.title} className="border-b border-[var(--border)] pb-2.5 last:border-0 last:pb-0">
            <p className="text-xs font-semibold text-[var(--text-primary)]">{a.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{a.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-[var(--text-muted)]">Full AI assistant — coming soon.</p>
    </div>
  );
}
