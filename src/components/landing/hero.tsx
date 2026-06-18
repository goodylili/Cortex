"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion } from "framer-motion";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Memory", href: "/app#memories" },
  { label: "Features", href: "#features" },
  { label: "Agents", href: "/app#agents" },
  { label: "FAQ", href: "#faq" },
];

const HEADLINE_LINES = [
  ["Safe", "&", "Secure"],
  ["Uploaded", "Intelligence"],
];

export function Hero() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <section className="relative min-h-screen w-full bg-canvas">
      <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-canvas to-canvas" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="relative z-50 py-6">
          <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6 md:px-12 lg:px-16">
            <Link
              href="/"
              className="flex items-center gap-3 justify-self-start text-ink"
            >
              <Logo variant="current" className="h-10 w-10" />
              <span className="text-xl font-medium">Cortex</span>
            </Link>

            <div className="hidden items-center gap-8 justify-self-center text-base text-ink/60 lg:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition-colors hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4 justify-self-end">
              <Link
                href="/app"
                className="hidden text-base font-medium text-ink transition-colors hover:text-ink/80 lg:block"
              >
                Launch App
              </Link>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-ink lg:hidden"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="absolute left-0 right-0 top-full border-t border-ink/10 bg-canvas/95 backdrop-blur-sm lg:hidden">
              <div className="flex flex-col gap-4 px-6 py-6">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="py-2 text-ink/60 transition-colors hover:text-ink"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/app"
                  className="mt-2 border-t border-ink/10 py-2 font-medium text-ink"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Launch App
                </Link>
              </div>
            </div>
          )}
        </nav>

        <div className="flex flex-1 flex-col items-center px-6 pb-16 pt-16 text-center md:pt-24">
          <div className="mb-6 inline-block rounded-[var(--r)] border border-ink/20 bg-ink/10 px-3 py-1 text-xs font-medium text-ink/70">
            Local-first memory × Multi-agent AI
          </div>

          <h1 className="max-w-6xl text-6xl font-normal leading-[1.05] tracking-[-0.03em] text-ink md:text-7xl lg:text-8xl">
            {HEADLINE_LINES.map((line, lineIndex) => {
              const precedingWords = HEADLINE_LINES.slice(0, lineIndex).reduce(
                (sum, l) => sum + l.length,
                0,
              );
              return (
                <span key={lineIndex} className="block">
                  {line.map((word, wordIndex) => (
                    <motion.span
                      key={wordIndex}
                      initial={{ filter: "blur(10px)", opacity: 0 }}
                      animate={{ filter: "blur(0px)", opacity: 1 }}
                      transition={{
                        duration: 0.4,
                        delay: (precedingWords + wordIndex) * 0.05,
                      }}
                      className="mr-[0.25em] inline-block"
                    >
                      {word}
                    </motion.span>
                  ))}
                </span>
              );
            })}
          </h1>

          <p className="mt-6 max-w-2xl text-balance text-center text-lg leading-relaxed text-ink/60 md:text-xl">
            Cortex is a local-first persistent memory layer for AI. Keep your
            notes, files, and thoughts. Connect what belongs together. Recall
            with precision.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-[var(--r)] bg-ink px-8 text-canvas hover:bg-ink/90"
            >
              <Link href="/app">Try Cortex Free</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-[var(--r)] border-ink/20 bg-transparent px-8 text-ink hover:bg-ink/10 hover:text-ink"
            >
              <Link href="#solution">See How It Works</Link>
            </Button>
          </div>

          <div className="mx-auto mt-14 w-full max-w-7xl px-6 md:mt-20 md:px-12 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative w-full"
            >
              <div className="aspect-video w-full overflow-hidden rounded-[var(--r)] border border-ink/20 shadow-2xl md:aspect-[16/9]">
                <Image
                  src="/cortex-app.png"
                  alt="Cortex memory map"
                  width={1714}
                  height={1118}
                  priority
                  className="h-full w-full object-cover object-top"
                />
              </div>

              <div className="absolute -inset-1 -z-10 rounded-[var(--r)] bg-gradient-to-r from-ink/10 via-transparent to-ink/10 opacity-50 blur-2xl" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
