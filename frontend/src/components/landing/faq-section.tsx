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

const HEADLINE = "Questions About Sovereign Memory";

const FAQS: FaqItem[] = [
  {
    id: "1",
    question: "What makes Cortex different from other memory layers?",
    answer:
      "Cortex is a sovereign memory layer for uploaded intelligence, not a note-taking app. It is built on the Sui stack with Walrus for durable storage and Seal for encryption, then adds shared memory, prompt generation, agentic loops, multi-agent workflows, dreams, and an elastic brain that keeps memory useful over time.",
  },
  {
    id: "2",
    question: "How does sovereign memory stay private?",
    answer:
      "Yes. Cortex encrypts memory before it is stored or shared, and access stays scoped to you and the collaborators you authorize. Seal protects content and Sui-native identity controls who can read shared memory.",
  },
  {
    id: "3",
    question: "How does Cortex work with agents and AI tools?",
    answer:
      "Cortex speaks MCP, the standard protocol for AI tool interoperability. Once memory is in Cortex, your agents and external AI tools can query the same grounded context instead of re-uploading and re-explaining everything.",
  },
  {
    id: "4",
    question: "What are Agentic Loops and why do they matter?",
    answer:
      "Loops turn memory into action. Cortex can generate a workflow from your saved context, assign it to an agent, run iterative passes, and keep the whole cycle grounded in the same memory graph.",
  },
  {
    id: "5",
    question: "What is Cortex's elastic brain?",
    answer:
      "The elastic brain is Cortex's memory hygiene system. The codebase already runs consolidation sweeps that fold duplicates, promote durable memories, and prune redundant entries, so your memory graph keeps learning from use instead of bloating forever.",
  },
  {
    id: "6",
    question: "What are dreams inside Cortex?",
    answer:
      "Dreams are memory-derived insights. Cortex looks across what you have saved, connects weak signals, and surfaces higher-order synthesis so the system can tell you what is emerging, not just what is already obvious.",
  },
  {
    id: "7",
    question: "Can I share memory without exposing everything?",
    answer:
      "Yes. Encrypted sharing lets you send memories by recipient name, not by key. Content is sealed before delivery, only the intended recipient can open it, and each share stays scoped so you never expose your whole memory.",
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
                Get answers about how Cortex stores, shares, and activates
                sovereign memory across people, agents, and workflows. Your
                privacy, your infrastructure, your terms.
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
