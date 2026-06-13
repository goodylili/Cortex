"use client";
import { useMemo, useRef, useState } from "react";
import { useCortex } from "@/lib/cortex/store";
import { ago, type Memory } from "@/lib/cortex/logic";

const TAG_COLOR: Record<string, string> = {
  work: "#58A6FF", travel: "#3FB950", people: "#F778BA", habits: "#D6A53B",
  ideas: "#B79BEA", reading: "#7FD0A0", money: "#E0B760", health: "#5CD6C0", note: "#9b8cff", file: "#8B8B95",
};
const clusterName = (tag: string) => ({
  work: "Work & projects", travel: "Travel", people: "People", habits: "Habits & routines",
  ideas: "Ideas", reading: "Reading", money: "Money", health: "Health", note: "Notes", file: "Files",
}[tag] || tag);

const W = 1200, H = 760, CX = W / 2, CY = H / 2, R1 = 235, R2 = 150;
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export default function MemoryMap({ onOpen }: { onOpen: (m: Memory) => void }) {
  const liveFn = useCortex((s) => s.live);
  const live = liveFn();
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<Memory | null>(null);
  const [vt, setVt] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const clusters = useMemo(() => {
    const by: Record<string, Memory[]> = {};
    live.forEach((m) => { const t = m.tags[0] || "note"; (by[t] ||= []).push(m); });
    const entries = Object.entries(by).sort((a, b) => b[1].length - a[1].length);
    const n = entries.length;
    return entries.map(([tag, mems], i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = CX + R1 * Math.cos(a), y = CY + R1 * Math.sin(a);
      const span = Math.min((2 * Math.PI) / n * 0.92, 1.7), m = mems.length;
      const leaves = mems.map((mem, j) => {
        const la = a + (m === 1 ? 0 : (j / (m - 1) - 0.5) * span);
        return { mem, x: x + R2 * Math.cos(la), y: y + R2 * Math.sin(la), right: Math.cos(la) >= 0 };
      });
      return { tag, mems, x, y, leaves, color: TAG_COLOR[tag] || "#9b8cff" };
    });
  }, [live]);

  function onWheel(e: React.WheelEvent) { e.preventDefault(); const k = Math.min(2.4, Math.max(0.5, vt.k * (e.deltaY < 0 ? 1.12 : 0.89))); setVt((v) => ({ ...v, k })); }
  function onDown(e: React.MouseEvent) { drag.current = { x: e.clientX, y: e.clientY, vx: vt.x, vy: vt.y }; }
  function onMove(e: React.MouseEvent) { if (!drag.current) return; setVt((v) => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x), y: drag.current!.vy + (e.clientY - drag.current!.y) })); }
  function onUp() { drag.current = null; }
  const leafColor = (m: Memory) => (m.kept ? "#7FD0A0" : m.noticed ? "#B79BEA" : m.importance === "high" ? "#D6A53B" : "#8B8B95");

  return (
    <div className="map-wrap" onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ cursor: drag.current ? "grabbing" : "grab" }}>
        <g transform={`translate(${vt.x} ${vt.y}) scale(${vt.k})`} style={{ transformOrigin: "center" }}>
          {/* membership + leaf edges */}
          {clusters.map((c) => {
            const dim = sel && sel !== c.tag ? 0.12 : 0.5;
            return (
              <g key={"e" + c.tag}>
                <path d={`M ${CX} ${CY} Q ${(CX + c.x) / 2} ${(CY + c.y) / 2}, ${c.x} ${c.y}`} stroke={c.color} strokeWidth={1.6} fill="none" opacity={dim} />
                {c.leaves.map(({ mem, x, y }) => <path key={mem.id} d={`M ${c.x} ${c.y} Q ${(c.x + x) / 2} ${(c.y + y) / 2}, ${x} ${y}`} stroke={c.color} strokeWidth={1} fill="none" opacity={dim * 0.6} />)}
              </g>
            );
          })}
          {/* centre */}
          <circle cx={CX} cy={CY} r={42} fill="rgba(124,92,214,.14)" stroke="rgba(124,92,214,.55)" strokeWidth={1.4} />
          <text x={CX} y={CY - 2} textAnchor="middle" fill="#c9b8ff" fontSize={12} fontFamily="var(--sans)">your memory</text>
          <text x={CX} y={CY + 13} textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize={10} fontFamily="var(--mono, monospace)">{live.length} kept</text>
          {/* clusters */}
          {clusters.map((c) => {
            const dim = sel && sel !== c.tag ? 0.28 : 1;
            return (
              <g key={c.tag} opacity={dim}>
                <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setSel((s) => (s === c.tag ? null : c.tag)); }}>
                  <rect x={c.x - 82} y={c.y - 20} width={164} height={40} rx={8} fill="#141417" stroke={c.color} strokeWidth={sel === c.tag ? 1.8 : 1.2} />
                  <text x={c.x} y={c.y - 2} textAnchor="middle" fill="#fff" fontSize={12} fontFamily="var(--sans)">{trunc(clusterName(c.tag), 22)}</text>
                  <text x={c.x} y={c.y + 12} textAnchor="middle" fill={c.color} fontSize={9} fontFamily="var(--mono, monospace)">{c.mems.length} {c.mems.length === 1 ? "memory" : "memories"}</text>
                </g>
                {c.leaves.map(({ mem, x, y, right }) => (
                  <g key={mem.id} style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHover(mem)} onMouseLeave={() => setHover((h) => (h === mem ? null : h))}
                    onClick={(e) => { e.stopPropagation(); onOpen(mem); }}>
                    <circle cx={x} cy={y} r={hover === mem ? 7 : 5} fill={leafColor(mem)} stroke="#2a2a30" strokeWidth={1} />
                    <text x={x + (right ? 10 : -10)} y={y - 3} textAnchor={right ? "start" : "end"} fill={c.color} fontSize={9.5} fontFamily="var(--mono, monospace)">{mem.tags[0]}</text>
                    <text x={x + (right ? 10 : -10)} y={y + 9} textAnchor={right ? "start" : "end"} fill="rgba(255,255,255,.55)" fontSize={9} fontFamily="var(--mono, monospace)">{trunc(mem.text, 26)}</text>
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (
        <div className="map-tip"><div className="mt-text">{hover.text}</div><div className="mt-meta">{hover.tags.join(" · ")} · {ago(hover.ts)}{hover.kept ? " · kept close" : hover.noticed ? " · noticed by Cortex" : ""}</div></div>
      )}
      <div className="map-legend">
        <span><i style={{ background: "#7FD0A0" }} />kept close</span>
        <span><i style={{ background: "#B79BEA" }} />noticed by Cortex</span>
        <span><i style={{ background: "#D6A53B" }} />important</span>
        <span><i style={{ background: "#8B8B95" }} />held</span>
        <span className="lg-hint">drag to pan · scroll to zoom · click a node to open</span>
      </div>
    </div>
  );
}
