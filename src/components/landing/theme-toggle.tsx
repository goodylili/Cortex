"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useLandingTheme } from "@/components/landing/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", label: "System theme", icon: Monitor },
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
] as const;

export function ThemeToggle() {
  const { preference, setPreference } = useLandingTheme();

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-1 rounded-[var(--r)] border border-ink/15 bg-canvas/70 p-1 shadow-lg backdrop-blur-md">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setPreference(value)}
          aria-label={label}
          aria-pressed={preference === value}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[var(--r)] transition-colors",
            preference === value
              ? "bg-ink text-canvas"
              : "text-ink/50 hover:text-ink",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
