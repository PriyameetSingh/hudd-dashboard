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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-primary)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[var(--accent)]/8 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[var(--accent)]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col border-b border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--accent)]">Meeting In Progress</p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {meeting.title ?? "Untitled Meeting"}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {meeting.meetingDate} &middot; FY {getFinancialYear(meeting.meetingDate)}
            </p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5 sm:px-4">
              <Clock size={14} className="text-[var(--accent)]" />
              <span className="font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">
                {fmtTime(elapsed)}
              </span>
            </div>

            <button
              id="btn-end-meeting"
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl border border-[var(--alert-critical)]/40 bg-[var(--alert-critical)]/10 px-3 py-2 text-sm font-medium text-[var(--alert-critical)] transition-all hover:bg-[var(--alert-critical)]/20 sm:px-4"
            >
              <X size={16} /> End Meeting
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-5 py-3 sm:px-8">
          {PANELS.map(({ id, label, icon: Icon }) => {
            if (id === "presentations" && materials.length === 0) return null;
            const active = effectivePanel === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPanel(id)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20"
                    : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-card)]/95 p-5 backdrop-blur-lg md:block lg:w-80">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Agenda</p>
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            {topics.length} topic{topics.length !== 1 ? "s" : ""}
          </p>

          <ul className="space-y-2">
            {topics.map((t, idx) => {
              const isCurrent = idx === currentIdx;
              const isDone = idx < currentIdx;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentIdx(idx);
                      setPanel("agenda");
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition-all ${
                      isCurrent
                        ? "border border-[var(--accent)]/30 bg-[var(--accent)]/10 font-semibold text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10"
                        : isDone
                          ? "text-[var(--text-muted)] line-through opacity-60"
                          : "text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-[var(--alert-success)]" />
                      ) : isCurrent ? (
                        <MessageCircle size={16} />
                      ) : (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                          {idx + 1}
                        </span>
                      )}
                    </span>
                    <span>{t.topic}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 sm:p-10">
          {effectivePanel === "agenda" && (
            <div className="flex flex-1 flex-col items-center justify-center">
              {topics.length === 0 ? (
                <p className="text-lg text-[var(--text-muted)]">No discussion topics for this meeting.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                    Topic {currentIdx + 1} of {topics.length}
                  </p>

                  <div
                    key={topics[currentIdx].id}
                    className="w-full max-w-2xl animate-[topicIn_0.4s_ease] rounded-3xl border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent)]/5 to-transparent p-8 shadow-xl shadow-[var(--accent)]/5 sm:p-10"
                  >
                    <MessageCircle size={28} className="mb-4 text-[var(--accent)] opacity-60" />
                    <h2 className="text-2xl font-semibold leading-snug text-[var(--text-primary)]">
                      {topics[currentIdx].topic}
                    </h2>
                  </div>

                  <div className="mt-8 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setCurrentIdx((i) => i - 1)}
                      disabled={!hasPrev}
                      className="rounded-xl border border-[var(--border)] px-5 py-2 text-sm text-[var(--text-muted)] transition-all hover:bg-[var(--bg-card)] disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentIdx((i) => i + 1)}
                      disabled={!hasNext}
                      className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:brightness-110 disabled:opacity-30"
                    >
                      Next Topic <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="mt-6 flex gap-2">
                    {topics.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentIdx(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentIdx
                            ? "w-6 bg-[var(--accent)]"
                            : idx < currentIdx
                              ? "w-2 bg-[var(--accent)]/40"
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
            <div className="mx-auto w-full max-w-5xl space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Presentation files</h2>
              <PresentationsPanel meetingId={meeting.id} materials={materials} />
            </div>
          )}

          {effectivePanel === "financial" && (
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Financial progress</h2>
              <FinancialMeetingPanel />
            </div>
          )}

          {effectivePanel === "kpis" && (
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">KPI progress</h2>
              <KpiMeetingPanel />
            </div>
          )}

          {effectivePanel === "since_last" && (
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Progress since last meeting</h2>
              <SinceLastMeetingPanel key={meeting.id} meeting={meeting} allMeetings={allMeetings} />
            </div>
          )}

          {effectivePanel === "action_items" && (
            <div className="mx-auto w-full max-w-4xl space-y-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Action items</h2>
              <ActionItemsMeetingPanel meeting={meeting} />
            </div>
          )}
        </div>
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
