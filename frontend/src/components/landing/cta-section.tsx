"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { Reveal } from "@/components/landing/reveal";
import { Button } from "@/components/ui/button";

const HEADLINE = "Own your memory stack, not just another AI workspace";

export function CtaSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-canvas via-canvas to-ink/20">
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:px-12 md:py-32 lg:px-16 lg:py-40">
        <div className="max-w-3xl">
          <h2 className="text-balance text-4xl font-normal tracking-tight text-ink md:text-5xl lg:text-6xl">
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
            <p className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-ink/70 md:text-lg">
              Launch Cortex and put your memory on infrastructure that can
              store, share, orchestrate, and dream with you. Built on Sui,
              designed for sovereign AI workflows.
            </p>
          </Reveal>
          <div className="mt-8 flex gap-4">
            <Button
              asChild
              size="lg"
              className="bg-ink px-8 text-canvas hover:bg-ink/90"
            >
              <Link href="/app">Start Free Today</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-ink/20 bg-transparent px-8 text-ink hover:bg-ink/10 hover:text-ink"
            >
              <Link href="#faq">Read the Docs</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
