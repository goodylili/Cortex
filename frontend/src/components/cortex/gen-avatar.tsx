// Deterministic generated avatar (no initials, no external assets). A stable seed
// (wallet address, agent id, model name) maps to a fixed "marble" of soft, blended
// color blobs, so the same identity always renders the same picture.

"use client";

const SIZE = 80;
const ELEMENTS = 3;

const COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#ea580c",
  "#db2777",
  "#06b6d4",
  "#f59e0b",
  "#6366f1",
  "#10b981",
];

function hashCode(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getDigit(n: number, ntn: number): number {
  return Math.floor((n / Math.pow(10, ntn)) % 10);
}

function getUnit(n: number, range: number, index?: number): number {
  const value = n % range;
  if (index !== undefined && getDigit(n, index) % 2 === 0) return -value;
  return value;
}

function elements(seed: string) {
  const num = hashCode(seed || "cortex");
  return Array.from({ length: ELEMENTS }, (_, i) => {
    const f = num * (i + 1);
    return {
      color: COLORS[f % COLORS.length]!,
      translateX: getUnit(f, SIZE / 10, 1),
      translateY: getUnit(f, SIZE / 10, 2),
      scale: 1.2 + getUnit(f, SIZE / 20) / 10,
      rotate: getUnit(f, 360, 1),
    };
  });
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
  const els = elements(seed);
  const key = hashCode(seed || "cortex");
  const maskId = `gm${key}`;
  const filterId = `gf${key}`;
  const rx = typeof radius === "number" ? radius * (SIZE / size) : SIZE / 2;
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      style={{ borderRadius: radius, display: "block", flex: "none" }}
      role="img"
    >
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={SIZE}
        height={SIZE}
      >
        <rect width={SIZE} height={SIZE} rx={rx} fill="#fff" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect width={SIZE} height={SIZE} fill={els[0]!.color} />
        <path
          filter={`url(#${filterId})`}
          d="M0 0h80v80H0z"
          fill={els[1]!.color}
          transform={`translate(${els[1]!.translateX} ${els[1]!.translateY}) rotate(${els[1]!.rotate} 40 40) scale(${els[1]!.scale})`}
        />
        <path
          filter={`url(#${filterId})`}
          style={{ mixBlendMode: "overlay" }}
          d="M0 0h80v80H0z"
          fill={els[2]!.color}
          transform={`translate(${els[2]!.translateX} ${els[2]!.translateY}) rotate(${els[2]!.rotate} 40 40) scale(${els[2]!.scale})`}
        />
      </g>
      <defs>
        <filter id={filterId} x="0" y="0" width="100%" height="100%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
    </svg>
  );
}
