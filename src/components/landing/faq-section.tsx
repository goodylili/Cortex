"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Reveal } from "@/components/landing/reveal";
import { cn } from "@/lib/utils";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const HEADLINE = "Questions About Cortex";

const FAQS: FaqItem[] = [
  {
    id: "1",
    question: "What makes Cortex different from other note-taking apps?",
    answer:
      "Cortex is a memory layer, not just a note app. It ingests from any source, intelligently consolidates what matters, and integrates with every AI tool you use through MCP. Your memories are private by default, grounded in what you actually saved, not hallucinated.",
  },
  {
    id: "2",
    question: "Is my data really private?",
    answer:
      "Yes. In local-first mode, everything stays on your device—nothing leaves without your explicit consent. When you choose to share or go durable, content is encrypted with Seal before it ever touches external infrastructure. Your device is the security boundary.",
  },
  {
    id: "3",
    question: "How does Cortex work with other AI tools?",
    answer:
      "Cortex speaks MCP, the standard protocol for AI tool interoperability. Once you add something to Cortex, every AI tool you use—ChatGPT, Claude, your own agents, or custom tools—can recall it via the MCP server. No more copy-pasting context between tools.",
  },
  {
    id: "4",
    question: "What does consolidation actually do?",
    answer:
      "Consolidation is where Cortex quietly improves your memory over time. It merges duplicates, verifies facts, detects patterns, and gently prunes the noise. Memories you actively use stay strong; weak signals fade. Nothing is ever silently deleted.",
  },
  {
    id: "5",
    question: "Can I share memories with collaborators?",
    answer:
      "Yes. Encrypted sharing lets you send memories by recipient name, not by key. Content is sealed before it leaves your device; only the recipient can open it. Identity is scoped to each share, so you never accidentally expose your whole memory.",
  },
];

export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId(openId === id ? null : id);

  return (
    <section
      id="faq"
      className="w-full border-b border-ink/10 bg-canvas py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-6">
            <div className="flex w-fit items-center gap-3 rounded-[var(--r)] border border-ink/20 bg-ink/10 px-4 py-2">
              <div className="h-2.5 w-2.5 bg-ink" />
              <span className="text-sm font-medium tracking-wide text-ink/70">
                FAQ
              </span>
            </div>

            <h2 className="text-balance text-4xl font-normal leading-[1.1] tracking-tight text-ink md:text-5xl lg:text-6xl">
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
              <p className="max-w-md text-balance text-base leading-relaxed text-ink/60 md:text-lg">
                Get answers about how Cortex keeps, connects, and recalls your
                memory. Your privacy, your infrastructure, your terms.
              </p>
            </Reveal>
          </div>

          <div className="flex flex-col">
            {FAQS.map((faq, index) => (
              <div
                key={faq.id}
                className={cn(
                  "border-t border-ink/10",
                  index === FAQS.length - 1 && "border-b",
                )}
              >
                <button
                  onClick={() => toggle(faq.id)}
                  className="group flex w-full items-center justify-between gap-4 py-6 text-left"
                >
                  <span className="text-lg font-normal text-ink transition-colors group-hover:text-ink/80 md:text-xl">
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openId === faq.id ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown className="h-5 w-5 text-ink/50" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {openId === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-6 pr-12">
                        <p className="text-base leading-relaxed text-ink/60">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
