"use client";

import { FONT_SCALE_OPTIONS, useFontScale } from "@/components/FontScaleProvider";

type TextSizeToolbarControlProps = {
  compact?: boolean;
};

export default function TextSizeToolbarControl({ compact = false }: TextSizeToolbarControlProps) {
  const { fontScale, setFontScale } = useFontScale();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-on-dark-subtle)">Text size</span>
      <div
        className="inline-flex items-center rounded-full border border-(--border) bg-(--bg-card) p-1"
        role="group"
        aria-label="Set text size"
      >
        {FONT_SCALE_OPTIONS.map((option) => {
          const active = option.value === fontScale;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFontScale(option.value)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                compact ? "min-w-[40px]" : "min-w-[74px]",
                active
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-text-primary)"
                  : "text-(--text-secondary) hover:bg-(--bg-content-surface)",
              ].join(" ")}
            >
              {compact ? option.shortLabel : option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
