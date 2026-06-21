import Link from "next/link";

import { Logo } from "@/components/logo";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Memory System", href: "/app#memories" },
  { label: "Multi-Agent Loops", href: "/app#agents" },
  { label: "Launch App", href: "/app" },
];

const GITHUB_URL = "https://github.com/goodylili/Cortex";

const DEVELOPER_LINKS = [
  { label: "Knowledge Base", href: "/app#knowledge" },
  { label: "Studio", href: "/app#studio" },
  { label: "Integrations", href: "/app#integrations" },
  { label: "GitHub", href: GITHUB_URL },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Security", href: "/security" },
  { label: "Cookie Policy", href: "/cookies" },
];

const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: GITHUB_URL,
    path: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
  },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <h3 className="text-xl font-medium text-ink md:text-2xl">{title}</h3>
      <nav className="flex flex-col gap-5">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-base text-ink/70 transition-colors hover:text-ink md:text-lg"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="w-full border-t border-ink/10 bg-canvas">
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 gap-12 py-14 md:grid-cols-2 md:gap-12 md:py-16 lg:grid-cols-4">
          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Developers" links={DEVELOPER_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />

          <div className="flex flex-col gap-8">
            <h3 className="text-xl font-medium text-ink md:text-2xl">
              Social Media
            </h3>
            <div className="flex gap-6">
              {SOCIAL_LINKS.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink/70 transition-colors hover:text-ink"
                  aria-label={social.label}
                >
                  <svg
                    className="h-6 w-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d={social.path} />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-ink/10 py-8 md:flex-row">
          <Link href="/" className="flex items-center gap-3 text-ink">
            <Logo variant="current" className="h-12 w-12" />
            <span className="text-2xl font-medium text-ink">Cortex</span>
          </Link>

          <p className="text-sm text-ink/50">
            © 2026 Cortex. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
