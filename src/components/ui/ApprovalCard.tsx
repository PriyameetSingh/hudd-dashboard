import Link from "next/link";
import clsx from "clsx";
import { UserRole } from "@/types";
import PendingBadge from "./PendingBadge";
import RoleBadge from "./RoleBadge";

interface ApprovalOwner {
  name: string;
  designation: string;
  role: UserRole;
}

interface ApprovalCardProps {
  title: string;
  description?: string;
  count: number;
  href?: string;
  owner?: ApprovalOwner;
  className?: string;
}

export default function ApprovalCard({ title, description, count, href, owner, className }: ApprovalCardProps) {
  const content = (
    <div
      className={clsx(
        "rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm transition hover:border-[var(--border-strong)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Approval Queue</p>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        <PendingBadge count={count} />
      </div>
      {description && <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>}
      {owner && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{owner.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{owner.designation}</p>
          </div>
          <RoleBadge role={owner.role} />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
