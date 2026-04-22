"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "hudd-text-scale";

export const FONT_SCALE_OPTIONS = [
  { value: "md", label: "Standard", shortLabel: "A" },
  { value: "lg", label: "Larger", shortLabel: "A+" },
  { value: "xl", label: "Largest", shortLabel: "A++" },
] as const;

export type FontScale = (typeof FONT_SCALE_OPTIONS)[number]["value"];

const VALID_SCALES = new Set<FontScale>(FONT_SCALE_OPTIONS.map((option) => option.value));

type FontScaleContextValue = {
  fontScale: FontScale;
  setFontScale: (fontScale: FontScale) => void;
};

const FontScaleContext = createContext<FontScaleContextValue>({
  fontScale: "md",
  setFontScale: () => {},
});

function applyFontScaleToRoot(fontScale: FontScale) {
  document.documentElement.dataset.textScale = fontScale;
}

function parseStoredFontScale(value: string | null): FontScale {
  return value && VALID_SCALES.has(value as FontScale) ? (value as FontScale) : "md";
}

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const [fontScale, setFontScale] = useState<FontScale>("md");

  useEffect(() => {
    let nextScale: FontScale = "md";

    try {
      nextScale = parseStoredFontScale(localStorage.getItem(STORAGE_KEY));
    } catch {
      nextScale = "md";
    }

    setFontScale(nextScale);
    applyFontScaleToRoot(nextScale);
  }, []);

  useEffect(() => {
    applyFontScaleToRoot(fontScale);
    try {
      localStorage.setItem(STORAGE_KEY, fontScale);
    } catch {
      /* ignore storage failures */
    }
  }, [fontScale]);

  const value = useMemo(() => ({ fontScale, setFontScale }), [fontScale]);

  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export const useFontScale = () => useContext(FontScaleContext);
