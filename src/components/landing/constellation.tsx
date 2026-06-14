"use client";

import { useEffect, useRef } from "react";

// A particle cosmos on the void: thousands of tiny geometric primitives
// (triangles, circles, diamonds, squares) drifting on pure black and
// clustering into an organic brain — Cortex's memory mesh, rendered as
// a constellation. Pure canvas 2D, DPR-aware, calm slow motion. No deps.

type Variant = "brain" | "drift";

const PALETTE = {
  violet: "#7C5CD6", // Cortex accent — the brand pulse
  violetSoft: "#B79BEA",
  bone: "#FFFFFF",
  amber: "#FFB829",
  lichen: "#15846E",
};

type Shape = "c" | "s" | "d" | "t";

type P = {
  bx: number; // base x (px)
  by: number; // base y (px)
  s: number; // size
  shape: Shape;
  color: string;
  baseA: number; // base alpha
  tw: number; // twinkle speed
  ph: number; // phase
  amp: number; // float amplitude
  depth: number; // parallax depth 0..1
  core: boolean;
};

// brain silhouette as overlapping lobes, in units of `scale`, around a focal point
const LOBES = [
  { cx: -0.17, cy: -0.03, rx: 0.21, ry: 0.26, w: 1 }, // left hemisphere
  { cx: 0.17, cy: -0.03, rx: 0.21, ry: 0.26, w: 1 }, // right hemisphere
  { cx: 0.0, cy: -0.13, rx: 0.17, ry: 0.16, w: 0.55 }, // frontal crown
  { cx: 0.03, cy: 0.21, rx: 0.13, ry: 0.11, w: 0.5 }, // cerebellum / stem
];

export function Constellation({
  className,
  variant = "brain",
  density = 1,
}: {
  className?: string;
  variant?: Variant;
  density?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const PI2 = Math.PI * 2;
    let W = 0,
      H = 0,
      raf = 0;
    let parts: P[] = [];
    let links: [number, number][] = [];
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const rnd = (a = 1, b?: number) =>
      b === undefined ? Math.random() * a : a + Math.random() * (b - a);
    const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0]!;

    const SHAPES: Shape[] = ["c", "c", "d", "t", "s"];

    function coreColor() {
      const r = Math.random();
      if (r < 0.44) return PALETTE.violet;
      if (r < 0.66) return PALETTE.violetSoft;
      if (r < 0.88) return PALETTE.bone;
      if (r < 0.945) return PALETTE.amber;
      return PALETTE.lichen;
    }
    function driftColor() {
      const r = Math.random();
      if (r < 0.5) return PALETTE.bone;
      if (r < 0.82) return PALETTE.violetSoft;
      if (r < 0.93) return PALETTE.violet;
      return PALETTE.amber;
    }

    function build() {
      parts = [];
      links = [];
      const scale = Math.min(W, H);
      const fx = W * (variant === "brain" ? 0.66 : 0.5);
      const fy = H * (variant === "brain" ? 0.48 : 0.5);

      // ambient drift across the whole field — sparse, quiet
      const ambient = Math.round((variant === "brain" ? 360 : 520) * density);
      for (let i = 0; i < ambient; i++) {
        parts.push({
          bx: rnd(W),
          by: rnd(H),
          s: rnd(1.4, 3.4),
          shape: pick(SHAPES),
          color: driftColor(),
          baseA: rnd(0.1, 0.42),
          tw: rnd(0.4, 1.6),
          ph: rnd(PI2),
          amp: rnd(2, 7),
          depth: rnd(0.15, 0.6),
          core: false,
        });
      }

      if (variant === "brain") {
        const total = Math.round(1150 * density);
        const wsum = LOBES.reduce((a, l) => a + l.w, 0);
        for (const lobe of LOBES) {
          const n = Math.round((total * lobe.w) / wsum);
          const lx = fx + lobe.cx * scale;
          const ly = fy + lobe.cy * scale;
          const rx = lobe.rx * scale;
          const ry = lobe.ry * scale;
          for (let i = 0; i < n; i++) {
            // bias slightly outward so lobes read as shells, not blobs
            const a = rnd(PI2);
            const rr = Math.pow(Math.random(), 0.62);
            const jitter = rnd(0.92, 1.06);
            const x = lx + Math.cos(a) * rx * rr * jitter;
            const y = ly + Math.sin(a) * ry * rr * jitter;
            const edge = rr; // 0 center .. 1 rim
            parts.push({
              bx: x,
              by: y,
              s: rnd(1.8, 5.2) - edge * 1.2,
              shape: pick(SHAPES),
              color: coreColor(),
              baseA: rnd(0.5, 1) - (1 - edge) * 0.15,
              tw: rnd(0.5, 2.1),
              ph: rnd(PI2),
              amp: rnd(1.2, 4.2),
              depth: rnd(0.45, 1),
              core: true,
            });
          }
        }

        // faint synapse links among nearby core particles (grid-hashed for speed)
        const core: number[] = [];
        parts.forEach((p, i) => p.core && core.push(i));
        const maxD = scale * 0.05;
        const cell = maxD;
        const grid = new Map<string, number[]>();
        const gk = (gx: number, gy: number) => gx + ":" + gy;
        for (const i of core) {
          const p = parts[i]!;
          const k = gk(Math.floor(p.bx / cell), Math.floor(p.by / cell));
          (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
        }
        const cap = Math.round(900 * density);
        for (const i of core) {
          if (links.length > cap) break;
          const p = parts[i]!;
          const gx = Math.floor(p.bx / cell);
          const gy = Math.floor(p.by / cell);
          let made = 0;
          for (let ox = -1; ox <= 1 && made < 2; ox++) {
            for (let oy = -1; oy <= 1 && made < 2; oy++) {
              const bucket = grid.get(gk(gx + ox, gy + oy));
              if (!bucket) continue;
              for (const j of bucket) {
                if (j <= i) continue;
                const q = parts[j]!;
                const dx = q.bx - p.bx;
                const dy = q.by - p.by;
                if (dx * dx + dy * dy < maxD * maxD) {
                  links.push([i, j]);
                  if (++made >= 2) break;
                }
              }
            }
          }
        }
      }
    }

    function resize() {
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width = Math.max(1, Math.round(W * DPR));
      canvas!.height = Math.max(1, Math.round(H * DPR));
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }

    function dot(x: number, y: number, s: number, shape: Shape, rot: number) {
      const c = ctx!;
      if (shape === "c") {
        c.beginPath();
        c.arc(x, y, s / 2, 0, PI2);
        c.fill();
        return;
      }
      c.save();
      c.translate(x, y);
      if (shape === "t") {
        c.rotate(rot);
        c.beginPath();
        c.moveTo(0, -s * 0.62);
        c.lineTo(s * 0.56, s * 0.5);
        c.lineTo(-s * 0.56, s * 0.5);
        c.closePath();
        c.fill();
      } else {
        c.rotate(shape === "d" ? rot + Math.PI / 4 : rot);
        c.fillRect(-s / 2, -s / 2, s, s);
      }
      c.restore();
    }

    function frame(t: number) {
      const c = ctx!;
      c.clearRect(0, 0, W, H);
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      const time = t * 0.001;

      // synapse lines first, beneath the particles
      if (links.length) {
        c.lineWidth = 1;
        for (let k = 0; k < links.length; k++) {
          const [i, j] = links[k]!;
          const a = parts[i]!;
          const b = parts[j]!;
          const aa = Math.min(a.baseA, b.baseA);
          c.strokeStyle = `rgba(124,92,214,${0.07 * aa})`;
          c.beginPath();
          c.moveTo(a.bx + mouse.x * a.depth, a.by + mouse.y * a.depth);
          c.lineTo(b.bx + mouse.x * b.depth, b.by + mouse.y * b.depth);
          c.stroke();
        }
      }

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!;
        const fl = reduce ? 0 : Math.sin(time * 0.55 + p.ph) * p.amp;
        const flx = reduce ? 0 : Math.cos(time * 0.4 + p.ph) * p.amp * 0.6;
        const tw = reduce ? 0.85 : 0.62 + 0.38 * Math.sin(time * p.tw + p.ph);
        const x = p.bx + flx + mouse.x * p.depth;
        const y = p.by + fl + mouse.y * p.depth;
        c.globalAlpha = Math.max(0, Math.min(1, p.baseA * tw));
        c.fillStyle = p.color;
        dot(x, y, p.s, p.shape, p.ph + time * 0.2);
      }
      c.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 26;
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 26;
    };
    const onLeave = () => {
      mouse.tx = 0;
      mouse.ty = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (reduce) {
      requestAnimationFrame(frame);
    } else {
      raf = requestAnimationFrame(frame);
      window.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [variant, density]);

  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
