import clsx from "clsx";

interface PendingBadgeProps {
  count: number;
  label?: string;
  className?: string;
}

export default function PendingBadge({ count, label = "Pending", className }: PendingBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]",
        className,
      )}
    >
      <span className="text-[11px] font-bold text-[var(--text-primary)]">{count}</span>
      {label}
    </span>
  );
}
