"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface StackItem {
  name: string;
  description: string;
  logo: string;
}

const STACK_ITEMS: StackItem[] = [
  {
    name: "Sui",
    description:
      "The base network that gives Cortex fast settlement, composable ownership, and identity-native coordination.",
    logo: "/brands/sui.svg",
  },
  {
    name: "Walrus",
    description:
      "Stores memory, files, and media as durable blobs so your context stays available beyond one device or one session.",
    logo: "/brands/walrus.png",
  },
  {
    name: "Seal",
    description:
      "Protects memory with programmable access control, so only the right users, agents, and workflows can decrypt it.",
    logo: "/brands/seal.svg",
  },
  {
    name: "MemWal",
    description:
      "Keeps recall fast and agent-friendly with a memory layer designed for retrieval, updates, and durable context sync.",
    logo: "/brands/memwal.svg",
  },
  {
    name: "SuiNS",
    description:
      "Turns addresses into readable names so sharing, discovery, and coordination feel native instead of wallet-shaped.",
    logo: "/brands/suins.png",
  },
];

const HEADLINE = "Powered by the Sui Stack";

function StackLogo({
  src,
  alt,
  active,
}: {
  src: string;
  alt: string;
  active: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      animate={active ? { scale: 1.04 } : { scale: 1 }}
      className="relative h-8 w-8"
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="32px"
        className={cn(
          "object-contain transition-all duration-300",
          active ? "opacity-100" : "opacity-90 group-hover:opacity-100",
        )}
      />
    </motion.div>
  );
}

export function SuiStackSection() {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  return (
    <section
      id="sui-stack"
      className="w-full border-b border-ink/10 bg-canvas py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col gap-6 md:mb-16"
        >
          <div className="flex w-fit items-center gap-3 rounded-[var(--r)] border border-ink/20 bg-ink/10 px-4 py-2">
            <div className="h-2.5 w-2.5 bg-ink" />
            <span className="text-sm font-medium tracking-wide text-ink/70">
              Infrastructure
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h2 className="max-w-4xl text-balance text-4xl font-normal leading-[1.05] tracking-tight text-ink md:text-5xl lg:text-6xl">
                {HEADLINE.split(" ").map((word, index) => (
                  <motion.span
                    key={word + index}
                    initial={{ filter: "blur(10px)", opacity: 0 }}
                    whileInView={{ filter: "blur(0px)", opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="mr-[0.25em] inline-block"
                  >
                    {word}
                  </motion.span>
                ))}
              </h2>
            </div>

            <p className="max-w-xl text-balance text-base leading-relaxed text-ink/60 md:text-lg lg:justify-self-end">
              Cortex is built on the Sui ecosystem end to end, combining
              execution, storage, encryption, memory infrastructure, and naming
              into one sovereign memory stack.
            </p>
          </div>
        </motion.div>

        <div
          className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-3"
          onMouseLeave={() => setActiveItem(null)}
        >
          {STACK_ITEMS.map((item, index) => {
            const isActive = activeItem === item.name;

            return (
              <motion.article
                key={item.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -4 }}
                onHoverStart={() => setActiveItem(item.name)}
                onFocus={() => setActiveItem(item.name)}
                onBlur={() => setActiveItem(null)}
                className={cn(
                  "group flex min-h-[260px] flex-col rounded-[var(--r)] border p-6 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                  "bg-ink/[0.03] text-ink hover:border-white hover:bg-white hover:text-black hover:shadow-[0_24px_80px_rgba(255,255,255,0.18)]",
                  isActive
                    ? "border-white bg-white text-black shadow-[0_24px_80px_rgba(255,255,255,0.18)]"
                    : "border-ink/10",
                )}
              >
                <div
                  className={cn(
                    "mb-8 flex h-14 w-14 items-center justify-center rounded-[var(--r)] border bg-white/95 p-2 transition-all duration-300",
                    isActive
                      ? "border-black/10 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
                      : "border-ink/10 group-hover:border-black/10 group-hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]",
                  )}
                >
                  <StackLogo
                    src={item.logo}
                    alt={`${item.name} logo`}
                    active={isActive}
                  />
                </div>

                <div className="mb-5">
                  <h3
                    className={cn(
                      "text-2xl font-medium tracking-tight transition-colors duration-300",
                      isActive
                        ? "text-black"
                        : "text-ink group-hover:text-black",
                    )}
                  >
                    {item.name}
                  </h3>
                </div>

                <p
                  className={cn(
                    "mt-auto text-sm leading-relaxed transition-colors duration-300",
                    isActive
                      ? "text-black/70"
                      : "text-ink/60 group-hover:text-black/70",
                  )}
                >
                  {item.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
