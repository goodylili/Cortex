import type React from "react";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SponsoredBanner } from "@/components/sponsored-banner";

// viewport-fit=cover lets the app extend under the notch/home indicator so the
// env(safe-area-inset-*) padding in the app shell actually takes effect; without
// it iOS ignores those insets. Pinch-zoom is left enabled (accessibility); the
// iOS "zoom on input focus" jump is avoided by keeping mobile inputs >= 16px.
// themeColor tints the browser chrome so the app reads as a single surface.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  // Canonical live host. This MUST match the deployed domain: og:image / twitter:image
  // are emitted as absolute URLs against it, and the old usecortexai.com host does not
  // resolve, so previews 404'd. The apex .xyz 308-redirects to www, so use www.
  metadataBase: new URL("https://www.usecortexai.xyz"),
  title: "Cortex, sovereign memory for AI on Sui",
  description:
    "Cortex is a decentralized sovereign memory layer built on Sui, Walrus, and Seal, with shared memory, prompt generation, loop generation, multi-agent workflows, and dreams.",
  keywords: [
    "sovereign memory",
    "decentralized memory",
    "Sui",
    "Walrus",
    "Seal",
    "shared memory",
    "agent memory",
    "prompt generation",
    "loop generation",
    "multi-agent workflows",
  ],
  openGraph: {
    title: "Cortex, sovereign memory for AI on Sui",
    description:
      "Decentralized sovereign memory with shared memory, prompts, loops, agents, and dreams.",
    siteName: "Cortex",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cortex, sovereign memory for AI on Sui",
    description:
      "Decentralized sovereign memory with shared memory, prompts, loops, agents, and dreams.",
  },
  applicationName: "Cortex",
  creator: "Cortex",
  publisher: "Cortex",
  authors: [{ name: "Cortex" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://api.fontshare.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=expose@400,500,700&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <SponsoredBanner />
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
