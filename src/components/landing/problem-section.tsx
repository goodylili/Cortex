"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { Reveal } from "@/components/landing/reveal";

const HEADLINE = "AI Should Not Forget You";

export function ProblemSection() {
  return (
    <section className="relative w-full border-b border-ink/10 bg-canvas py-24 md:py-32">
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-center px-6 md:px-12 lg:px-16">
        <div className="flex flex-col items-center space-y-8 text-center">
          <div className="flex w-fit items-center gap-3 rounded-full border border-ink/20 bg-ink/10 px-4 py-2">
            <div className="h-2.5 w-2.5 bg-ink" />
            <span className="text-sm font-medium tracking-wide text-ink/70">
              The Challenge
            </span>
          </div>
          <h2 className="text-balance text-5xl font-normal tracking-tight text-ink md:text-6xl lg:text-5xl">
            {HEADLINE.split(" ").map((word, i) => (
              <motion.span
                key={i}
                initial={{ filter: "blur(10px)", opacity: 0 }}
                whileInView={{ filter: "blur(0px)", opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="mr-[0.25em] inline-block"
              >
                {word}
              </motion.span>
            ))}
          </h2>

          <Reveal>
            <p className="text-balance text-lg leading-relaxed text-ink/60 md:text-xl">
              Your notes, files, and thoughts are scattered across tools. Each
              conversation starts fresh. Your context is forgotten. Your memory
              is lost between sessions and switching between AI tools means
              starting from scratch every time.
            </p>
          </Reveal>

          <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:justify-center">
            <Link
              href="#solution"
              className="rounded bg-ink px-8 py-3 font-semibold text-canvas transition-all hover:bg-ink/90 active:scale-95"
            >
              See How Cortex Works
            </Link>
            <Link
              href="#features"
              className="rounded border border-ink/20 px-8 py-3 font-semibold text-ink transition-all hover:bg-ink/10 active:scale-95"
            >
              Read the Philosophy
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
