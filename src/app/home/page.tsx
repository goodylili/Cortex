import Image from "next/image";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Logo } from "@/components/logo";
import { Constellation } from "@/components/landing/constellation";
import { Reveal } from "@/components/landing/reveal";

const serif = "'Expose', serif";
const VIOLET = "#7C5CD6";
const GOLD = "#FFB829";

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Access", href: "#access" },
  { label: "FAQ", href: "#faq" },
];

const BUILT_ON = ["Sui", "Walrus", "Seal", "MemWal", "MCP", "Privy"];

const STEPS = [
  {
    n: "01",
    title: "Keep",
    body: "Hand Cortex a thought, a file, a note, a link. It reads what you give it and keeps only what's worth holding onto — no folders to tend, no tags to invent.",
  },
  {
    n: "02",
    title: "Connect",
    body: "It quietly links what belongs together, tidies repeats, and draws the constellation of your memory — the map only you could have made.",
  },
  {
    n: "03",
    title: "Recall",
    body: "Ask in plain words, from any tool you already use. Cortex answers from what you actually saved — grounded, private, and yours alone.",
  },
];

const FEATURES = [
  {
    title: "Memory that outlives the chat",
    body: "Context persists beyond a single session, tool, or model. Switch anything — your memory stays.",
    icon: (
      <>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 7.5 V12 L15 14" />
      </>
    ),
  },
  {
    title: "One brain behind every agent",
    body: "Connect Cortex over MCP and every tool shares the same memory. What you tell one, the others know.",
    icon: (
      <>
        <circle cx="6" cy="12" r="2.3" />
        <circle cx="18" cy="6" r="2.3" />
        <circle cx="18" cy="18" r="2.3" />
        <path d="M8 11 L16 7 M8 13 L16 17" />
      </>
    ),
  },
  {
    title: "Yours, on your device",
    body: "Local-first by default. Nothing leaves your machine unless you choose to make it durable or shared.",
    icon: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10 V7 a4 4 0 0 1 8 0 V10" />
      </>
    ),
  },
  {
    title: "Shared, sealed, by name",
    body: "Send a memory to someone by their handle. It's encrypted before it leaves you, and only they can open it.",
    icon: (
      <>
        <path d="M4 7 L12 13 L20 7" />
        <rect x="4" y="6" width="16" height="12" rx="2" />
      </>
    ),
  },
  {
    title: "It gets sharper over time",
    body: "Cortex reflects in the quiet — merging duplicates, correcting stale facts, easing the rest gently into the background.",
    icon: (
      <>
        <path d="M12 4 v3 M12 17 v3 M4 12 h3 M17 12 h3" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),
  },
  {
    title: "Durable, and inspectable",
    body: "Artifacts live on storage you control. Your state is something you can see and hold, not a hidden black box.",
    icon: (
      <>
        <path d="M5 7 C5 5 19 5 19 7 V17 C19 19 5 19 5 17 Z" />
        <path d="M5 7 C5 9 19 9 19 7 M5 12 C5 14 19 14 19 12" />
      </>
    ),
  },
];

const INCLUDED = [
  "Keep notes, files, thoughts and links",
  "Recall in plain language, grounded in what you saved",
  "Connect over MCP to the AI tools you already use",
  "Local-first storage — nothing leaves your device by default",
  "Self-improving memory: merges, corrects, and prunes",
  "Pause anytime; nothing is ever quietly deleted",
];

const FAQ = [
  {
    q: "What is Cortex?",
    a: "Cortex is a calm, private place for everything worth remembering. Keep notes, files and thoughts, and Cortex quietly makes sense of them — tidying repeats, surfacing patterns, and answering questions grounded only in what you've actually saved.",
  },
  {
    q: "Is my memory private?",
    a: "Yes, completely. Your memory is yours alone. Cortex is local-first, so what you keep stays with you. Anything you choose to make durable or share is encrypted before it leaves your device, and nothing is ever deleted behind your back.",
  },
  {
    q: "Does it work with my AI tools?",
    a: "Yes. Cortex speaks MCP, so the agents and assistants you already use can read and write the same memory. Tell one tool something, and the others can recall it — no copy-pasting context between sessions.",
  },
  {
    q: "How does it remember over time?",
    a: "Memories you use stay strong; the rest gently ease toward the background instead of vanishing. Cortex reflects in the quiet — merging duplicates and correcting stale facts — so looking back feels clearer, not heavier.",
  },
];

export default function Home() {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-black text-white antialiased selection:bg-[#7C5CD6]/30"
      style={{ fontFamily: "'Supreme', system-ui, sans-serif" }}
    >
      {/* ───────── Nav ───────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <Logo variant="white" />
            <span
              className="text-[19px] font-medium tracking-[-0.01em]"
              style={{ fontFamily: serif }}
            >
              Cortex
            </span>
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="text-[14px] tracking-[0.02em] text-[#9a9a9a] transition-colors duration-200 hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <Link
            href="/"
            className="rounded-full bg-[#7C5CD6] px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-opacity duration-200 hover:opacity-90"
          >
            Launch app
          </Link>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <Constellation variant="brain" />
        </div>

        <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1200px] items-center px-6 py-24">
          <div className="max-w-[36rem]">
            <Reveal className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7C5CD6]/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7C5CD6]" />
              </span>
              <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-white/75">
                Early access · local-first
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1
                className="text-[clamp(2.9rem,8vw,7rem)] font-normal leading-[0.92] tracking-[-0.035em] text-white"
                style={{ fontFamily: serif }}
              >
                You live it.
                <br />
                Cortex{" "}
                <span className="italic" style={{ color: VIOLET }}>
                  remembers.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-8 max-w-[31rem] text-[17px] leading-[1.6] tracking-[0.01em] text-white/65">
                A calm, private home for everything worth remembering — your
                notes, files and thoughts, quietly made sense of over time, and
                ready for every AI tool you use. Yours alone.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/"
                  className="rounded-full bg-[#7C5CD6] px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-opacity duration-200 hover:opacity-90"
                >
                  Launch app
                </Link>
                <a
                  href="#how"
                  className="rounded-full border border-[#FFB829]/55 px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#FFB829] transition-colors duration-200 hover:bg-[#FFB829]/10"
                >
                  See how it works
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <p className="mt-8 text-[13px] leading-[1.6] tracking-[0.01em] text-white/40">
                No account needed to start. Your data never leaves your device
                unless you say so.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────── Built on ───────── */}
      <section className="border-y border-white/[0.06] py-14">
        <div className="mx-auto max-w-[1200px] px-6">
          <Reveal>
            <p className="mb-9 text-center text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
              The memory layer for AI, built on open infrastructure
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="cortex-marquee overflow-hidden">
              <div className="cortex-marquee-track">
                {[...BUILT_ON, ...BUILT_ON].map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="mx-10 shrink-0 text-[26px] font-medium tracking-[-0.01em] text-white/30"
                    style={{ fontFamily: serif }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── Manifesto pull-quote ───────── */}
      <section className="py-[120px]">
        <div className="mx-auto max-w-[1000px] px-6 text-center">
          <Reveal>
            <p
              className="text-[clamp(1.9rem,4.2vw,3.2rem)] font-normal leading-[1.18] tracking-[-0.02em] text-white/85"
              style={{ fontFamily: serif }}
            >
              We carry more than we can hold in mind. Cortex remembers the rest
              —{" "}
              <span className="italic" style={{ color: VIOLET }}>
                gently, and only for you.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="how" className="relative overflow-hidden py-[120px]">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          <Constellation variant="drift" density={0.55} />
        </div>

        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto max-w-[640px] text-center">
            <Reveal>
              <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
                How it works
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.03em]"
                style={{ fontFamily: serif }}
              >
                Tell it once.{" "}
                <span className="italic" style={{ color: VIOLET }}>
                  Find it forever.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-7 max-w-[54ch] text-[17px] leading-[1.6] tracking-[0.01em] text-white/65">
                Three quiet steps, no upkeep. Give Cortex something worth
                keeping, and looking back takes care of itself.
              </p>
            </Reveal>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="h-full rounded-[24px] border border-white/10 p-7 transition-colors duration-200 hover:border-white/25">
                  <span
                    className="text-[15px] font-medium tracking-[0.04em] text-[#7C5CD6]"
                    style={{ fontFamily: serif }}
                  >
                    {s.n}
                  </span>
                  <h3
                    className="mt-6 text-[26px] font-medium tracking-[-0.01em]"
                    style={{ fontFamily: serif }}
                  >
                    {s.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.6] tracking-[0.01em] text-[#bdbdbd]">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Features ───────── */}
      <section id="features" className="py-[60px]">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto mb-14 max-w-[640px] text-center">
            <Reveal>
              <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
                What you get
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.03em]"
                style={{ fontFamily: serif }}
              >
                Durable, private{" "}
                <span className="italic" style={{ color: VIOLET }}>
                  & yours.
                </span>
              </h2>
            </Reveal>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <div className="h-full rounded-[24px] border border-white/10 p-6 transition-colors duration-200 hover:border-white/25">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={VIOLET}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {f.icon}
                  </svg>
                  <h3
                    className="mt-7 text-[21px] font-medium leading-[1.2] tracking-[-0.01em]"
                    style={{ fontFamily: serif }}
                  >
                    {f.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.6] tracking-[0.01em] text-[#bdbdbd]">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Showcase ───────── */}
      <section className="py-[120px]">
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <Reveal>
            <h2
              className="mx-auto max-w-[16ch] text-[clamp(2.25rem,5.5vw,4rem)] font-normal leading-[1.02] tracking-[-0.03em]"
              style={{ fontFamily: serif }}
            >
              One brain behind{" "}
              <span className="italic" style={{ color: VIOLET }}>
                every agent.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-7 max-w-[58ch] text-[17px] leading-[1.6] tracking-[0.01em] text-white/65">
              See your memory take shape — a living map of what you’ve kept and
              how it connects, the same context every tool can reach.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mx-auto mt-14 max-w-[960px] overflow-hidden rounded-[24px] border border-white/10">
              <Image
                src="/cortex-app.png"
                alt="Cortex memory map"
                width={1714}
                height={1118}
                className="h-auto w-full"
                priority={false}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── Access ───────── */}
      <section id="access" className="py-[60px]">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto mb-14 max-w-[640px] text-center">
            <Reveal>
              <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
                Getting in
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.03em]"
                style={{ fontFamily: serif }}
              >
                Start free.{" "}
                <span className="italic" style={{ color: VIOLET }}>
                  Stay local.
                </span>
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mx-auto mt-7 max-w-[52ch] text-[17px] leading-[1.6] tracking-[0.01em] text-white/65">
                One simple way in. Open the app and start keeping — turn on
                durable, encrypted storage whenever you’re ready.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <div className="mx-auto max-w-[680px] overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.02]">
              <div className="border-b border-white/[0.08] p-8 sm:p-10">
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-[40px] font-medium leading-none tracking-[-0.02em]"
                    style={{ fontFamily: serif }}
                  >
                    Free
                  </span>
                  <span className="text-[14px] tracking-[0.01em] text-white/55">
                    during early access
                  </span>
                </div>
                <p className="mt-3 text-[15px] leading-[1.6] text-[#bdbdbd]">
                  Everything you need to keep, connect and recall — running
                  local-first on your own device.
                </p>
              </div>

              <ul className="grid gap-x-8 gap-y-4 p-8 sm:grid-cols-2 sm:p-10">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={GOLD}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 shrink-0"
                    >
                      <path d="M5 12.5 L10 17 L19 6.5" />
                    </svg>
                    <span className="text-[14.5px] leading-[1.5] tracking-[0.01em] text-white/80">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] bg-white/[0.015] px-8 py-5 sm:px-10">
                <div>
                  <p className="text-[14px] font-medium tracking-[0.01em] text-white/85">
                    Live durable storage
                  </p>
                  <p className="text-[13px] leading-[1.5] text-white/45">
                    Optional · Walrus + Seal, on infrastructure you control
                  </p>
                </div>
                <span
                  className="text-[14px] tracking-[0.02em] text-[#FFB829]"
                  style={{ fontFamily: serif }}
                >
                  Bring your own
                </span>
              </div>

              <div className="flex flex-col gap-3 p-8 sm:flex-row sm:p-10">
                <Link
                  href="/"
                  className="flex-1 rounded-full bg-[#7C5CD6] px-6 py-3.5 text-center text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-opacity duration-200 hover:opacity-90"
                >
                  Launch app
                </Link>
                <a
                  href="#how"
                  className="flex-1 rounded-full border border-white/15 px-6 py-3.5 text-center text-[12px] font-medium uppercase tracking-[0.08em] text-white/85 transition-colors duration-200 hover:border-white/35"
                >
                  See how it works
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── Built in the open ───────── */}
      <section className="py-[60px]">
        <div className="mx-auto max-w-[1200px] px-6">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-8 rounded-[28px] border border-white/10 bg-white/[0.02] p-9 sm:p-12 md:flex-row md:items-center">
              <div className="max-w-[34rem]">
                <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
                  Built in the open
                </p>
                <h3
                  className="text-[clamp(1.7rem,3.2vw,2.4rem)] font-normal leading-[1.1] tracking-[-0.02em]"
                  style={{ fontFamily: serif }}
                >
                  Inspectable state, not a black box.
                </h3>
                <p className="mt-4 text-[15px] leading-[1.6] tracking-[0.01em] text-[#bdbdbd]">
                  Cortex keeps your memory as something you can see and hold —
                  open infrastructure, your keys, your storage.
                </p>
              </div>
              <Link
                href="/"
                className="shrink-0 rounded-full border border-[#FFB829]/55 px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#FFB829] transition-colors duration-200 hover:bg-[#FFB829]/10"
              >
                Open the app
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="py-[120px]">
        <div className="mx-auto max-w-[760px] px-6">
          <Reveal>
            <p className="mb-6 text-center text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
              Questions
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="mb-12 text-center text-[clamp(2rem,4.5vw,3rem)] font-normal tracking-[-0.03em]"
              style={{ fontFamily: serif }}
            >
              Frequently asked
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <Accordion type="single" collapsible className="w-full">
              {FAQ.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-b border-white/10"
                >
                  <AccordionTrigger className="py-6 text-[18px] font-normal tracking-[0.01em] text-white hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 text-[15px] leading-[1.65] tracking-[0.01em] text-[#bdbdbd]">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* ───────── Closing CTA ───────── */}
      <section className="relative overflow-hidden py-[140px]">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-80">
          <Constellation variant="drift" density={0.7} />
        </div>
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <Reveal>
            <h2
              className="mx-auto max-w-[18ch] text-[clamp(2.5rem,6.5vw,5.5rem)] font-normal leading-[0.95] tracking-[-0.035em]"
              style={{ fontFamily: serif }}
            >
              Your memory has the answer.
              <br />
              <span className="italic" style={{ color: VIOLET }}>
                Just ask.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-12 flex justify-center">
              <Link
                href="/"
                className="rounded-full bg-[#7C5CD6] px-8 py-4 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-opacity duration-200 hover:opacity-90"
              >
                Launch app
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="relative overflow-hidden border-t border-white/[0.07] pt-16 pb-[220px]">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
            <Link href="/" className="flex items-center gap-3">
              <Logo variant="white" />
              <span
                className="text-[22px] font-medium tracking-[-0.01em]"
                style={{ fontFamily: serif }}
              >
                Cortex
              </span>
            </Link>
            <p className="max-w-[26rem] text-[14px] leading-[1.7] tracking-[0.01em] text-[#9a9a9a]">
              We carry more than we can hold in mind. Cortex remembers it for
              you — gently, and only for you.
            </p>
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[3vw] left-1/2 -translate-x-1/2 select-none text-[24vw] font-normal leading-none tracking-[-0.04em] text-white/[0.05]"
            style={{ fontFamily: serif }}
          >
            Cortex
          </div>
        </div>
      </footer>
    </div>
  );
}
