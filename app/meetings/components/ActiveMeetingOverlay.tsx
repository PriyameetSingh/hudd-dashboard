"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  LayoutGrid,
  MessageCircle,
  X,
  FileText,
  LineChart,
  Target,
  TrendingUp,
  ListTodo,
} from "lucide-react";
import type { MeetingListItem } from "@/src/lib/services/meetingService";
import { getFinancialYear } from "../meetingUtils";
import PresentationsPanel from "./PresentationsPanel";
import FinancialMeetingPanel from "./FinancialMeetingPanel";
import KpiMeetingPanel from "./KpiMeetingPanel";
import SinceLastMeetingPanel from "./SinceLastMeetingPanel";
import ActionItemsMeetingPanel from "./ActionItemsMeetingPanel";

export type MeetingPanelId =
  | "agenda"
  | "presentations"
  | "financial"
  | "kpis"
  | "since_last"
  | "action_items";

const PANELS: Array<{
  id: MeetingPanelId;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: "agenda", label: "Agenda", icon: LayoutGrid },
  { id: "presentations", label: "Presentations", icon: FileText },
  { id: "financial", label: "Financial", icon: LineChart },
  { id: "kpis", label: "KPIs", icon: Target },
  { id: "since_last", label: "Since last meeting", icon: TrendingUp },
  { id: "action_items", label: "Action items", icon: ListTodo },
];

export default function ActiveMeetingOverlay({
  meeting,
  allMeetings,
  onClose,
}: {
  meeting: MeetingListItem;
  allMeetings: MeetingListItem[];
  onClose: () => void;
}) {
  const materials = meeting.materials ?? [];
  const [panel, setPanel] = useState<MeetingPanelId>(() =>
    materials.length > 0 ? "presentations" : "agenda",
  );

  const effectivePanel: MeetingPanelId =
    panel === "presentations" && materials.length === 0 ? "agenda" : panel;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const topics = meeting.topics;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < topics.length - 1;

  const panelLabel = PANELS.find((p) => p.id === effectivePanel)?.label ?? "";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-primary)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[var(--accent)]/6 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 h-[380px] w-[380px] rounded-full bg-[var(--accent)]/4 blur-[100px]" />
      </div>

      <header className="relative z-10 shrink-0 border-b border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--accent)]">Live meeting</p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-[var(--text-primary)] sm:text-xl">
              {meeting.title ?? "Untitled Meeting"}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {meeting.meetingDate} · FY {getFinancialYear(meeting.meetingDate)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2">
              <Clock size={15} className="shrink-0 text-[var(--accent)]" aria-hidden />
              <span className="font-mono text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                {fmtTime(elapsed)}
              </span>
            </div>

            <button
              id="btn-end-meeting"
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg border border-[var(--alert-critical)]/35 bg-[var(--alert-critical)]/[0.07] px-3 py-2 text-sm font-medium text-[var(--alert-critical)] transition-colors hover:bg-[var(--alert-critical)]/15"
            >
              <X size={16} aria-hidden /> <span className="hidden sm:inline">End meeting</span>
              <span className="sm:hidden">End</span>
            </button>
          </div>
        </div>

        <nav
          className="flex gap-1.5 overflow-x-auto border-t border-[var(--border)] px-3 py-2.5 sm:px-8"
          aria-label="Meeting sections"
        >
          {PANELS.map(({ id, label, icon: Icon }) => {
            if (id === "presentations" && materials.length === 0) return null;
            const active = effectivePanel === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPanel(id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-text)] shadow-sm"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={14} className="shrink-0 opacity-90" aria-hidden />
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {effectivePanel === "agenda" && (
          <aside className="hidden w-[min(100%,20rem)] shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-card)] p-4 md:block lg:w-80 lg:p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)]">Agenda outline</p>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              {topics.length} topic{topics.length !== 1 ? "s" : ""}
            </p>

            <ul className="space-y-1">
              {topics.map((t, idx) => {
                const isCurrent = idx === currentIdx;
                const isDone = idx < currentIdx;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors ${
                        isCurrent
                          ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)] ring-1 ring-[var(--accent)]/25"
                          : isDone
                            ? "text-[var(--text-muted)] line-through opacity-65"
                            : "text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-[var(--alert-success)]" aria-hidden />
                        ) : isCurrent ? (
                          <MessageCircle size={16} aria-hidden />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-medium text-[var(--text-muted)]">
                            {idx + 1}
                          </span>
                        )}
                      </span>
                      <span className="leading-snug">{t.topic}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--bg-primary)]/80">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
            {effectivePanel !== "agenda" && (
              <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)]">{panelLabel}</p>
            )}

            {effectivePanel === "agenda" && (
              <div className="flex flex-1 flex-col justify-center">
                {topics.length === 0 ? (
                  <p className="text-center text-[var(--text-muted)]">No discussion topics for this meeting.</p>
                ) : (
                  <>
                    <p className="mb-4 text-center text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)] md:text-left">
                      Topic {currentIdx + 1} of {topics.length}
                    </p>

                    <div
                      key={topics[currentIdx].id}
                      className="w-full animate-[topicIn_0.35s_ease] rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm sm:p-8"
                    >
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/10">
                        <MessageCircle size={22} className="text-[var(--accent)]" aria-hidden />
                      </div>
                      <h2 className="text-xl font-semibold leading-snug text-[var(--text-primary)] sm:text-2xl">
                        {topics[currentIdx].topic}
                      </h2>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((i) => i - 1)}
                        disabled={!hasPrev}
                        className="min-w-[7rem] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)] disabled:pointer-events-none disabled:opacity-35"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((i) => i + 1)}
                        disabled={!hasNext}
                        className="flex min-w-[7rem] items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-text)] shadow-sm transition-opacity hover:opacity-95 disabled:pointer-events-none disabled:opacity-35"
                      >
                        Next <ChevronRight size={16} aria-hidden />
                      </button>
                    </div>

                    <div className="mt-6 flex justify-center gap-1.5 md:justify-start">
                      {topics.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`Go to topic ${idx + 1}`}
                          onClick={() => setCurrentIdx(idx)}
                          className={`h-2 rounded-full transition-all ${
                            idx === currentIdx
                              ? "w-7 bg-[var(--accent)]"
                              : idx < currentIdx
                                ? "w-2 bg-[var(--accent)]/45"
                                : "w-2 bg-[var(--border)]"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {effectivePanel === "presentations" && materials.length > 0 && (
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-6">
                <PresentationsPanel meetingId={meeting.id} materials={materials} />
              </div>
            )}

            {effectivePanel === "financial" && (
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-6">
                <FinancialMeetingPanel />
              </div>
            )}

            {effectivePanel === "kpis" && (
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-6">
                <KpiMeetingPanel />
              </div>
            )}

            {effectivePanel === "since_last" && (
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-6">
                <SinceLastMeetingPanel key={meeting.id} meeting={meeting} allMeetings={allMeetings} />
              </div>
            )}

            {effectivePanel === "action_items" && (
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-6">
                <ActionItemsMeetingPanel meeting={meeting} />
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes topicIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
