import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cortex, your memory, gently kept",
  description:
    "A calm, private home for everything worth remembering. Cortex keeps your notes, files and thoughts, and quietly makes sense of them over time. Yours alone.",
  keywords: [
    "personal memory",
    "second brain",
    "private notes",
    "memory app",
    "knowledge base",
    "note taking",
    "personal knowledge management",
    "journaling",
    "local-first",
    "private by design",
  ],
  openGraph: {
    title: "Cortex, your memory, gently kept",
    description:
      "A calm, private home for everything worth remembering. Yours alone.",
    siteName: "Cortex",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cortex, your memory, gently kept",
    description:
      "A calm, private home for everything worth remembering. Yours alone.",
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
