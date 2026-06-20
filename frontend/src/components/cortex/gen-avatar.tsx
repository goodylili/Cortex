// Deterministic generated avatar (no initials, no external assets). A stable seed
// (wallet address, agent id, model name) maps to a fixed symmetric identicon over
// a two-tone gradient, so the same identity always renders the same picture.

"use client";

const VIEW = 80;
const GRID = 5;
const CELL = VIEW / GRID;

const FG = ["#ffffff", "#f8fafc", "#0b1220", "#0a0a0a"];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gradient(h: number): string {
  const a = h % 360;
  const b = (a + 80 + ((h >> 9) % 80)) % 360;
  return `linear-gradient(135deg, hsl(${a} 68% 56%), hsl(${b} 70% 44%))`;
}

export function GenAvatar({
  seed,
  size = 34,
  radius = "50%",
}: {
  seed: string;
  size?: number;
  radius?: number | string;
}) {
  const h = hash(seed || "cortex");
  // Light foreground over a saturated gradient; flip to dark when the base hue
  // is in the bright yellow/green band so the pattern stays legible.
  const baseHue = h % 360;
  const fg = baseHue > 60 && baseHue < 190 ? FG[2]! : FG[0]!;
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < Math.ceil(GRID / 2); col++) {
      if (hash(`${seed}:${row}:${col}`) % 2 === 0) {
        cells.push([col, row]);
        if (col !== GRID - 1 - col) cells.push([GRID - 1 - col, row]);
      }
    }
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: gradient(h),
        display: "inline-block",
        flex: "none",
        overflow: "hidden",
      }}
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={size} height={size}>
        {cells.map(([c, r], i) => (
          <rect
            key={i}
            x={c * CELL}
            y={r * CELL}
            width={CELL}
            height={CELL}
            fill={fg}
            opacity={0.92}
          />
        ))}
      </svg>
    </span>
  );
}
