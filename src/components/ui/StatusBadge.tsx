import clsx from "clsx";
import { ActionItemStatus, FinancialEntryStatus, KPIStatus } from "@/types";

type StatusValue = ActionItemStatus | FinancialEntryStatus | KPIStatus;

type Tone = "critical" | "warning" | "success" | "neutral";

const STATUS_CONFIG: Record<StatusValue, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "neutral" },
  IN_PROGRESS: { label: "In Progress", tone: "warning" },
  PROOF_UPLOADED: { label: "Proof Uploaded", tone: "warning" },
  UNDER_REVIEW: { label: "Under Review", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  OVERDUE: { label: "Overdue", tone: "critical" },
  not_submitted: { label: "Not Submitted", tone: "neutral" },
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "warning" },
  submitted_pending: { label: "Pending Review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  submitted_this_week: { label: "Submitted This Week", tone: "success" },
  overdue: { label: "Overdue", tone: "critical" },
  not_started: { label: "Not Started", tone: "neutral" },
};

const TONE_STYLES: Record<Tone, { color: string; background: string; border: string }> = {
  critical: {
    color: "var(--alert-critical)",
    background: "rgba(255, 59, 59, 0.12)",
    border: "rgba(255, 59, 59, 0.4)",
  },
  warning: {
    color: "var(--alert-warning)",
    background: "rgba(255, 184, 0, 0.12)",
    border: "rgba(255, 184, 0, 0.4)",
  },
  success: {
    color: "var(--alert-success)",
    background: "rgba(0, 200, 83, 0.12)",
    border: "rgba(0, 200, 83, 0.4)",
  },
  neutral: {
    color: "var(--text-muted)",
    background: "rgba(136, 136, 136, 0.16)",
    border: "rgba(136, 136, 136, 0.32)",
  },
};

const SIZE_CLASSES = {
  sm: "text-[9px] px-2 py-0.5",
  md: "text-[10px] px-2.5 py-1",
} as const;

type BadgeSize = keyof typeof SIZE_CLASSES;

interface StatusBadgeProps {
  status: StatusValue;
  size?: BadgeSize;
  className?: string;
}

export default function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const tone = TONE_STYLES[config.tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border uppercase tracking-[0.3em] font-semibold",
        SIZE_CLASSES[size],
        className,
      )}
      style={{ color: tone.color, backgroundColor: tone.background, borderColor: tone.border }}
    >
      {config.label}
    </span>
  );
}
