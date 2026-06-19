"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "cortex-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useLandingTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useLandingTheme must be used within LandingThemeProvider");
  }
  return context;
}

export function LandingThemeProvider({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      setPreferenceState(stored);
    }
  }, []);

  useEffect(() => {
    if (preference !== "system") {
      setResolved(preference);
      return;
    }
    const media = window.matchMedia(DARK_QUERY);
    const sync = () => setResolved(media.matches ? "dark" : "light");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      <div
        className={cn(
          "cortex-landing min-h-screen bg-canvas text-ink",
          resolved === "light" && "theme-light",
          className,
        )}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
