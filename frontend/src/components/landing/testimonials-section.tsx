"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface Testimonial {
  id: number;
  quote: string;
  author: string;
  role: string;
  avatar: string;
}

const HEADLINE = "What Users Say About Cortex.";
const VISIBLE_COUNT = 3;

const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    quote:
      "I spent hours every week searching across my notes and tools. Cortex changed everything—now I just ask and get the answer, grounded in what I actually saved. It's like having my own brain extended.",
    author: "Alex Chen",
    role: "AI Researcher",
    avatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=6B5B95",
  },
  {
    id: 2,
    quote:
      "The encrypted memory model was what sealed it for me. My context stays protected, durable, and mine to control. Finally, an AI tool that respects what I'm building.",
    author: "Jordan Martinez",
    role: "Product Builder",
    avatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=88498F",
  },
  {
    id: 3,
    quote:
      "Using Cortex with multiple AI tools has been transformative. I add something once, and every tool I use—ChatGPT, Claude, my own agents—can recall it. No more context-switching pain.",
    author: "Sam Patel",
    role: "AI Engineer",
    avatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily&backgroundColor=C55A7B",
  },
  {
    id: 4,
    quote:
      "The consolidation feature quietly cleans up my memory without me lifting a finger. Duplicates merge, patterns surface, weak signals fade—my thoughts get clearer over time.",
    author: "Casey Kim",
    role: "Researcher",
    avatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=David&backgroundColor=4A5899",
  },
  {
    id: 5,
    quote:
      "I was skeptical about AI forgetting context. Cortex proves that continuity matters—my work is better because my AI actually remembers what matters to me.",
    author: "Riley Thompson",
    role: "Founder",
    avatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Jennifer&backgroundColor=6B7280",
  },
  {
    id: 6,
    quote:
      "Encrypted sharing that just works. I sent research to a collaborator by name, they opened it securely, and our conversation stayed private and grounded in our actual work.",
    author: "Morgan Lee",
    role: "Academic",
    avatar:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Robert&backgroundColor=7C3AED",
  },
];

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () =>
    setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  const prev = () =>
    setCurrentIndex((prev) =>
      prev === 0 ? TESTIMONIALS.length - 1 : prev - 1,
    );

  const visible = TESTIMONIALS.slice(
    currentIndex,
    currentIndex + VISIBLE_COUNT,
  ).concat(
    TESTIMONIALS.slice(
      0,
      Math.max(0, currentIndex + VISIBLE_COUNT - TESTIMONIALS.length),
    ),
  );

  return (
    <section className="w-full border-b border-ink/10 bg-canvas py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <div className="mb-12 flex flex-col gap-6 md:mb-16">
          <div className="flex w-fit items-center gap-3 rounded-[var(--r)] border border-ink/20 bg-ink/10 px-4 py-2">
            <div className="h-2.5 w-2.5 bg-ink" />
            <span className="text-sm font-medium tracking-wide text-ink/70">
              Voices
            </span>
          </div>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center md:gap-8">
            <h2 className="text-balance text-3xl font-normal text-ink md:text-4xl lg:text-5xl">
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
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={prev}
                className="rounded-[var(--r)] border border-ink/10 bg-transparent p-2 text-ink transition-colors hover:bg-ink/5 md:p-3"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="rounded-[var(--r)] border border-ink/10 bg-transparent p-2 text-ink transition-colors hover:bg-ink/5 md:p-3"
                aria-label="Next testimonial"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className={`border-ink/10 p-6 md:p-8 ${
                index !== 2 ? "border-b md:border-r lg:border-b-0" : ""
              } border-b last:border-b-0 md:border-b-0`}
            >
              <div className="mb-6 text-4xl font-bold text-ink">&ldquo;</div>

              <p className="mb-8 min-h-[150px] text-sm leading-relaxed text-ink md:min-h-[200px] md:text-base">
                {testimonial.quote}
              </p>

              <div className="flex items-center gap-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.author}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-10 w-10 rounded-full object-cover md:h-12 md:w-12"
                />
                <div>
                  <div className="text-xs font-medium text-ink md:text-sm">
                    {testimonial.author}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-ink/50">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
