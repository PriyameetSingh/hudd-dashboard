"use client";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext<{ mounted: boolean }>({
  mounted: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("hudd-theme");
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  return <ThemeContext.Provider value={{ mounted }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
