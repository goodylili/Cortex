"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { href: "/", label: "Overview" },
  { href: "/install", label: "Install" },
  { href: "/features", label: "Concepts" },
  { href: "/schema", label: "Data Model" },
  { href: "/output", label: "Memory Views" },
  { href: "/mcp", label: "MCP Server" },
  { href: "/api", label: "Core API" },
  { href: "/webhooks", label: "Outbound" },
  { href: "/changelog", label: "Changelog" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-header">
        <Link href="/" className="mobile-typed-logo">
          Cortex
        </Link>
        <div className="mobile-nav-actions">
          <ThemeToggle />
          <button
            className={`mobile-nav-toggle ${isOpen ? "open" : ""}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle navigation"
          >
            <span className="mobile-nav-icon">
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div className={`mobile-nav-links ${isOpen ? "open" : ""}`}>
        <div className="mobile-nav-links-inner">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`mobile-nav-link ${pathname === link.href ? "active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
