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

const serif = "'Expose', serif";
const VIOLET = "#7C5CD6";

const NAV = [
  { label: "Manifesto", href: "#manifesto" },
  { label: "How it works", href: "#how" },
  { label: "FAQ", href: "#faq" },
];

const PILLARS = [
  {
    title: "Keep",
    body: "Tell Cortex anything worth holding onto — a thought, a habit, a person, a file. It reads what you give it and keeps only what matters.",
    icon: <path d="M5 12 L12 5 L19 12 L12 19 Z" />,
  },
  {
    title: "Connect",
    body: "It quietly links what belongs together — tidying repeats, surfacing patterns, drawing the constellation only you could have.",
    icon: (
      <>
        <circle cx="6" cy="12" r="2.4" />
        <circle cx="18" cy="6" r="2.4" />
        <circle cx="18" cy="18" r="2.4" />
        <path d="M8 11 L16 7 M8 13 L16 17" />
      </>
    ),
  },
  {
    title: "Recall",
    body: "Ask in plain words. Cortex answers from what you actually saved — grounded, private, and yours alone, never borrowed from elsewhere.",
    icon: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16 L21 21" />
      </>
    ),
  },
];

const FAQ = [
  {
    q: "What is Cortex?",
    a: "Cortex is a calm, private place for everything worth remembering. Keep notes, files and thoughts, and Cortex quietly makes sense of them — tidying repeats, surfacing patterns, and answering questions grounded only in what you've actually saved.",
  },
  {
    q: "Is my memory private?",
    a: "Yes, completely. Your memory is yours alone. Cortex is local-first, so what you keep stays with you. Nothing is ever deleted behind your back; things you move past are gently set aside, never lost.",
  },
  {
    q: "What can I keep in it?",
    a: "Anything worth holding onto — a half-formed thought, a habit, a person, a trip, a document. Cortex reads what you give it, remembers what matters, and lets you look back whenever you need to.",
  },
  {
    q: "How does it remember over time?",
    a: "Memories you use stay strong; the rest gently ease toward the background instead of vanishing. Cortex reflects in the quiet — merging duplicates and noticing threads — so looking back feels clearer, not heavier.",
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
          <div className="max-w-[34rem]">
            <p className="mb-7 text-[12px] font-medium uppercase tracking-[0.2em] text-[#7C5CD6]">
              Stop losing what matters
            </p>
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
            <p className="mt-8 max-w-[30rem] text-[17px] leading-[1.6] tracking-[0.01em] text-white/65">
              A calm, private home for everything worth remembering — your
              notes, files and thoughts, quietly made sense of over time. Yours
              alone.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/"
                className="rounded-full bg-[#7C5CD6] px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-opacity duration-200 hover:opacity-90"
              >
                Request access
              </Link>
              <a
                href="#how"
                className="rounded-full border border-[#FFB829]/55 px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#FFB829] transition-colors duration-200 hover:bg-[#FFB829]/10"
              >
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="how" className="relative overflow-hidden py-[120px]">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
          <Constellation variant="drift" density={0.55} />
        </div>

        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <p className="mb-6 text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
            How it works
          </p>
          <h2
            className="mx-auto max-w-[15ch] text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.05] tracking-[-0.03em]"
            style={{ fontFamily: serif }}
          >
            Tell it once.{" "}
            <span className="italic" style={{ color: VIOLET }}>
              Find it forever.
            </span>
          </h2>
          <p className="mx-auto mt-7 max-w-[58ch] text-[17px] leading-[1.6] tracking-[0.01em] text-white/65">
            Give Cortex a thought, a moment, a file. It holds it safely,
            connects what belongs together, and gently surfaces what matters
            when you look back — no folders to tend, no search to fight.
          </p>

          <div className="mx-auto mt-16 max-w-[940px] overflow-hidden rounded-[24px] border border-white/10">
            <Image
              src="/cortex-app.png"
              alt="Cortex memory map"
              width={1714}
              height={1118}
              className="h-auto w-full"
              priority={false}
            />
          </div>
        </div>
      </section>

      {/* ───────── Pillars ───────── */}
      <section id="manifesto" className="py-[60px]">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-[24px] border border-white/10 p-6 transition-colors duration-200 hover:border-white/25"
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={VIOLET}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {p.icon}
                </svg>
                <h3
                  className="mt-7 text-[24px] font-medium tracking-[-0.01em]"
                  style={{ fontFamily: serif }}
                >
                  {p.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] tracking-[0.01em] text-[#bdbdbd]">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="py-[120px]">
        <div className="mx-auto max-w-[760px] px-6">
          <p className="mb-6 text-center text-[12px] font-medium uppercase tracking-[0.2em] text-[#9a9a9a]">
            Questions
          </p>
          <h2
            className="mb-12 text-center text-[clamp(2rem,4.5vw,3rem)] font-normal tracking-[-0.03em]"
            style={{ fontFamily: serif }}
          >
            Frequently asked
          </h2>
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
        </div>
      </section>

      {/* ───────── Closing CTA ───────── */}
      <section className="relative overflow-hidden py-[140px]">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-80">
          <Constellation variant="drift" density={0.7} />
        </div>
        <div className="mx-auto max-w-[1200px] px-6 text-center">
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
          <div className="mt-12 flex justify-center">
            <Link
              href="/"
              className="rounded-full bg-[#7C5CD6] px-8 py-4 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-opacity duration-200 hover:opacity-90"
            >
              Launch app
            </Link>
          </div>
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
