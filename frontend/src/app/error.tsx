"use client";

import { useEffect } from "react";

import { StatusScreen } from "@/components/landing/status-screen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      code="500"
      title="A memory slipped  -  that wasn't supposed to happen."
      onRetry={reset}
    />
  );
}
