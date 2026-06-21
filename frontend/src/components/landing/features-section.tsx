"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Network,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface FeatureItem {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
}

const HEADLINE = "Everything You Need to Remember";

const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.usecortexai.com";

const FEATURES: FeatureItem[] = [
  {
    id: "1",
    icon: <ShieldCheck className="h-5 w-5 text-canvas" />,
    title: "Sui-Native Sovereignty",
    description:
      "Cortex is built on Sui, Walrus, and Seal so your memory is durable, encrypted, and aligned with ownership instead of platform lock-in.",
  },
  {
    id: "2",
    icon: <Database className="h-5 w-5 text-canvas" />,
    title: "Shared Memory",
    description:
      "Create encrypted shared memory between people and agents. Cortex scopes access by identity so collaboration stays precise.",
  },
  {
    id: "3",
    icon: <WandSparkles className="h-5 w-5 text-canvas" />,
    title: "Prompt Generation",
    description:
      "Turn grounded memory into better prompts instantly, so every model and tool starts from your actual context instead of a blank box.",
  },
  {
    id: "4",
    icon: <Workflow className="h-5 w-5 text-canvas" />,
    title: "Loop Generation",
    description:
      "Generate loops directly from memory, then let Cortex run iterative research, planning, and review cycles over the same knowledge base.",
  },
  {
    id: "5",
    icon: <Network className="h-5 w-5 text-canvas" />,
    title: "Multi-Agent Interface",
    description:
      "Specialist agents can interface over one memory layer, hand off work, and stay grounded in shared context rather than isolated chats.",
  },
  {
    id: "6",
    icon: <Sparkles className="h-5 w-5 text-canvas" />,
    title: "Dreams",
    description:
      "Dreams synthesize patterns, weak signals, and long-horizon insight from memory so Cortex can surface what matters before you ask.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="w-full border-b border-ink/10 bg-canvas py-24"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 flex flex-col gap-6"
        >
          <div className="flex w-fit items-center gap-3 rounded-[var(--r)] border border-ink/20 bg-ink/10 px-4 py-2">
            <div className="h-2.5 w-2.5 bg-ink" />
            <span className="text-sm font-medium tracking-wide text-ink/70">
              Core Features
            </span>
          </div>
          <h2 className="max-w-[700px] text-balance text-4xl font-normal leading-[1.1] tracking-tight text-ink md:text-5xl lg:text-6xl">
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
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.id}
              variants={itemVariants}
              className="group flex flex-col"
            >
              <div className="mb-8">
                <div className="flex h-10 w-10 transform items-center justify-center rounded-[var(--r)] bg-gradient-to-b from-ink/80 to-ink/60 shadow-lg shadow-ink/20 transition-transform duration-300 group-hover:scale-110">
                  <div className="text-canvas">{feature.icon}</div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="font-sans text-xl font-medium tracking-tight text-ink">
                  {feature.title}
                </h4>
                <p className="text-balance font-sans text-base leading-relaxed text-ink/60">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button
            asChild
            size="lg"
            className="rounded-[var(--r)] bg-ink px-8 text-canvas hover:bg-ink/90"
          >
            <Link href="/app">Explore Full Features</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-[var(--r)] border-ink/20 bg-transparent px-8 text-ink hover:bg-ink/10 hover:text-ink"
          >
            <Link href={DOCS_URL}>View Documentation</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
