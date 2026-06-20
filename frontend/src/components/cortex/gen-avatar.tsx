// Deterministic generated avatar with a face (DiceBear "fun-emoji", rendered
// locally from a seed - no network). A stable seed (wallet address, agent id,
// model name) always renders the same character.

"use client";

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { funEmoji } from "@dicebear/collection";

export function GenAvatar({
  seed,
  size = 34,
  radius = "50%",
}: {
  seed: string;
  size?: number;
  radius?: number | string;
}) {
  const uri = useMemo(() => {
    const pct =
      typeof radius === "number"
        ? Math.min(50, Math.round((radius / size) * 100))
        : 50;
    return createAvatar(funEmoji, {
      seed: seed || "cortex",
      radius: pct,
      size: 80,
    }).toDataUri();
  }, [seed, size, radius]);
  return (
    <img
      src={uri}
      width={size}
      height={size}
      alt=""
      style={{ display: "block", flex: "none", borderRadius: radius }}
    />
  );
}
