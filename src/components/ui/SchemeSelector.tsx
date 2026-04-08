"use client";

import clsx from "clsx";

interface SchemeSelectorProps {
  schemes: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export default function SchemeSelector({ schemes, value, onChange, label = "Scheme", className }: SchemeSelectorProps) {
  return (
    <label className={clsx("flex flex-col gap-2 text-sm text-[var(--text-muted)]", className)}>
      <span className="text-xs uppercase tracking-[0.3em]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
      >
        <option value="">Select a scheme</option>
        {schemes.map((scheme) => (
          <option key={scheme} value={scheme}>
            {scheme}
          </option>
        ))}
      </select>
    </label>
  );
}
