import { type ReactNode } from "react";

import { Footer } from "@/components/landing/footer";
import { LandingThemeProvider } from "@/components/landing/theme-provider";
import { ThemeToggle } from "@/components/landing/theme-toggle";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <LandingThemeProvider>
      <main className="mx-auto max-w-3xl px-6 py-24 md:px-12 md:py-32 lg:px-16">
        {children}
      </main>
      <Footer />
      <ThemeToggle />
    </LandingThemeProvider>
  );
}
