import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function LandingThemeProvider({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("cortex-landing min-h-screen bg-canvas text-ink", className)}>
      {children}
    </div>
  );
}
