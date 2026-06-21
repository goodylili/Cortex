import Link from "next/link";
import { type ReactNode } from "react";

const LAST_UPDATED = "June 2026";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-8">
      <Link
        href="/"
        className="text-sm text-ink/60 transition-colors hover:text-ink"
      >
        Back to home
      </Link>
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-normal tracking-tight text-ink md:text-5xl">
          {title}
        </h1>
        <p className="text-sm text-ink/50">Last updated {LAST_UPDATED}</p>
      </header>
      <p className="text-base leading-relaxed text-ink/70 md:text-lg">{intro}</p>
      <div className="flex flex-col gap-6 text-base leading-relaxed text-ink/70">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-medium text-ink md:text-2xl">{heading}</h2>
      {children}
    </section>
  );
}
