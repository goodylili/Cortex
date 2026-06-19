import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API | Cortex",
  description: "Programmatic access for developers.",
};

export default function APILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
