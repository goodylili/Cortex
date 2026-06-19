import Link from "next/link";

import { Logo } from "@/components/logo";
import { DOCS_URL } from "@/lib/site";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Memory System", href: "/app#memories" },
  { label: "Multi-Agent Loops", href: "/app#agents" },
  { label: "Launch App", href: "/app" },
];

const DEVELOPER_LINKS = [
  { label: "Documentation", href: DOCS_URL },
  { label: "Knowledge Base", href: "/app#knowledge" },
  { label: "Studio", href: "/app#studio" },
  { label: "Integrations", href: "/app#integrations" },
  { label: "GitHub", href: "https://github.com" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Security", href: "#" },
  { label: "Cookie Policy", href: "#" },
];

const SOCIAL_LINKS = [
  {
    label: "X",
    href: "https://x.com",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    label: "GitHub",
    href: "https://github.com",
    path: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
  },
  {
    label: "Discord",
    href: "https://discord.com",
    path: "M13.545 2.907a13.227 13.227 0 00-3.573-1.04c-.522.224-.872.735-.772 1.247.182 1.497.646 2.959 1.386 4.267 1.215-.573 2.287-1.354 3.154-2.324-.016-.766-.296-1.495-.795-2.09zM12.604 6.545c-.647 1.048-1.55 1.893-2.648 2.393a8.844 8.844 0 01-.652-2.11c1.58-.359 3.04.41 3.3.717zm-4.74 3.05c1.164-.518 2.126-1.365 2.77-2.414-.688-.233-1.403-.357-2.137-.357-1.273 0-2.504.264-3.634.764 1.06 1.06 2.36 1.814 3.74 2.007zm-2.53 3.26c.78-1.338 2.007-2.385 3.435-3.028.256 1.19.825 2.313 1.602 3.236-1.648.568-3.191 1.413-4.624 2.512a8.889 8.889 0 01-.413-2.72zm6.19-1.215c.937 1.26 1.47 2.818 1.47 4.495v.37c-1.386-.44-2.625-1.24-3.56-2.33.576-.744 1.016-1.595 1.29-2.535zm.856-6.78c.46.023.912.09 1.354.2a13.195 13.195 0 00-1.82-1.456 12.194 12.194 0 00-2.77 1.456 8.851 8.851 0 011.236-1.2zm3.27 1.88c.58 1.068.94 2.27.94 3.553v.37a8.844 8.844 0 01-.94 3.553 12.19 12.19 0 002.772-5.476 13.19 13.19 0 00-1.832-1.387z",
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
