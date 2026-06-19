import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Introducing Cortex",
  description:
    "A local-first persistent memory layer for AI. Stop losing context every time the session, tool, or model changes.",
  openGraph: {
    title: "Introducing Cortex",
    description:
      "A local-first persistent memory layer for AI. Stop losing context every time the session, tool, or model changes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Introducing Cortex",
    description:
      "A local-first persistent memory layer for AI. Stop losing context every time the session, tool, or model changes.",
  },
};

export default function IntroducingCortexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
