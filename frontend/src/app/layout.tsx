import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://usecortexai.com"),
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
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
