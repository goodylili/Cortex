"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import {
  Brain,
  ChevronRight,
  Network,
  Sparkles,
} from "lucide-react";

import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

interface SolutionStep {
  id: number;
  title: string;
  description: string;
  icon: ReactNode;
  image: string;
}

const HEADLINE = "Store · Coordinate · Dream";

const STEPS: SolutionStep[] = [
  {
    id: 1,
    title: "Store",
    description:
      "Commit notes, files, links, and media to sovereign memory on the Sui stack. Walrus gives you durable storage and Seal keeps it encrypted.",
    icon: <Brain className="h-5 w-5" />,
    image: "/images/keep-walrus.png",
  },
  {
    id: 2,
    title: "Coordinate",
    description:
      "Open shared memory lanes for teammates and agents, generate prompts and loops, and let multiple specialists work from the same grounded context.",
    icon: <Network className="h-5 w-5" />,
    image: "/images/connect-sui.jpg",
  },
  {
    id: 3,
    title: "Dream",
    description:
      "Cortex turns memory into insights. Recall facts, surface patterns, and generate dreams that synthesize what your graph has been telling you.",
    icon: <Sparkles className="h-5 w-5" />,
    // Width capped at 1600 (the slot is ~640px, 2x for retina) so the Unsplash CDN
    // serves a light image instead of the source 3376px asset.
    image:
      "https://plus.unsplash.com/premium_photo-1711987351245-6b048554813b?q=80&w=1600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
];

export function SolutionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(STEPS.length - 1, Math.floor(value * STEPS.length));
    setActiveIndex(next);
  });

  return (
    <div
      ref={sectionRef}
      id="solution"
      className="relative h-[300vh] border-b border-ink/10 bg-canvas"
    >
      <div className="sticky top-0 flex min-h-screen flex-col items-center justify-center py-24 text-ink">
        <div className="w-full max-w-7xl space-y-12 px-6 md:px-12 lg:px-16">
          <div className="flex max-w-[560px] flex-col gap-4">
            <div className="flex w-fit items-center gap-3 rounded-[var(--r)] border border-ink/20 bg-ink/10 px-4 py-2">
              <div className="h-2.5 w-2.5 bg-ink" />
              <span className="text-sm font-medium tracking-wide text-ink/70">
                The Solution
              </span>
            </div>
            <h2 className="text-balance text-4xl font-normal leading-[1.1] tracking-tight text-ink md:text-5xl">
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
              <p className="text-balance text-base leading-relaxed text-ink/60">
                Cortex works in three steps: store sovereign memory on Sui,
                coordinate shared and agentic workflows across it, and extract
                higher-order insight from everything you have already saved.
              </p>
            </Reveal>
          </div>

          <div className="grid min-h-auto grid-cols-1 items-start gap-8 lg:min-h-[400px] lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="group relative order-2 aspect-[4/3] w-full overflow-hidden rounded-[var(--r)] border border-ink/10 bg-ink/5 lg:order-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={STEPS[activeIndex].image}
                    alt={STEPS[activeIndex].title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-canvas/40 to-transparent" />
                </motion.div>
              </AnimatePresence>

              <div className="absolute bottom-4 left-4 right-4 flex h-1 gap-2">
                {STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    className="h-full flex-1 overflow-hidden bg-ink/10"
                  >
                    <div
                      className={cn(
                        "h-full bg-ink transition-all duration-500",
                        idx <= activeIndex ? "w-full" : "w-0",
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 flex flex-col gap-3 md:gap-4 lg:order-2">
              {STEPS.map((step, index) => (
                <motion.button
                  key={step.id}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "group relative w-full rounded-[var(--r)] p-4 text-left outline-none transition-all duration-300 md:p-6",
                    activeIndex === index
                      ? "border border-ink/30 bg-ink/[0.08]"
                      : "border border-transparent bg-transparent hover:bg-ink/[0.02]",
                  )}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div
                      className={cn(
                        "mt-1 shrink-0 rounded-[var(--r)] p-2 transition-colors duration-300",
                        activeIndex === index
                          ? "bg-ink text-canvas"
                          : "bg-ink/5 text-ink/40",
                      )}
                    >
                      {step.icon}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h3
                        className={cn(
                          "text-lg font-medium transition-colors duration-300 md:text-xl",
                          activeIndex === index ? "text-ink" : "text-ink/50",
                        )}
                      >
                        {step.title}
                      </h3>

                      <AnimatePresence>
                        {activeIndex === index && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden text-sm leading-relaxed text-ink/60 md:text-base"
                          >
                            {step.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div
                      className={cn(
                        "mt-1.5 shrink-0 transition-all duration-300",
                        activeIndex === index
                          ? "translate-x-0 opacity-100"
                          : "-translate-x-2 opacity-0",
                      )}
                    >
                      <ChevronRight className="h-5 w-5 text-ink/30" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex justify-center border-t border-ink/5 pt-12">
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-[var(--r)] bg-ink px-8 py-4 font-medium text-canvas transition-transform hover:scale-105 active:scale-95"
            >
              Get Started
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
