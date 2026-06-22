import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useTheme } from "../hooks/useTheme";
import type { ResolvedTheme, ThemePreference } from "../hooks/useTheme";

interface ThemeControls {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeControls | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useThemeControls(): ThemeControls {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeControls must be used within ThemeProvider");
  return ctx;
}
