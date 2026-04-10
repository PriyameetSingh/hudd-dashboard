"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { useRequireRole } from "@/src/lib/route-guards";
import { getCurrentUser, hasPermission, UserRole, Permission } from "@/lib/auth";
import {
  fetchMeetings,
  createMeeting,
  MeetingListItem,
} from "@/src/lib/services/meetingService";
import {
  CalendarPlus,
  Play,
  X,
  Plus,
  Trash2,
  Sparkles,
  MessageCircle,
  ChevronRight,
  Clock,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  HELPER — derive Financial Year label from a date string           */
/* ------------------------------------------------------------------ */
function getFinancialYear(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  // FY starts 1 April → months 0-2 (Jan-Mar) belong to previous FY
  const startYear = month < 3 ? year - 1 : year;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ================================================================== */
/*  PAGE                                                               */
/* ================================================================== */
export default function MeetingsPage() {
  useRequireRole(
    [UserRole.TASU, UserRole.AS, UserRole.PS_HUDD, UserRole.ACS],
    "/dashboard",
  );

  /* ---- data ---- */
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- UI state ---- */
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<MeetingListItem | null>(null);

  /* ---- permissions (deferred to avoid SSR/client mismatch) ---- */
  const [canSchedule, setCanSchedule] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setCanSchedule(
      hasPermission(user, Permission.CREATE_ACTION_ITEMS) ||
      hasPermission(user, Permission.MANAGE_SCHEMES),
    );
  }, []);

  /* ---- fetch meetings ---- */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMeetings();
      setMeetings(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayISO();

  /* ---- split meetings into today vs rest ---- */
  const todayMeetings = meetings.filter((m) => m.meetingDate === today);
  const otherMeetings = meetings.filter((m) => m.meetingDate !== today);

  /* ================================================================ */
  /*  ACTIVE MEETING OVERLAY                                          */
  /* ================================================================ */
  if (activeMeeting) {
    return (
      <ActiveMeetingOverlay
        meeting={activeMeeting}
        onClose={() => setActiveMeeting(null)}
      />
    );
  }

  /* ================================================================ */
  /*  MAIN MEETINGS VIEW                                              */
  /* ================================================================ */
  return (
    <AppShell title="Meetings">
      <div className="space-y-8 px-6 py-8">
        {/* ---- Header ---- */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">
              Coordination Desk
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Meeting Calendar
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              HUDD dashboard meetings and linked action items.
            </p>
          </div>
          {canSchedule && (
            <button
              id="btn-schedule-meeting"
              type="button"
              onClick={() => setShowSchedule(true)}
              className="group flex items-center gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-5 py-2.5 text-sm font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent)]/20 hover:shadow-lg hover:shadow-[var(--accent)]/10 active:scale-[0.97]"
            >
              <CalendarPlus size={16} className="transition-transform group-hover:rotate-6" />
              Schedule Meeting
            </button>
          )}
        </div>

        {/* ---- Error ---- */}
        {error && (
          <div className="rounded-xl border border-[var(--alert-critical)] bg-[var(--alert-critical)]/5 px-4 py-3 text-sm text-[var(--alert-critical)]">
            {error}
          </div>
        )}

        {/* ---- Loading ---- */}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Loading meetings…
          </div>
        )}

        {/* ---- Empty ---- */}
        {!loading && meetings.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">
            <CalendarPlus size={32} className="mx-auto mb-3 opacity-30" />
            No meetings recorded yet.
            {canSchedule && (
              <span className="block mt-1">
                Click <strong>Schedule Meeting</strong> to create one.
              </span>
            )}
          </div>
        )}

        {/* ---- Today's meetings ---- */}
        {todayMeetings.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
              <Sparkles size={14} /> Today&apos;s Meetings
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {todayMeetings.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  isToday
                  onStart={() => setActiveMeeting(m)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ---- All other meetings ---- */}
        {otherMeetings.length > 0 && (
          <section>
            {todayMeetings.length > 0 && (
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
                Upcoming &amp; Past
              </h2>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {otherMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ---- Schedule Modal ---- */}
      {showSchedule && (
        <ScheduleMeetingModal
          onClose={() => setShowSchedule(false)}
          onCreated={() => {
            setShowSchedule(false);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

/* ================================================================== */
/*  MEETING CARD                                                       */
/* ================================================================== */
function MeetingCard({
  meeting,
  isToday = false,
  onStart,
}: {
  meeting: MeetingListItem;
  isToday?: boolean;
  onStart?: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg ${isToday
        ? "border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/5 to-[var(--bg-card)] shadow-md shadow-[var(--accent)]/5"
        : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-hover,var(--border))]"
        }`}
    >
      {/* subtle glow for today */}
      {isToday && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-3xl" />
      )}

      <div className="relative">
        {/* top row */}
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            {meeting.meetingDate}
          </p>
          <div className="flex items-center gap-2">
            {isToday && (
              <span className="flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                Today
              </span>
            )}
            <p className="text-xs text-[var(--text-muted)]">
              {meeting.createdByName ?? "—"}
            </p>
          </div>
        </div>

        {/* title */}
        <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
          {meeting.title ?? "Untitled meeting"}
        </h3>
        {meeting.notes && (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
            {meeting.notes}
          </p>
        )}

        {/* FY badge */}
        <div className="mt-3">
          <span className="inline-block rounded-md bg-[var(--bg-card,var(--bg-primary))] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            FY {getFinancialYear(meeting.meetingDate)}
          </span>
        </div>

        {/* Topics */}
        <div className="mt-4 text-xs text-[var(--text-muted)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em]">
            Discussion topics
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {meeting.topics.length === 0 && <li>No topics recorded</li>}
            {meeting.topics.map((t) => (
              <li key={t.id}>{t.topic}</li>
            ))}
          </ul>
        </div>

        {/* Action items */}
        <div className="mt-4 text-xs text-[var(--text-muted)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em]">
            Action items
          </p>
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

        {/* Start Meeting button for today */}
        {isToday && onStart && (
          <button
            id={`btn-start-meeting-${meeting.id}`}
            type="button"
            onClick={onStart}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-[var(--accent)]/30 active:scale-[0.98]"
          >
            <Play size={16} fill="white" />
            Start Meeting
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  SCHEDULE MEETING MODAL                                             */
/* ================================================================== */
function ScheduleMeetingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fy = getFinancialYear(date);

  const addTopic = () => setTopics((prev) => [...prev, ""]);
  const removeTopic = (idx: number) =>
    setTopics((prev) => prev.filter((_, i) => i !== idx));
  const updateTopic = (idx: number, value: string) =>
    setTopics((prev) => prev.map((t, i) => (i === idx ? value : t)));

  const handleSubmit = async () => {
    if (!date) {
      setFormError("Please select a date.");
      return;
    }
    if (!title.trim()) {
      setFormError("Please enter a meeting name.");
      return;
    }
    const validTopics = topics.filter((t) => t.trim());
    try {
      setSubmitting(true);
      setFormError(null);
      await createMeeting({
        meetingDate: date,
        title: title.trim(),
        topics: validTopics.map((t) => ({ topic: t.trim() })),
      });
      onCreated();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Failed to create meeting");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg animate-[modalIn_0.3s_ease] rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-8 shadow-2xl"
        style={{
          // @ts-expect-error custom keyframe
          "--tw-animate": "modalIn",
        }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Schedule a Meeting
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Fill in the details below to create a new meeting.
        </p>

        <div className="mt-6 space-y-5">
          {/* Date */}
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Meeting Date
            </span>
            <input
              id="input-meeting-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </label>

          {/* Title */}
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Meeting Name
            </span>
            <input
              id="input-meeting-title"
              type="text"
              placeholder="e.g. Monthly Review — PMAY Urban"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </label>

          {/* Financial Year (auto) */}
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Financial Year
            </span>
            <input
              id="input-meeting-fy"
              type="text"
              readOnly
              value={fy}
              className="mt-1 w-full cursor-default rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-2.5 text-sm text-[var(--text-muted)]"
            />
          </label>

          {/* Topics */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Topics for Discussion
            </span>
            <div className="mt-2 space-y-2">
              {topics.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    id={`input-topic-${idx}`}
                    type="text"
                    placeholder={`Topic ${idx + 1}`}
                    value={t}
                    onChange={(e) => updateTopic(idx, e.target.value)}
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                  {topics.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTopic(idx)}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--alert-critical)]/10 hover:text-[var(--alert-critical)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTopic}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent)]/80"
            >
              <Plus size={14} /> Add another topic
            </button>
          </div>

          {/* Error */}
          {formError && (
            <p className="text-sm text-[var(--alert-critical)]">{formError}</p>
          )}

          {/* Submit */}
          <button
            id="btn-submit-meeting"
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="w-full rounded-xl bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-[var(--accent)]/30 active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? "Scheduling…" : "Schedule Meeting"}
          </button>
        </div>
      </div>

      {/* keyframe for modal entrance */}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ================================================================== */
/*  ACTIVE MEETING (FULL-SCREEN OVERLAY)                               */
/* ================================================================== */
function ActiveMeetingOverlay({
  meeting,
  onClose,
}: {
  meeting: MeetingListItem;
  onClose: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // timer
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
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[var(--accent)]/8 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[var(--accent)]/5 blur-[120px]" />
      </div>

      {/* header bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)]/95 px-8 py-4 backdrop-blur-xl">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--accent)]">
            Meeting In Progress
          </p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {meeting.title ?? "Untitled Meeting"}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {meeting.meetingDate} &middot; FY {getFinancialYear(meeting.meetingDate)}
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* timer */}
          <div className="flex items-center gap-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5">
            <Clock size={14} className="text-[var(--accent)]" />
            <span className="font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">
              {fmtTime(elapsed)}
            </span>
          </div>

          <button
            id="btn-end-meeting"
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-[var(--alert-critical)]/40 bg-[var(--alert-critical)]/10 px-4 py-2 text-sm font-medium text-[var(--alert-critical)] transition-all hover:bg-[var(--alert-critical)]/20"
          >
            <X size={16} /> End Meeting
          </button>
        </div>
      </div>

      {/* body */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* ------- sidebar: topic list ------- */}
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--bg-card)]/95 p-6 backdrop-blur-lg">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Agenda
          </p>
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
                    onClick={() => setCurrentIdx(idx)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition-all ${isCurrent
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

          {/* action items */}
          {meeting.actionItems.length > 0 && (
            <div className="mt-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                Linked Action Items
              </p>
              <ul className="mt-3 space-y-2">
                {meeting.actionItems.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-3 py-2 text-xs"
                  >
                    <span className="text-[var(--text-primary)]">{a.title}</span>
                    <span className="rounded-full bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] uppercase text-[var(--text-muted)]">
                      {a.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* ------- main area: featured topic ------- */}
        <div className="flex flex-1 flex-col items-center justify-center p-12">
          {topics.length === 0 ? (
            <p className="text-lg text-[var(--text-muted)]">
              No discussion topics for this meeting.
            </p>
          ) : (
            <>
              {/* counter */}
              <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                Topic {currentIdx + 1} of {topics.length}
              </p>

              {/* topic card */}
              <div
                key={topics[currentIdx].id}
                className="w-full max-w-2xl animate-[topicIn_0.4s_ease] rounded-3xl border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent)]/5 to-transparent p-10 shadow-xl shadow-[var(--accent)]/5"
              >
                <MessageCircle
                  size={28}
                  className="mb-4 text-[var(--accent)] opacity-60"
                />
                <h2 className="text-2xl font-semibold leading-snug text-[var(--text-primary)]">
                  {topics[currentIdx].topic}
                </h2>
              </div>

              {/* navigation */}
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

              {/* progress dots */}
              <div className="mt-6 flex gap-2">
                {topics.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-2 rounded-full transition-all ${idx === currentIdx
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
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes topicIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
