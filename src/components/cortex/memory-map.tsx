"use client";
import { useEffect, useMemo, useRef } from "react";
import { useCortex } from "@/lib/cortex/store";
import { type Memory } from "@/lib/cortex/logic";

// Full canvas "memory mesh": a force-directed graph of your memories with glossy
// glowing orbs, lavender seal beams, a rotating seal, a category legend, a hub
// fan-out and a detail card. Asking is handled by the app's global composer.
// Ported to run on the app's live memories. Self-contained dark immersive view.

export function MemoryMap({
  onOpen,
  theme = "dark",
  legendOpen = false,
}: {
  onOpen: (m: Memory) => void;
  theme?: "light" | "dark";
  legendOpen?: boolean;
}) {
  const ownLive = useCortex((s) => s.live)();
  const sharedMemories = useCortex((s) => s.sharedMemories);
  // Memories shared with you are part of your brain too — graph them alongside your
  // own (they carry shared: true so the card/drawer mark them).
  const live = useMemo(
    () => [...ownLive, ...sharedMemories],
    [ownLive, sharedMemories],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = <T extends Element = HTMLElement>(sel: string) =>
      root.querySelector(sel) as T | null;
    const css = (k: string) =>
      getComputedStyle(root).getPropertyValue(k).trim();
    const dark = theme !== "light";
    const NEUT = {
      vIn: dark ? "#0c0c0d" : "#ffffff",
      vMid: dark ? "#060607" : "#f6f6f7",
      vOut: dark ? "#000000" : "#ececed",
      line: dark ? "#c4c4c4" : "#8c8c8c",
      faintRing: dark ? "#3a3550" : "#d4d0de",
      link: dark ? "#7a7596" : "#b6b2c4",
      glow: dark ? "#efefef" : "#5a5a5a",
      spark: dark ? "#ffffff" : "#1c1c1c",
      label: dark ? "#dfe6e3" : "#2a2a2a",
      hubLabel: dark ? "#eef2f0" : "#161616",
      dim: dark ? "#9fb0ab" : "#6b6b6b",
      tagBg: dark ? "rgba(4,10,12,0.85)" : "rgba(255,255,255,0.92)",
      tagBorder: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
      tagText: dark ? "#cdd6d3" : "#3a3a3a",
      cardBg: dark ? "rgba(10,22,24,0.7)" : "rgba(255,255,255,0.86)",
      veil: (a: number) => (dark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`),
    };
    const PI2 = Math.PI * 2;
    const SEAL = dark ? "228,228,228" : "120,120,120";
    const PALETTE = dark
      ? [
          "#ededed",
          "#cfcfcf",
          "#b5b5b5",
          "#dcdcdc",
          "#c2c2c2",
          "#a6a6a6",
          "#d2d2d2",
          "#bcbcbc",
          "#9e9e9e",
          "#cacaca",
        ]
      : [
          "#3c3c3c",
          "#565656",
          "#6c6c6c",
          "#484848",
          "#5e5e5e",
          "#787878",
          "#505050",
          "#666666",
          "#828282",
          "#5a5a5a",
        ];
    const LBL: Record<string, string> = {
      work: "Work",
      travel: "Travel",
      people: "People",
      habits: "Habits",
      ideas: "Ideas",
      reading: "Reading",
      money: "Money",
      health: "Health",
      note: "Notes",
      file: "Files",
    };

    // ----- build data from live memories -----
    type M = {
      id: string;
      cat: string;
      emo: string;
      full: string;
      clause: string;
      day: number;
      by: string;
      seal: boolean;
      mem: Memory;
      blob?: string;
      pinned?: boolean;
      forgotten?: boolean;
      verified?: boolean;
      rel?: { m: M; why: string }[];
      node?: Node;
    };
    type Node = {
      id: string;
      type: "center" | "hub" | "leaf";
      cat?: string;
      mem?: M;
      x: number;
      y: number;
      vx: number;
      vy: number;
      a?: number;
      s?: number;
      pulse?: number;
    };
    const EMO: Record<string, { c: string }> = dark
      ? {
          calm: { c: "#dadada" },
          focused: { c: "#c8c8c8" },
          excited: { c: "#e6e6e6" },
          joyful: { c: "#d0d0d0" },
          curious: { c: "#bebebe" },
          anxious: { c: "#b2b2b2" },
        }
      : {
          calm: { c: "#5a5a5a" },
          focused: { c: "#6a6a6a" },
          excited: { c: "#484848" },
          joyful: { c: "#606060" },
          curious: { c: "#727272" },
          anxious: { c: "#7e7e7e" },
        };
    const EMOK = Object.keys(EMO);
    const emoOf = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      return EMOK[h % EMOK.length]!;
    };
    const data = liveRef.current;
    const cats = Array.from(new Set(data.map((m) => m.tags[0] || "note")));
    const CATS: Record<string, { c: string; label: string }> = {};
    cats.forEach((c, i) => {
      CATS[c] = {
        c: PALETTE[i % PALETTE.length]!,
        label: LBL[c] || c.charAt(0).toUpperCase() + c.slice(1),
      };
    });
    const sorted = [...data].sort((a, b) => a.ts - b.ts);
    const dayMax = Math.max(1, sorted.length);
    const MEM: M[] = sorted.map((m, i) => ({
      id: m.id,
      mem: m,
      cat: m.tags[0] || "note",
      emo: emoOf(m.id),
      full: m.text,
      clause: m.text.replace(/[.!?]+$/, "").toLowerCase(),
      day: i + 1,
      by: (m as unknown as { source?: string }).source || "you",
      seal: !!m.kept,
      pinned: false,
      forgotten: false,
      verified: false,
      rel: [],
    }));
    const byId: Record<string, M> = {};
    MEM.forEach((m) => (byId[m.id] = m));
    // relationships from shared tags
    const RELS: [string, string, string][] = [];
    for (let i = 0; i < MEM.length && RELS.length < MEM.length * 2; i++) {
      for (let j = i + 1; j < MEM.length && RELS.length < MEM.length * 2; j++) {
        const ti = MEM[i]!.mem.tags,
          tj = MEM[j]!.mem.tags;
        const shared = ti.find((t) => tj.includes(t));
        if (shared) RELS.push([MEM[i]!.id, MEM[j]!.id, shared]);
      }
    }
    RELS.forEach(([a, b, why]) => {
      byId[a]?.rel!.push({ m: byId[b]!, why });
      byId[b]?.rel!.push({ m: byId[a]!, why });
    });

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const canvas = q<HTMLCanvasElement>("#mc")!;
    const ctx = canvas.getContext("2d")!;
    let W = 0,
      H = 0,
      raf = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let vign: CanvasGradient | null = null;
    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      vign = ctx.createRadialGradient(
        W * 0.46,
        H * 0.5,
        40,
        W * 0.46,
        H * 0.5,
        Math.max(W, H) * 0.8,
      );
      vign.addColorStop(0, NEUT.vIn);
      vign.addColorStop(0.5, NEUT.vMid);
      vign.addColorStop(1, NEUT.vOut);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const nodes: Node[] = [],
      hubs: Record<string, Node> = {},
      leaves: Node[] = [],
      links: { a: M; b: M }[] = [];
    const center: Node = {
      id: "center",
      type: "center",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    };
    nodes.push(center);
    const hubKeys = Object.keys(CATS);
    hubKeys.forEach((k, i) => {
      const a = ((-90 + i * (360 / hubKeys.length)) * Math.PI) / 180;
      const hub: Node = {
        id: "hub_" + k,
        type: "hub",
        cat: k,
        x: Math.cos(a) * 225,
        y: Math.sin(a) * 225,
        vx: 0,
        vy: 0,
        a: 1,
      };
      nodes.push(hub);
      hubs[k] = hub;
      MEM.filter((m) => m.cat === k).forEach((m, j, arr) => {
        const la = a + (j - (arr.length - 1) / 2) * 0.5;
        m.node = {
          id: "leaf_" + m.id,
          type: "leaf",
          mem: m,
          cat: k,
          x: hub.x + Math.cos(la) * 95,
          y: hub.y + Math.sin(la) * 95,
          vx: 0,
          vy: 0,
          a: 1,
          s: 1,
          pulse: 0,
        };
        nodes.push(m.node);
        leaves.push(m.node);
      });
    });
    RELS.forEach(([a, b]) => {
      if (byId[a]?.node && byId[b]?.node)
        links.push({ a: byId[a]!, b: byId[b]! });
    });

    const cam = { tx: 0, ty: 0, scale: 1 };
    let camT = { tx: 0, ty: 0, scale: 1 };
    const camV = { tx: 0, ty: 0, scale: 0 };
    const toScreen = (x: number, y: number): [number, number] => [
      (x - cam.tx) * cam.scale + W * 0.46,
      (y - cam.ty) * cam.scale + H / 2,
    ];
    const toWorld = (sx: number, sy: number): [number, number] => [
      (sx - W * 0.46) / cam.scale + cam.tx,
      (sy - H / 2) / cam.scale + cam.ty,
    ];

    const asOf = dayMax;
    let view = "overview",
      detailCat: string | null = null,
      focusCat: string | null = null,
      focusEmo: string | null = null,
      selectedMem: M | null = null,
      hoverMem: M | null = null,
      hoverFan: FanItem | null = null;
    let dragging = false,
      dragNode: Node | null = null,
      lastM = { x: 0, y: 0 },
      didDrag = false,
      appear = 0;
    const t0 = performance.now();
    let relevant = new Set<string>(),
      pings: { wx: number; wy: number; r: number; a: number; c: string }[] = [],
      fanItems: FanItem[] = [],
      detailT = 0;
    type FanItem = { m: M; x: number; y: number; cy: number };
    const hiddenCats = new Set<string>();
    const vis = (m: M) =>
      m.day <= asOf && !m.forgotten && !hiddenCats.has(m.cat);
    const hexA = (hex: string, a: number) => {
      hex = hex.replace("#", "");
      if (hex.length === 3)
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      const r = parseInt(hex.slice(0, 2), 16),
        g = parseInt(hex.slice(2, 4), 16),
        b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const rgb = (hex: string) => {
      hex = hex.replace("#", "");
      if (hex.length === 3)
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    };
    const mixHex = (h1: string, h2: string, amt: number) => {
      const a = rgb(h1),
        b = rgb(h2);
      return `rgb(${Math.round(a[0]! + (b[0]! - a[0]!) * amt)},${Math.round(a[1]! + (b[1]! - a[1]!) * amt)},${Math.round(a[2]! + (b[2]! - a[2]!) * amt)})`;
    };
    const SANS = css("--mesh-sans") || "system-ui, sans-serif";
    const MONO = css("--mesh-mono") || "ui-monospace, monospace";
    const HEAD = css("--mesh-head") || SANS;
    const trunc = (s: string, n: number) =>
      s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
    function rr(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    const neighbor = (m: M) =>
      (hoverMem && hoverMem.rel!.some((r) => r.m === m)) ||
      (selectedMem && selectedMem.rel!.some((r) => r.m === m));
    function memActive(m: M) {
      if (!vis(m)) return false;
      if (relevant.size) return relevant.has("leaf_" + m.id);
      if (focusCat) return m.cat === focusCat;
      if (focusEmo) return m.emo === focusEmo;
      return true;
    }
    function orb(x: number, y: number, r: number, hex: string, bright: number) {
      ctx.fillStyle = hexA(hex, Math.min(1, 0.85 * bright + 0.15));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, PI2);
      ctx.fill();
    }
    function ring(
      x: number,
      y: number,
      r: number,
      hex: string,
      a: number,
      w?: number,
    ) {
      ctx.strokeStyle = hexA(hex, a);
      ctx.lineWidth = w || 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, PI2);
      ctx.stroke();
    }
    function spikyAura(
      x: number,
      y: number,
      base: number,
      amp: number,
      hex: string,
      alpha: number,
      tnow: number,
      seed: number,
    ) {
      ctx.strokeStyle = hexA(hex, alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const N = 120;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * PI2;
        const n =
          Math.sin(a * 9 + seed) +
          Math.sin(a * 17 - seed * 1.7 + tnow * 1.5) +
          Math.sin(a * 31 + tnow);
        const r = base + amp * (0.5 + (0.5 * Math.abs(n)) / 3);
        const px = x + Math.cos(a) * r,
          py = y + Math.sin(a) * r;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    function spring(a: Node, b: Node, len: number, k: number) {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - len) * k;
      const fx = (dx / d) * f,
        fy = (dy / d) * f;
      if (a !== dragNode) {
        a.vx += fx;
        a.vy += fy;
      }
      if (b !== dragNode) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    function physics() {
      const vn = nodes.filter((n) => n.type !== "leaf" || vis(n.mem!));
      for (let i = 0; i < vn.length; i++)
        for (let j = i + 1; j < vn.length; j++) {
          const a = vn[i]!,
            b = vn[j]!;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          const d = Math.sqrt(d2);
          let f = 8800 / d2;
          if (f > 2.1) f = 2.1;
          const fx = (dx / d) * f,
            fy = (dy / d) * f;
          if (a !== dragNode) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (b !== dragNode) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      hubKeys.forEach((k) => spring(center, hubs[k]!, 225, 0.02));
      leaves.forEach((lf) => {
        if (vis(lf.mem!)) spring(hubs[lf.cat!]!, lf, 95, 0.026);
      });
      links.forEach((l) => {
        if (vis(l.a) && vis(l.b)) spring(l.a.node!, l.b.node!, 135, 0.006);
      });
      vn.forEach((n) => {
        if (n.type === "center") {
          n.x = 0;
          n.y = 0;
          n.vx = 0;
          n.vy = 0;
          return;
        }
        n.vx += (0 - n.x) * 0.0009;
        n.vy += (0 - n.y) * 0.0009;
        n.vx *= 0.85;
        n.vy *= 0.85;
        if (n !== dragNode) {
          n.x += n.vx;
          n.y += n.vy;
        }
      });
      const dim = relevant.size || focusCat || focusEmo;
      leaves.forEach((lf) => {
        const m = lf.mem!;
        const v = vis(m),
          nb = neighbor(m),
          act = memActive(m);
        const at = !v ? 0 : act ? 1 : nb ? 0.92 : dim ? 0.12 : 0.82;
        const st = relevant.has("leaf_" + m.id)
          ? 1.32
          : hoverMem === m
            ? 1.4
            : nb
              ? 1.16
              : act
                ? 1
                : 0.86;
        lf.a! += (at - lf.a!) * (reduce ? 1 : 0.14);
        lf.s! += (st - lf.s!) * (reduce ? 1 : 0.16);
        if (lf.pulse! > 0.01) lf.pulse! *= 0.93;
        else lf.pulse = 0;
      });
      Object.values(hubs).forEach((h) => {
        const anyInCat = MEM.some((m) => m.cat === h.cat && memActive(m));
        const act = relevant.size
          ? anyInCat
          : focusCat
            ? focusCat === h.cat
            : focusEmo
              ? anyInCat
              : true;
        h.a! += ((act ? 1 : 0.28) - h.a!) * 0.14;
      });
      pings = pings.filter((p) => {
        p.r += reduce ? 40 : 3;
        p.a *= 0.94;
        return p.a > 0.03;
      });
    }
    function beam(
      p0: number[],
      p1: number[],
      intensity: number,
      tnow: number,
      phase: number,
    ) {
      const mx = (p0[0]! + p1[0]!) / 2,
        my = (p0[1]! + p1[1]!) / 2;
      const dx = p1[0]! - p0[0]!,
        dy = p1[1]! - p0[1]!;
      const L = Math.hypot(dx, dy) || 1;
      const c = [mx - (dy / L) * L * 0.1, my + (dx / L) * L * 0.1];
      ctx.beginPath();
      ctx.moveTo(p0[0]!, p0[1]!);
      ctx.quadraticCurveTo(c[0]!, c[1]!, p1[0]!, p1[1]!);
      ctx.strokeStyle = hexA(NEUT.line, 0.13 * intensity);
      ctx.lineWidth = 6;
      ctx.shadowColor = hexA(NEUT.glow, 0.55 * intensity);
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p0[0]!, p0[1]!);
      ctx.quadraticCurveTo(c[0]!, c[1]!, p1[0]!, p1[1]!);
      ctx.strokeStyle = hexA(NEUT.glow, 0.6 * intensity);
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
      ctx.stroke();
      const tt = (tnow * 0.16 + phase) % 1,
        u = 1 - tt;
      const gx = u * u * p0[0]! + 2 * u * tt * c[0]! + tt * tt * p1[0]!,
        gy = u * u * p0[1]! + 2 * u * tt * c[1]! + tt * tt * p1[1]!;
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, PI2);
      ctx.fillStyle = hexA(NEUT.spark, 0.85 * intensity);
      ctx.shadowColor = hexA(NEUT.glow, 0.9 * intensity);
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      return c;
    }
    function edgeTag(x: number, y: number, text: string) {
      ctx.font = "9px " + MONO;
      const w = ctx.measureText(text).width + 10;
      rr(x - w / 2, y - 8, w, 16, 5);
      ctx.fillStyle = NEUT.tagBg;
      ctx.fill();
      ctx.strokeStyle = NEUT.tagBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = NEUT.tagText;
      ctx.textAlign = "center";
      ctx.fillText(text, x, y + 3);
    }
    function draw() {
      const tnow = (performance.now() - t0) / 1000;
      ctx.fillStyle = vign!;
      ctx.fillRect(0, 0, W, H);
      if (view === "detail") {
        drawDetail(tnow);
        return;
      }
      ctx.globalAlpha = appear;
      const [cx0, cy0] = toScreen(0, 0);
      [160, 250, 360].forEach((r) =>
        ring(cx0, cy0, r * cam.scale, NEUT.faintRing, 0.09, 1),
      );
      hubKeys.forEach((k, i) => {
        const h = hubs[k]!;
        const p1 = toScreen(h.x, h.y);
        beam([cx0, cy0], p1, 0.4 + h.a! * 0.6, tnow, i / 6);
        const tx = (cx0 + p1[0]) / 2,
          ty = (cy0 + p1[1]) / 2;
        const cnt = MEM.filter((m) => m.cat === k && vis(m)).length;
        if (cnt) edgeTag(tx, ty, String(cnt));
      });
      leaves.forEach((lf) => {
        if (!vis(lf.mem!)) return;
        const h = hubs[lf.cat!]!;
        const [ax, ay] = toScreen(h.x, h.y),
          [bx, by] = toScreen(lf.x, lf.y);
        ctx.strokeStyle = hexA(NEUT.line, 0.09 * lf.a!);
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 3]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      const anyQ = relevant.size > 0;
      links.forEach((l) => {
        if (!vis(l.a) || !vis(l.b)) return;
        const [ax, ay] = toScreen(l.a.node!.x, l.a.node!.y),
          [bx, by] = toScreen(l.b.node!.x, l.b.node!.y);
        const hot =
          (hoverMem && (hoverMem === l.a || hoverMem === l.b)) ||
          (selectedMem && (selectedMem === l.a || selectedMem === l.b)) ||
          (relevant.has("leaf_" + l.a.id) && relevant.has("leaf_" + l.b.id));
        const al = hot ? 0.5 : anyQ || focusCat || focusEmo ? 0.04 : 0.1;
        const mx = (ax + bx) / 2,
          my = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.13;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        ctx.strokeStyle = hot
          ? hexA(CATS[l.a.cat]!.c, al)
          : hexA(NEUT.link, al);
        ctx.lineWidth = hot ? 1.4 : 1;
        if (hot) {
          ctx.shadowColor = hexA(CATS[l.a.cat]!.c, 0.4);
          ctx.shadowBlur = 6;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      relevant.forEach((id) => {
        const m = MEM.find((x) => "leaf_" + x.id === id);
        if (!m || !vis(m)) return;
        beam(
          [cx0, cy0],
          toScreen(m.node!.x, m.node!.y),
          0.9 * m.node!.a!,
          tnow,
          0.4,
        );
      });
      pings.forEach((p) => {
        const [sx, sy] = toScreen(p.wx, p.wy);
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, PI2);
        ctx.strokeStyle = hexA(p.c, p.a);
        ctx.lineWidth = 1.6;
        ctx.shadowColor = hexA(p.c, p.a);
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      leaves.forEach((lf) => {
        const m = lf.mem!;
        if (!vis(m)) return;
        const [x, y] = toScreen(lf.x, lf.y);
        const cc = CATS[m.cat]!.c;
        const al = lf.a!,
          r = 7 * lf.s! * cam.scale;
        if (lf.pulse! > 0.01)
          ring(x, y, r + 7 + lf.pulse! * 12, cc, lf.pulse! * 0.6, 1.4);
        orb(x, y, r, cc, Math.max(al, 0.25));
        ring(x, y, r + 4, NEUT.spark, Math.max(al, 0.25) * 0.3, 1.3);
        if (m.pinned) ring(x, y, r + 7.5, NEUT.spark, 0.6 * al, 1);
        const showL =
          relevant.has("leaf_" + m.id) ||
          hoverMem === m ||
          neighbor(m) ||
          focusCat === m.cat ||
          focusEmo === m.emo;
        if (showL && al > 0.3) {
          const right = lf.x >= 0;
          ctx.textAlign = right ? "left" : "right";
          const lx = right ? x + r + 8 : x - r - 8;
          ctx.font = "10.5px " + MONO;
          ctx.fillStyle = hexA(NEUT.label, Math.min(al, 0.95));
          ctx.fillText(
            trunc(
              m.full,
              right
                ? Math.floor((W - x - 30) / 6.3)
                : Math.floor((x - 60) / 6.3),
            ),
            lx,
            y + 3.5,
          );
        }
      });
      hubKeys.forEach((k) => {
        const h = hubs[k]!;
        const [x, y] = toScreen(h.x, h.y);
        const cnt = MEM.filter((m) => m.cat === k && vis(m)).length;
        const sealed = MEM.filter(
          (m) => m.cat === k && m.seal && vis(m),
        ).length;
        const pct = Math.round((sealed / Math.max(cnt, 1)) * 100);
        const r = 16 * cam.scale;
        orb(x, y, r, CATS[k]!.c, 0.5 + h.a! * 0.5);
        ctx.textAlign = "left";
        ctx.fillStyle = hexA(NEUT.hubLabel, 0.95 * h.a!);
        ctx.font = "600 14px " + HEAD;
        ctx.fillText(CATS[k]!.label, x + r + 12, y - 2);
        ctx.font = "10px " + MONO;
        const pw = ctx.measureText(pct + "%").width + 12;
        rr(x + r + 12, y + 5, pw, 15, 5);
        ctx.fillStyle = NEUT.veil(0.07 * h.a!);
        ctx.fill();
        ctx.fillStyle = hexA(NEUT.dim, 0.85 * h.a!);
        ctx.textAlign = "center";
        ctx.fillText(pct + "%", x + r + 12 + pw / 2, y + 15.5);
      });
      drawSeal(cx0, cy0);
      ctx.globalAlpha = 1;
    }
    function drawSeal(x: number, y: number) {
      const N = MEM.filter((m) => vis(m)).length,
        sealed = MEM.filter((m) => m.seal && vis(m)).length;
      orb(x, y, 11 * cam.scale, NEUT.label, 1);
      ctx.textAlign = "left";
      ctx.fillStyle = hexA(NEUT.label, 0.95);
      ctx.font = "600 15px " + HEAD;
      ctx.fillText("your memory", x + 24 * cam.scale, y - 1 * cam.scale);
      ctx.font = "10px " + MONO;
      const pct = Math.round((sealed / Math.max(N, 1)) * 100) + "%";
      const pw = ctx.measureText(pct).width + 12;
      rr(x + 24 * cam.scale, y + 7, pw, 15, 5);
      ctx.fillStyle = NEUT.veil(0.08);
      ctx.fill();
      ctx.fillStyle = hexA(NEUT.dim, 0.9);
      ctx.textAlign = "center";
      ctx.fillText(pct, x + 24 * cam.scale + pw / 2, y + 17.5);
    }
    function buildFan() {
      fanItems = [];
      const mems = MEM.filter((m) => m.cat === detailCat && vis(m));
      const n = mems.length,
        top = H * 0.16,
        bot = H * 0.84,
        cardY = H * 0.5;
      mems.forEach((m, i) => {
        const fy = n > 1 ? top + (bot - top) * (i / (n - 1)) : H * 0.5;
        fanItems.push({ m, x: W * 0.66, y: fy, cy: cardY });
      });
    }
    function drawDetail(tnow: number) {
      detailT += (1 - detailT) * (reduce ? 1 : 0.12);
      ctx.globalAlpha = detailT;
      const cat = detailCat!,
        col = CATS[cat]!.c;
      const ox = W * 0.2,
        oy = H * 0.5;
      [120, 200].forEach((r) => ring(ox, oy, r, NEUT.faintRing, 0.1, 1));
      const cards = [
        {
          n: fanItems.length,
          l: CATS[cat]!.label + " memories",
          hi: true,
          _x: 0,
          _y: 0,
          _w: 0,
          _h: 0,
        },
        {
          n: RELS.filter(
            ([a, b]) => byId[a]!.cat === cat || byId[b]!.cat === cat,
          ).length,
          l: "Linked",
          hi: false,
          _x: 0,
          _y: 0,
          _w: 0,
          _h: 0,
        },
        {
          n: MEM.filter((m) => m.cat === cat && m.seal && vis(m)).length,
          l: "Sealed",
          hi: false,
          _x: 0,
          _y: 0,
          _w: 0,
          _h: 0,
        },
      ];
      const cx = W * 0.4,
        cw = 220,
        chh = 64,
        gap = 14,
        total = cards.length * chh + (cards.length - 1) * gap;
      const cyTop = H * 0.5 - total / 2;
      cards.forEach((cd, i) => {
        const y = cyTop + i * (chh + gap);
        cd._x = cx;
        cd._y = y;
        cd._w = cw;
        cd._h = chh;
        rr(cx, y, cw, chh, 13);
        ctx.fillStyle = NEUT.cardBg;
        ctx.fill();
        ctx.lineWidth = cd.hi ? 1.5 : 1;
        ctx.strokeStyle = cd.hi ? hexA(NEUT.line, 0.7) : NEUT.veil(0.1);
        if (cd.hi) {
          ctx.shadowColor = `rgba(${SEAL},0.4)`;
          ctx.shadowBlur = 12;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.textAlign = "left";
        ctx.fillStyle = hexA(col, 0.9);
        ctx.font = "600 24px " + HEAD;
        ctx.fillText(String(cd.n), cx + 16, y + 30);
        ctx.fillStyle = NEUT.dim;
        ctx.font = "11px " + MONO;
        ctx.fillText(cd.l, cx + 16, y + 48);
      });
      const hc = cards[0]!;
      beam([ox + 50, oy], [hc._x, hc._y + hc._h / 2], 0.9, tnow, 0);
      const fx0 = hc._x + hc._w,
        fy0 = hc._y + hc._h / 2;
      fanItems.forEach((it, i) => {
        const frac = fanItems.length > 1 ? i / (fanItems.length - 1) : 0.5;
        const ec = EMO[it.m.emo]!.c;
        const col2 = mixHex(NEUT.line, ec, frac);
        const mx = (fx0 + it.x) / 2;
        const hot = hoverFan === it;
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.quadraticCurveTo(mx, fy0, it.x, it.y);
        ctx.strokeStyle = hexA(col2, hot ? 0.85 : 0.5);
        ctx.lineWidth = hot ? 2 : 1;
        ctx.shadowColor = hexA(col2, hot ? 0.6 : 0.3);
        ctx.shadowBlur = hot ? 8 : 4;
        ctx.stroke();
        ctx.shadowBlur = 0;
        orb(it.x, it.y, 5, ec, hot ? 1 : 0.7);
        ctx.textAlign = "left";
        ctx.fillStyle = NEUT.label;
        ctx.font = "12px " + SANS;
        ctx.fillText(trunc(it.m.full, 26), it.x + 12, it.y - 2);
        ctx.font = "9px " + MONO;
        const pillT = "#" + it.m.day;
        const pw = ctx.measureText(pillT).width + 10;
        rr(it.x + 12, it.y + 6, pw, 14, 4);
        ctx.fillStyle = NEUT.veil(0.06);
        ctx.fill();
        ctx.fillStyle = NEUT.dim;
        ctx.textAlign = "center";
        ctx.fillText(pillT, it.x + 12 + pw / 2, it.y + 16);
      });
      spikyAura(ox, oy, 52, 16, col, 0.5, tnow, cat.length);
      spikyAura(ox, oy, 52, 16, col, 0.25, tnow * 1.3 + 1, cat.length + 3);
      orb(ox, oy, 30, col, 1);
      ctx.textAlign = "center";
      ctx.fillStyle = NEUT.hubLabel;
      ctx.font = "600 16px " + HEAD;
      ctx.fillText(CATS[cat]!.label, ox, oy - 78);
      ctx.font = "10px " + MONO;
      ctx.fillStyle = NEUT.dim;
      ctx.fillText(fanItems.length + " memories", ox, oy - 62);
      ctx.globalAlpha = 1;
    }
    function frame() {
      if (view === "overview") physics();
      if (reduce) {
        cam.tx = camT.tx;
        cam.ty = camT.ty;
        cam.scale = camT.scale;
      } else {
        (["tx", "ty", "scale"] as const).forEach((p) => {
          camV[p] += (camT[p] - cam[p]) * 0.09;
          camV[p] *= 0.78;
          cam[p] += camV[p];
        });
      }
      appear += (1 - appear) * (reduce ? 1 : 0.05);
      draw();
      raf = requestAnimationFrame(frame);
    }
    function hit(sx: number, sy: number): HitRes {
      if (view === "detail") {
        for (const it of fanItems) {
          if ((sx - it.x) ** 2 + (sy - it.y) ** 2 < 400)
            return { kind: "fan", it };
        }
        return null;
      }
      let best: HitRes = null,
        bd = 1e9;
      leaves.forEach((lf) => {
        if (!vis(lf.mem!)) return;
        const [x, y] = toScreen(lf.x, lf.y);
        const d = (sx - x) ** 2 + (sy - y) ** 2;
        if (d < 400 && d < bd) {
          bd = d;
          best = { kind: "leaf", m: lf.mem! };
        }
      });
      if (best) return best;
      for (const k of hubKeys) {
        const h = hubs[k]!;
        const [x, y] = toScreen(h.x, h.y);
        if ((sx - x) ** 2 + (sy - y) ** 2 < 24 * 24)
          return { kind: "hub", cat: k };
      }
      const [cx, cy] = toScreen(0, 0);
      if ((sx - cx) ** 2 + (sy - cy) ** 2 < 28 * 28) return { kind: "center" };
      return null;
    }
    type HitRes =
      | { kind: "fan"; it: FanItem }
      | { kind: "leaf"; m: M }
      | { kind: "hub"; cat: string }
      | { kind: "center" }
      | null;

    const onMove = (e: MouseEvent) => {
      const sx = e.offsetX,
        sy = e.offsetY;
      if (view === "overview" && dragging && dragNode) {
        const [wx, wy] = toWorld(sx, sy);
        dragNode.x = wx;
        dragNode.y = wy;
        dragNode.vx = 0;
        dragNode.vy = 0;
        didDrag = true;
        return;
      }
      if (view === "overview" && dragging) {
        const dx = (sx - lastM.x) / cam.scale,
          dy = (sy - lastM.y) / cam.scale;
        camT.tx -= dx;
        camT.ty -= dy;
        cam.tx -= dx;
        cam.ty -= dy;
        lastM = { x: sx, y: sy };
        didDrag = true;
        return;
      }
      const h = hit(sx, sy);
      hoverMem = h && h.kind === "leaf" ? h.m : null;
      hoverFan = h && h.kind === "fan" ? h.it : null;
      canvas.classList.toggle("pointer", !!h);
      if (hoverMem) showPeek(hoverMem, e.clientX, e.clientY);
      else if (hoverFan) showPeek(hoverFan.m, e.clientX, e.clientY);
      else hidePeek();
    };
    const onDown = (e: MouseEvent) => {
      lastM = { x: e.offsetX, y: e.offsetY };
      didDrag = false;
      dragging = true;
      canvas.classList.add("grabbing");
      if (view === "overview") {
        const h = hit(e.offsetX, e.offsetY);
        if (h && h.kind === "leaf") dragNode = h.m.node!;
      }
    };
    const onUp = () => {
      dragging = false;
      dragNode = null;
      canvas.classList.remove("grabbing");
    };
    const onClick = (e: MouseEvent) => {
      if (didDrag) return;
      const h = hit(e.offsetX, e.offsetY);
      if (view === "detail") {
        if (h && h.kind === "fan") openCard(h.it.m);
        else if (!h) exitDetail();
        return;
      }
      if (!h) {
        resetView();
        return;
      }
      if (h.kind === "leaf") openCard(h.m);
      else if (h.kind === "hub") enterDetail(h.cat);
      else resetView();
    };
    const onWheel = (e: WheelEvent) => {
      if (view !== "overview") return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.9;
      camT.scale = Math.max(0.6, Math.min(2.4, camT.scale * f));
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    function enterDetail(cat: string) {
      killHint();
      clearQuery();
      closeCard();
      detailCat = cat;
      buildFan();
      detailT = 0;
      view = "detail";
    }
    function exitDetail() {
      view = "overview";
      detailCat = null;
      closeCard();
    }
    function resetView() {
      if (view === "detail") {
        exitDetail();
        return;
      }
      focusCat = null;
      focusEmo = null;
      clearQuery();
      closeCard();
      hideAnswer();
      camT = { tx: 0, ty: 0, scale: 1 };
      syncLegends();
    }
    const peek = q("#peek")!;
    function showPeek(m: M, cx: number, cy: number) {
      const rect = root!.getBoundingClientRect();
      peek.querySelector(".tags")!.innerHTML =
        `<span class="tgg" style="color:${CATS[m.cat]!.c}"><span class="d" style="background:${CATS[m.cat]!.c}"></span>${m.cat}</span><span class="tgg" style="color:${EMO[m.emo]!.c}"><span class="d" style="background:${EMO[m.emo]!.c}"></span>${m.emo}</span>`;
      peek.querySelector(".txt")!.textContent = m.full;
      peek.querySelector(".meta")!.textContent =
        m.by +
        "  ·  " +
        m.mem.tags.join(", ") +
        (m.rel!.length ? "  ·  " + m.rel!.length + " links" : "");
      let x = cx - rect.left + 18,
        y = cy - rect.top + 18;
      if (x + 290 > rect.width) x = cx - rect.left - 288;
      if (y + 150 > rect.height) y = cy - rect.top - 150;
      (peek as HTMLElement).style.left = x + "px";
      (peek as HTMLElement).style.top = y + "px";
      peek.classList.add("on");
    }
    function hidePeek() {
      peek.classList.remove("on");
    }

    // legend — categories only (the real axis)
    const rowsCat = q("#rowsCat")!;
    rowsCat.innerHTML = "";
    Object.entries(CATS).forEach(([k, v]) => {
      const el = document.createElement("div");
      el.className = "li";
      el.dataset.cat = k;
      el.style.setProperty("--bc", v.c);
      el.innerHTML = `<span class="dot" style="background:${v.c}"></span><span class="nm">${v.label}</span><span class="ct">${MEM.filter((m) => m.cat === k).length}</span>`;
      el.onclick = () => {
        if (hiddenCats.has(k)) hiddenCats.delete(k);
        else hiddenCats.add(k);
        if (focusCat === k && hiddenCats.has(k)) {
          focusCat = null;
          camT = { tx: 0, ty: 0, scale: 1 };
        }
        syncLegends();
        updateStats();
      };
      rowsCat.appendChild(el);
    });
    function syncLegends() {
      rowsCat.querySelectorAll<HTMLElement>(".li").forEach((li) => {
        const cat = li.dataset.cat!;
        li.classList.toggle("on", cat === focusCat && !hiddenCats.has(cat));
        li.classList.toggle("muted", hiddenCats.has(cat));
      });
    }
    const mSealed = q("#mSealed"),
      mLinks = q("#mLinks");

    // ask + answer are handled by the global composer now
    function hideAnswer() {
      q("#mAnswer")?.classList.remove("on");
    }
    function clearQuery() {
      relevant = new Set();
    }
    function updateStats() {
      const kept = MEM.filter((m) => vis(m)).length,
        sealed = MEM.filter((m) => m.seal && vis(m)).length,
        lk = RELS.filter(([a, b]) => vis(byId[a]!) && vis(byId[b]!)).length,
        ver = MEM.filter((m) => m.verified && vis(m)).length;
      const set = (id: string, v: string) => {
        const el = q("#" + id);
        if (el) el.textContent = v;
      };
      set("sKept", String(kept));
      set("sLinks", String(lk));
      set("sSealed", String(sealed));
      set("sSealedU", "/ " + kept);
      set("sRecall", String(Math.round(80 + (ver / Math.max(kept, 1)) * 20)));
      if (mSealed)
        mSealed.textContent =
          Math.round((sealed / Math.max(kept, 1)) * 100) + "%";
      if (mLinks) mLinks.textContent = String(lk);
    }
    // detail card
    const card = q("#mCard")!;
    function openCard(m: M) {
      selectedMem = m;
      killHint();
      hideAnswer();
      m.node!.pulse = 1;
      if (view === "overview") {
        camT.tx = m.node!.x * 0.4;
        camT.ty = m.node!.y * 0.4;
        camT.scale = Math.max(camT.scale, 1.15);
      }
      const cc = q("#cCat")!;
      (cc.querySelector(".d") as HTMLElement).style.background = CATS[m.cat]!.c;
      cc.querySelector(".t")!.textContent = CATS[m.cat]!.label;
      (cc as HTMLElement).style.color = CATS[m.cat]!.c;
      q("#cTtl")!.textContent = m.full;
      const seal = q("#cSeal")!;
      seal.className = "badge2 " + (m.seal ? "sealed" : "plain");
      seal.innerHTML = m.seal ? '<span class="d"></span>Kept close' : "Passing";
      q("#cSrc")!.textContent = m.by;
      (q("#cFeel") as HTMLElement).style.borderColor = hexA(EMO[m.emo]!.c, 0.4);
      const cEmo = q("#cEmo")!;
      cEmo.textContent = m.emo;
      (cEmo as HTMLElement).style.color = EMO[m.emo]!.c;
      q("#cEmoSub")!.textContent = "primary tone";
      const bars = q("#cBars")!;
      bars.innerHTML = "";
      let seed = (parseInt(m.id.replace(/\D/g, "") || "7", 10) || 7) * 97;
      for (let i = 0; i < 22; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        const hgt = 6 + ((seed >> 24) / 255) * 26;
        const bb2 = document.createElement("i");
        bb2.style.height = hgt + "px";
        bb2.style.background = hexA(EMO[m.emo]!.c, 0.35 + (i / 22) * 0.55);
        bars.appendChild(bb2);
      }
      q("#tLinks")!.textContent = String(m.rel!.filter((r) => vis(r.m)).length);
      q("#tDay")!.textContent = m.mem.tags[0] || "note";
      q("#tSeal")!.textContent = m.verified
        ? "verified"
        : m.seal
          ? "kept"
          : "open";
      q("#tBy")!.textContent = m.by;
      const cRel = q("#cRel")!;
      cRel.innerHTML = "";
      const linksv = m.rel!.filter((r) => vis(r.m));
      (q("#cAnalysis") as HTMLElement).style.display = linksv.length
        ? "block"
        : "none";
      linksv.forEach((r) => {
        const it = document.createElement("div");
        it.className = "rel-item";
        it.innerHTML = `<span class="d" style="background:${EMO[r.m.emo]!.c}"></span><span class="t">${r.m.full}</span><span class="lk">${r.why}</span>`;
        it.onmouseenter = () => (r.m.node!.pulse = 1);
        it.onclick = () => openCard(r.m);
        cRel.appendChild(it);
      });
      const bp = q("#bPin")!;
      bp.textContent = m.pinned ? "unpin" : "pin";
      bp.classList.toggle("on", !!m.pinned);
      q("#bForget")!.textContent = m.forgotten ? "restore" : "forget";
      const bv = q("#bVerify")!;
      bv.innerHTML = m.verified ? "verified" : "verify";
      bv.classList.toggle("ok", !!m.verified);
      card.classList.add("on");
    }
    function closeCard() {
      card.classList.remove("on");
      selectedMem = null;
    }
    const cClose = q("#cClose");
    if (cClose) cClose.onclick = closeCard;
    const bVerify = q("#bVerify"),
      bPin = q("#bPin"),
      bForget = q("#bForget");
    if (bVerify)
      bVerify.onclick = () => {
        const m = selectedMem;
        if (!m) return;
        (bVerify as HTMLElement).innerHTML = '<span class="spin"></span>';
        pings.push({
          wx: m.node!.x,
          wy: m.node!.y,
          r: 8,
          a: 0.85,
          c: EMO[m.emo]!.c,
        });
        setTimeout(
          () => {
            m.verified = true;
            (bVerify as HTMLElement).innerHTML = "verified";
            bVerify.classList.add("ok");
            q("#tSeal")!.textContent = "verified";
            pings.push({
              wx: m.node!.x,
              wy: m.node!.y,
              r: 8,
              a: 0.95,
              c: EMO[m.emo]!.c,
            });
            updateStats();
          },
          reduce ? 0 : 850,
        );
      };
    if (bPin)
      bPin.onclick = () => {
        if (!selectedMem) return;
        selectedMem.pinned = !selectedMem.pinned;
        openCard(selectedMem);
      };
    if (bForget)
      bForget.onclick = () => {
        if (!selectedMem) return;
        selectedMem.forgotten = !selectedMem.forgotten;
        if (selectedMem.forgotten) closeCard();
        else openCard(selectedMem);
        updateStats();
        if (view === "detail") buildFan();
      };
    function killHint() {
      const h = q("#mHint");
      if (h) (h as HTMLElement).style.opacity = "0";
    }

    // init
    resize();
    syncLegends();
    updateStats();
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [live, onOpen, theme]);

  return (
    <div ref={rootRef} className="mesh">
      <canvas id="mc" className="mesh-canvas" />

      <div className={"mesh-legends" + (legendOpen ? " open" : "")}>
        <div className="leg panel">
          <div className="lh">legend</div>
          <div id="rowsCat" />
          <div className="ldiv" />
          <div className="metric">
            <span className="ic">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z" />
              </svg>
            </span>
            Sealed
            <span className="pill" id="mSealed">
              0%
            </span>
          </div>
          <div className="metric">
            <span className="ic">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="6" cy="12" r="2.5" />
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="18" cy="18" r="2.5" />
                <path d="M8 11l8-4M8 13l8 4" />
              </svg>
            </span>
            Links
            <span className="pill" id="mLinks">
              0
            </span>
          </div>
        </div>
      </div>

      <div className="peek panel" id="peek">
        <div className="tags" />
        <div className="txt" />
        <div className="meta" />
      </div>

      <div className="mesh-card panel" id="mCard">
        <div className="ch">
          <div className="eyebrow">
            <span className="cat" id="cCat">
              <span className="d" />
              <span className="t" />
            </span>
            <span className="x" id="cClose">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </span>
          </div>
          <div className="ttl" id="cTtl" />
          <div className="badges">
            <span className="badge2" id="cSeal" />
            <span className="src" id="cSrc" />
          </div>
        </div>
        <div className="cb">
          <div className="feel" id="cFeel">
            <div className="lab">Feeling</div>
            <div className="big">
              <span className="e" id="cEmo" />
              <span className="sub" id="cEmoSub" />
            </div>
            <div className="bars" id="cBars" />
          </div>
          <div className="tiles">
            <div className="tile">
              <div className="n" id="tLinks">
                0
              </div>
              <div className="l">Linked memories</div>
            </div>
            <div className="tile">
              <div className="n" id="tDay" />
              <div className="l">Topic</div>
            </div>
            <div className="tile">
              <div className="n" id="tSeal" style={{ fontSize: 13 }} />
              <div className="l">Integrity</div>
            </div>
            <div className="tile">
              <div className="n" id="tBy" style={{ fontSize: 12 }} />
              <div className="l">Source</div>
            </div>
          </div>
          <div className="analysis" id="cAnalysis">
            <div className="ah2">Linked memories</div>
            <div id="cRel" />
          </div>
          <div className="acts">
            <button className="act-btn" id="bVerify">
              verify
            </button>
            <button className="act-btn" id="bPin">
              pin
            </button>
            <button className="act-btn" id="bForget">
              forget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
