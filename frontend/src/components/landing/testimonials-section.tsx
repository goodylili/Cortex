"use client";

import { motion } from "framer-motion";

import { Reveal } from "@/components/landing/reveal";
import { MemoryMap } from "@/components/cortex/memory-map";
import { type Memory } from "@/lib/cortex/logic";

const HEADLINE = "See Cortex's Brain In Motion";
const NOW = Date.now();

const SAMPLE_MEMORIES: Memory[] = [
  {
    id: "ctx_1",
    text: "Cortex is decentralized sovereign elastic memory for uploaded intelligence across agents, teams, and applications.",
    tags: ["ideas", "work"],
    ts: NOW - 1000 * 60 * 18,
    createdAt: NOW - 1000 * 60 * 18,
    source: "Positioning workshop",
    kept: true,
    note: "Core landing thesis.",
  },
  {
    id: "ctx_2",
    text: "Walrus handles durable storage while Seal protects encrypted memory and selective sharing on the Sui stack.",
    tags: ["work", "reading"],
    ts: NOW - 1000 * 60 * 44,
    createdAt: NOW - 1000 * 60 * 44,
    source: "Architecture review",
    kept: true,
  },
  {
    id: "ctx_3",
    text: "Elastic brain behavior should consolidate duplicates, strengthen durable memories, and fade weak signals over time.",
    tags: ["ideas", "habits"],
    ts: NOW - 1000 * 60 * 9,
    createdAt: NOW - 1000 * 60 * 9,
    source: "Memory model pass",
    kept: true,
  },
  {
    id: "ctx_4",
    text: "Shared memory must let people and agents work over the same graph without exposing the entire namespace.",
    tags: ["people", "work"],
    ts: NOW - 1000 * 60 * 67,
    createdAt: NOW - 1000 * 60 * 67,
    source: "Sharing design notes",
    kept: true,
    shared: true,
    sharedBy: "design@cortex.sui",
  },
  {
    id: "ctx_5",
    text: "Agentic Loops should turn saved context into an executable workflow with iterative passes grounded in memory.",
    tags: ["work", "ideas"],
    ts: NOW - 1000 * 60 * 25,
    createdAt: NOW - 1000 * 60 * 25,
    source: "Agentic Loops strategy",
    kept: true,
  },
  {
    id: "ctx_6",
    text: "Dreams should surface higher-order synthesis from the graph so Cortex can reveal what is emerging, not just what was asked.",
    tags: ["ideas", "reading"],
    ts: NOW - 1000 * 60 * 13,
    createdAt: NOW - 1000 * 60 * 13,
    source: "Dreams concept note",
    kept: true,
  },
  {
    id: "ctx_7",
    text: "Prompt generation should pull from memory automatically so users stop rebuilding context for every model and every workflow.",
    tags: ["work", "note"],
    ts: NOW - 1000 * 60 * 54,
    createdAt: NOW - 1000 * 60 * 54,
    source: "Prompting requirements",
  },
  {
    id: "ctx_8",
    text: "MCP interoperability matters because Cortex memory needs to travel across tools instead of staying trapped in a single interface.",
    tags: ["reading", "work"],
    ts: NOW - 1000 * 60 * 31,
    createdAt: NOW - 1000 * 60 * 31,
    source: "MCP ecosystem review",
    kept: true,
  },
  {
    id: "ctx_9",
    text: "The landing page should let visitors inspect a real Cortex-style memory graph instead of only reading claims about the elastic brain.",
    tags: ["note", "ideas"],
    ts: NOW - 1000 * 60 * 6,
    createdAt: NOW - 1000 * 60 * 6,
    source: "Growth sync",
    kept: true,
  },
  {
    id: "ctx_10",
    text: "Example Cortex docs should show memory ingestion, graph retrieval, shared delivery, and agent loops with the same design language as the app.",
    tags: ["reading", "note"],
    ts: NOW - 1000 * 60 * 88,
    createdAt: NOW - 1000 * 60 * 88,
    source: "Documentation backlog",
  },
];

export function TestimonialsSection() {
  return (
    <section className="w-full border-b border-ink/10 bg-canvas py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <div className="mb-12 flex flex-col gap-6 md:mb-16">
          <div className="flex w-fit items-center gap-3 rounded-[var(--r)] border border-ink/20 bg-ink/10 px-4 py-2">
            <div className="h-2.5 w-2.5 bg-ink" />
            <span className="text-sm font-medium tracking-wide text-ink/70">
              Elastic Brain
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h2 className="max-w-5xl text-balance text-3xl font-normal text-ink md:text-4xl lg:text-5xl">
                {HEADLINE.split(" ").map((word, index) => (
                  <motion.span
                    key={index}
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

            <Reveal>
              <p className="max-w-xl text-balance text-base leading-relaxed text-ink/60 md:text-lg lg:justify-self-end">
                This is the actual Cortex brain graph style, seeded with sample
                memories about the Cortex project. Drag it, zoom it, search it,
                open nodes, and inspect how the graph connects ideas inside an
                elastic memory system.
              </p>
            </Reveal>
          </div>
        </div>

        <Reveal className="landing-brain-shell overflow-hidden rounded-[var(--r)] border border-ink/10 bg-[#050505]">
          <div className="relative h-[760px] w-full md:h-[860px] lg:h-[940px]">
            <MemoryMap
              memories={SAMPLE_MEMORIES}
              onOpen={() => {}}
              theme="dark"
            />
          </div>
        </Reveal>
      </div>

      <style jsx global>{`
        .landing-brain-shell {
          --paper: #000000;
          --ink: #ffffff;
          --muted: #a1a1a1;
          --faint: #6e6e6e;
          --sans: "Roboto", sans-serif;
          --mono: "Roboto", sans-serif;
          --head: "Expose", sans-serif;
        }

        .landing-brain-shell .mesh {
          position: absolute;
          inset: 0;
          overflow: hidden;
          --mesh-sans: var(--sans);
          --mesh-mono: var(--mono);
          --mesh-head: var(--head);
          background: var(--paper);
          color: var(--ink);
          font-family: var(--sans);
          --ink: #ffffff;
          --mut: #a1a1a1;
          --fnt: #6e6e6e;
          --macc: #ffffff;
          --macc-ink: #ffffff;
          --macc-soft: rgba(255, 255, 255, 0.1);
          --mline: rgba(255, 255, 255, 0.07);
          --mline2: rgba(255, 255, 255, 0.14);
          --medge: rgba(255, 255, 255, 0.18);
          --glass: rgba(10, 10, 10, 0.72);
          --glass2: rgba(12, 12, 14, 0.92);
          --mveil: rgba(255, 255, 255, 0.06);
          --mleg: rgba(10, 10, 10, 0.94);
        }

        .landing-brain-shell .mesh-canvas {
          display: block;
          width: 100%;
          height: 100%;
          cursor: grab;
        }

        .landing-brain-shell .mesh-canvas.grabbing {
          cursor: grabbing;
        }

        .landing-brain-shell .mesh-canvas.pointer {
          cursor: pointer;
        }

        .landing-brain-shell .mesh .panel {
          background: var(--glass2);
          border: 1px solid var(--mline2);
          border-top-color: var(--medge);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(22px) saturate(140%);
          -webkit-backdrop-filter: blur(22px) saturate(140%);
        }

        .landing-brain-shell .mesh-legends {
          position: absolute;
          left: calc(100% + 12px);
          bottom: 0;
          width: 208px;
          opacity: 0;
          visibility: hidden;
          transform: translateX(-6px);
          pointer-events: none;
          transition:
            opacity 0.2s ease,
            transform 0.2s ease,
            visibility 0.2s;
        }

        .landing-brain-shell .mesh-legends.open {
          opacity: 1;
          visibility: visible;
          transform: none;
          pointer-events: auto;
        }

        .landing-brain-shell .mctl {
          position: absolute;
          top: 50%;
          right: 18px;
          transform: translateY(-50%);
          z-index: 9;
          font-family: var(--mesh-sans);
        }

        .landing-brain-shell .mctl-bar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 8px;
          max-height: calc(100vh - 170px);
          overflow-y: auto;
          scrollbar-width: none;
          border-radius: var(--r);
          background: var(--glass2);
          border: 1px solid var(--mline2);
          border-top-color: var(--medge);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(22px) saturate(140%);
          -webkit-backdrop-filter: blur(22px) saturate(140%);
        }

        .landing-brain-shell .mctl-bar::-webkit-scrollbar {
          display: none;
        }

        .landing-brain-shell .mctl-ic {
          width: 40px;
          height: 40px;
          border-radius: var(--r);
          display: grid;
          place-items: center;
          color: var(--mut);
          cursor: pointer;
          transition:
            color 0.15s,
            background 0.15s;
        }

        .landing-brain-shell .mctl-ic:hover {
          color: var(--ink);
          background: var(--mveil);
        }

        .landing-brain-shell .mctl-ic.on {
          color: var(--paper);
          background: var(--ink);
        }

        .landing-brain-shell .mctl-ic svg {
          width: 19px;
          height: 19px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .landing-brain-shell .mctl-z {
          font-family: var(--mesh-mono);
          font-size: 10.5px;
          color: var(--mut);
          line-height: 1;
          user-select: none;
        }

        .landing-brain-shell .mctl-div {
          width: 22px;
          height: 1px;
          background: var(--mline2);
          margin: 3px 0;
        }

        .landing-brain-shell .mctl-search {
          position: absolute;
          right: calc(100% + 12px);
          display: flex;
          align-items: center;
          gap: 8px;
          width: 240px;
          height: 40px;
          padding: 0 14px;
          border-radius: var(--r);
          background: var(--glass2);
          border: 1px solid var(--mline2);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(22px) saturate(140%);
          -webkit-backdrop-filter: blur(22px) saturate(140%);
          opacity: 0;
          visibility: hidden;
          transform: translateX(6px);
          transition:
            opacity 0.18s ease,
            transform 0.18s ease,
            visibility 0.18s;
        }

        .landing-brain-shell .mctl-search.on {
          opacity: 1;
          visibility: visible;
          transform: none;
        }

        .landing-brain-shell .mctl-search svg {
          width: 15px;
          height: 15px;
          fill: none;
          stroke: var(--mut);
          stroke-width: 1.8;
          stroke-linecap: round;
          flex: none;
        }

        .landing-brain-shell .mctl-search input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: 0;
          outline: 0;
          color: var(--ink);
          font-size: 13.5px;
          font-family: var(--mesh-sans);
        }

        .landing-brain-shell .mctl-search input::placeholder {
          color: var(--fnt);
        }

        .landing-brain-shell .mctl-search .sc {
          font-family: var(--mesh-mono);
          font-size: 11px;
          color: var(--mut);
          flex: none;
        }

        .landing-brain-shell .mctl-mini {
          position: absolute;
          right: 16px;
          bottom: 16px;
          width: 168px;
          height: 120px;
          border-radius: var(--r);
          background: var(--glass2);
          border: 1px solid var(--mline2);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(18px) saturate(140%);
          -webkit-backdrop-filter: blur(18px) saturate(140%);
          z-index: 9;
          opacity: 0;
          visibility: hidden;
          transform: translateY(8px);
          transition:
            opacity 0.2s ease,
            transform 0.2s ease,
            visibility 0.2s;
        }

        .landing-brain-shell .mctl-mini.on {
          opacity: 1;
          visibility: visible;
          transform: none;
        }

        .landing-brain-shell .mesh .leg {
          border-radius: var(--r);
          padding: 14px;
          min-width: 184px;
          background: var(--mleg);
          border: 1px solid var(--mline2);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
        }

        .landing-brain-shell .mesh .leg .lh {
          font-family: var(--mesh-sans);
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--fnt);
          margin-bottom: 9px;
        }

        .landing-brain-shell .mesh .li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 8px;
          border-radius: var(--r);
          font-size: 12.5px;
          color: var(--mut);
          cursor: pointer;
          transition:
            background 0.16s,
            color 0.16s,
            opacity 0.16s;
          user-select: none;
        }

        .landing-brain-shell .mesh .li:hover,
        .landing-brain-shell .mesh .li.on {
          background: var(--mveil);
          color: var(--ink);
        }

        .landing-brain-shell .mesh .li.muted {
          opacity: 0.4;
        }

        .landing-brain-shell .mesh .li.muted .dot {
          box-shadow: none;
          opacity: 0.45;
        }

        .landing-brain-shell .mesh .li.muted .nm {
          text-decoration: line-through;
          text-decoration-thickness: 1px;
        }

        .landing-brain-shell .mesh .li .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex: none;
          box-shadow: 0 0 7px var(--bc);
        }

        .landing-brain-shell .mesh .li .nm {
          flex: 1;
          text-transform: capitalize;
        }

        .landing-brain-shell .mesh .li .ct {
          font-family: var(--mesh-mono);
          font-size: 11px;
          color: var(--fnt);
        }

        .landing-brain-shell .mesh .leg .ldiv {
          height: 1px;
          background: var(--mline);
          margin: 9px 0;
        }

        .landing-brain-shell .mesh .metric {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 4px 6px;
          font-family: var(--mesh-sans);
          font-size: 12.5px;
          color: var(--mut);
        }

        .landing-brain-shell .mesh .metric .ic {
          color: var(--fnt);
        }

        .landing-brain-shell .mesh .metric .pill {
          margin-left: auto;
          background: var(--mveil);
          border-radius: var(--r);
          padding: 2px 7px;
          font-family: var(--mesh-mono);
          font-size: 10.5px;
          color: var(--ink);
        }

        .landing-brain-shell .mesh .peek {
          position: absolute;
          pointer-events: none;
          z-index: 9;
          max-width: 270px;
          border-radius: var(--r);
          padding: 12px 14px;
          opacity: 0;
          transform: translateY(6px) scale(0.98);
          transition:
            opacity 0.16s,
            transform 0.16s;
          box-shadow: 0 14px 44px rgba(0, 0, 0, 0.6);
        }

        .landing-brain-shell .mesh .peek.on {
          opacity: 1;
          transform: none;
        }

        .landing-brain-shell .mesh .peek .tags {
          display: flex;
          gap: 7px;
          margin-bottom: 8px;
        }

        .landing-brain-shell .mesh .peek .tgg {
          font-family: var(--mesh-sans);
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .landing-brain-shell .mesh .peek .tgg .d {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .landing-brain-shell .mesh .peek .txt {
          font-size: 13px;
          line-height: 1.46;
        }

        .landing-brain-shell .mesh .peek .meta {
          font-family: var(--mesh-mono);
          font-size: 10px;
          color: var(--fnt);
          margin-top: 9px;
        }

        .landing-brain-shell .mesh-card {
          position: absolute;
          top: 16px;
          right: 16px;
          width: min(366px, 92vw);
          z-index: 12;
          border-radius: var(--r);
          overflow: hidden;
          opacity: 0;
          transform: translateX(20px) scale(0.98);
          pointer-events: none;
          transition:
            opacity 0.32s,
            transform 0.32s;
          box-shadow: -20px 30px 80px rgba(0, 0, 0, 0.55);
        }

        .landing-brain-shell .mesh-card.on {
          opacity: 1;
          transform: none;
          pointer-events: auto;
        }

        .landing-brain-shell .mesh .ch {
          padding: 18px 18px 16px;
          border-bottom: 1px solid var(--mline);
        }

        .landing-brain-shell .mesh .ch .eyebrow {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .landing-brain-shell .mesh .ch .eyebrow .cat {
          font-family: var(--mesh-sans);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--mut);
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .landing-brain-shell .mesh .ch .eyebrow .cat .d {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .landing-brain-shell .mesh .ch .x {
          cursor: pointer;
          color: var(--fnt);
          width: 24px;
          height: 24px;
          border-radius: var(--r);
          display: grid;
          place-items: center;
        }

        .landing-brain-shell .mesh .ch .x:hover {
          color: var(--ink);
          background: var(--mveil);
        }

        .landing-brain-shell .mesh .ch .ttl {
          font-family: var(--mesh-head);
          font-size: 18.5px;
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.34;
          margin-top: 11px;
          color: var(--ink);
        }

        .landing-brain-shell .mesh .ch .badges {
          display: flex;
          gap: 8px;
          margin-top: 13px;
          align-items: center;
        }

        .landing-brain-shell .mesh .badge2 {
          font-family: var(--mesh-sans);
          font-size: 11px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: var(--r);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .landing-brain-shell .mesh .badge2.sealed {
          color: #c8c8c8;
          background: rgba(127, 208, 160, 0.12);
          border: 1px solid rgba(127, 208, 160, 0.32);
        }

        .landing-brain-shell .mesh .badge2.sealed .d {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #c8c8c8;
          box-shadow: 0 0 7px #c8c8c8;
        }

        .landing-brain-shell .mesh .badge2.plain {
          color: var(--mut);
          border: 1px solid var(--mline2);
        }

        .landing-brain-shell .mesh .badge2.shared {
          color: var(--ink);
          background: var(--mveil);
          border: 1px solid var(--medge);
        }

        .landing-brain-shell .mesh .badge2.shared .d {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        .landing-brain-shell .mesh .ch .src {
          font-family: var(--mesh-mono);
          font-size: 10.5px;
          color: var(--fnt);
          margin-left: auto;
        }

        .landing-brain-shell .mesh .cb {
          padding: 16px 18px;
        }

        .landing-brain-shell .mesh .feel {
          border-radius: var(--r);
          padding: 14px;
          border: 1px solid var(--mline);
          position: relative;
          overflow: hidden;
        }

        .landing-brain-shell .mesh .feel .lab,
        .landing-brain-shell .mesh .analysis .ah2,
        .landing-brain-shell .mesh .tile .l {
          font-family: var(--mesh-sans);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--fnt);
        }

        .landing-brain-shell .mesh .feel .lab {
          font-weight: 600;
        }

        .landing-brain-shell .mesh .feel .big {
          display: flex;
          align-items: baseline;
          gap: 9px;
          margin-top: 6px;
        }

        .landing-brain-shell .mesh .feel .big .e {
          font-family: var(--mesh-head);
          font-size: 25px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .landing-brain-shell .mesh .feel .big .sub {
          font-family: var(--mesh-mono);
          font-size: 10px;
          color: var(--mut);
        }

        .landing-brain-shell .mesh .feel .bars {
          position: absolute;
          right: 12px;
          bottom: 12px;
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 32px;
        }

        .landing-brain-shell .mesh .feel .bars i {
          width: 3px;
          border-radius: var(--r);
          display: block;
        }

        .landing-brain-shell .mesh .tiles {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 13px;
        }

        .landing-brain-shell .mesh .tile {
          border: 1px solid var(--mline);
          border-radius: var(--r);
          padding: 12px;
        }

        .landing-brain-shell .mesh .tile .n {
          font-family: var(--mesh-head);
          font-size: 19px;
          font-weight: 600;
        }

        .landing-brain-shell .mesh .analysis {
          margin-top: 16px;
        }

        .landing-brain-shell .mesh .analysis .ah2 {
          font-weight: 600;
          margin-bottom: 11px;
        }

        .landing-brain-shell .mesh .rel-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 0;
          border-bottom: 1px solid var(--mline);
          font-family: var(--mesh-sans);
          font-size: 12.5px;
          color: var(--mut);
          cursor: pointer;
          transition: color 0.15s;
        }

        .landing-brain-shell .mesh .rel-item:last-child {
          border-bottom: 0;
        }

        .landing-brain-shell .mesh .rel-item:hover {
          color: var(--ink);
        }

        .landing-brain-shell .mesh .rel-item .d {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: none;
        }

        .landing-brain-shell .mesh .rel-item .t {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .landing-brain-shell .mesh .rel-item .lk {
          color: var(--fnt);
          flex: none;
          font-family: var(--mesh-mono);
          font-size: 10.5px;
        }

        .landing-brain-shell .mesh .cb .acts {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .landing-brain-shell .mesh .act-btn {
          flex: 1;
          font-family: var(--mesh-sans);
          font-size: 12.5px;
          color: var(--mut);
          border: 1px solid var(--mline2);
          background: var(--mveil);
          border-radius: var(--r);
          padding: 9px 0;
          cursor: pointer;
          transition: all 0.16s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .landing-brain-shell .mesh .act-btn:hover {
          color: var(--ink);
          border-color: var(--medge);
          background: var(--mveil);
        }

        .landing-brain-shell .mesh .act-btn.ok {
          color: #c8c8c8;
          border-color: rgba(127, 208, 160, 0.42);
        }

        .landing-brain-shell .mesh .act-btn.on {
          color: var(--ink);
          border-color: var(--mline2);
          background: var(--mveil);
        }

        .landing-brain-shell .mesh .act-btn.primary {
          color: var(--paper);
          border-color: var(--ink);
          background: var(--ink);
        }

        .landing-brain-shell .mesh .act-btn.primary:hover {
          opacity: 0.9;
          color: var(--paper);
          background: var(--ink);
        }

        .landing-brain-shell .mesh .cb .acts.nav {
          margin-top: 8px;
        }

        .landing-brain-shell .mesh .spin {
          width: 11px;
          height: 11px;
          border: 1.5px solid var(--mline2);
          border-top-color: var(--ink);
          border-radius: 50%;
          display: inline-block;
          animation: landing-mesh-spin 0.7s linear infinite;
        }

        @keyframes landing-mesh-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 980px) {
          .landing-brain-shell .mesh-card {
            left: 12px;
            right: 12px;
            width: auto;
          }

          .landing-brain-shell .mctl-mini {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
