import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why Memory Should Be Durable",
  description:
    "Hidden context is a liability. Cortex makes memory inspectable, content-addressed, and consolidated over time — not a black box.",
  openGraph: {
    title: "Why Memory Should Be Durable",
    description:
      "Hidden context is a liability. Cortex makes memory inspectable, content-addressed, and consolidated over time — not a black box.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Why Memory Should Be Durable",
    description:
      "Hidden context is a liability. Cortex makes memory inspectable, content-addressed, and consolidated over time — not a black box.",
  },
};

export default function DurableMemoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
