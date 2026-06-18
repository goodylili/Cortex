"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/landing/footer";

const BrainOrb = dynamic(() => import("./brain-orb").then((m) => m.BrainOrb), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <Logo variant="white" className="h-16 w-16 animate-pulse opacity-40" />
    </div>
  ),
});

export function StatusScreen({
  code,
  title,
  onRetry,
}: {
  code: string;
  title: string;
  onRetry?: () => void;
}) {
  return (
    <div className="cortex-landing flex min-h-screen flex-col bg-canvas text-ink">
      <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-12 lg:px-16">
        <Link href="/" className="flex items-center gap-3 text-ink">
          <Logo variant="current" className="h-9 w-9" />
          <span className="text-lg font-medium">Cortex</span>
        </Link>
        <Link
          href="/app"
          className="group flex items-center gap-1.5 text-sm font-medium text-ink/70 transition-colors hover:text-ink md:text-base"
        >
          Launch App
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </nav>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="relative grid w-full place-items-center">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[min(82vw,560px)] w-[min(82vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(183,155,234,0.20),transparent_68%)] blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid select-none place-items-center"
          >
            <span className="text-[clamp(9rem,34vw,24rem)] font-light leading-none tracking-tighter text-ink/[0.09]">
              {code}
            </span>
          </span>

          <div className="relative z-10 aspect-square w-[min(86vw,520px)]">
            <BrainOrb />
          </div>
        </div>

        <h1 className="relative z-10 -mt-2 max-w-xl text-balance text-center text-2xl font-normal text-ink md:text-3xl">
          {title}
        </h1>

        <div className="relative z-10 mt-10 flex flex-col items-center gap-4 sm:flex-row">
          {onRetry ? (
            <>
              <Button
                size="lg"
                onClick={onRetry}
                className="bg-ink px-8 text-canvas hover:bg-ink/90"
              >
                Try Again
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-ink/20 bg-transparent px-8 text-ink hover:bg-ink/10 hover:text-ink"
              >
                <Link href="/">Back to Homepage</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                size="lg"
                className="bg-ink px-8 text-canvas hover:bg-ink/90"
              >
                <Link href="/">Back to Homepage</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-ink/20 bg-transparent px-8 text-ink hover:bg-ink/10 hover:text-ink"
              >
                <Link href="/app">Launch App</Link>
              </Button>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
