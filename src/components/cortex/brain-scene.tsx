"use client";
import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  MeshDistortMaterial,
  Icosahedron,
  Html,
  Float,
} from "@react-three/drei";
import * as THREE from "three";
import { useCortex } from "@/lib/cortex/store";
import { ago, type Memory } from "@/lib/cortex/logic";

const TAG_COLOR: Record<string, string> = {
  work: "#58A6FF",
  travel: "#3FB950",
  people: "#F778BA",
  habits: "#D6A53B",
  ideas: "#B79BEA",
  reading: "#7FD0A0",
  money: "#E0B760",
  note: "#9b8cff",
};

// the iridescent, fluid central mass — the "mind"
function Mind() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });
  return (
    <Icosahedron ref={ref} args={[1.5, 48]}>
      {/* MeshDistortMaterial extends MeshPhysicalMaterial → iridescence works */}
      <MeshDistortMaterial
        distort={0.42}
        speed={1.4}
        roughness={0.05}
        metalness={0.2}
        iridescence={1}
        iridescenceIOR={1.6}
        clearcoat={1}
        clearcoatRoughness={0}
        color="#c9b8ff"
        envMapIntensity={1.5}
      />
    </Icosahedron>
  );
}

// one memory, floating around the mind as a glowing node
function Node({
  memory,
  pos,
  onOpen,
}: {
  memory: Memory;
  pos: [number, number, number];
  onOpen: (m: Memory) => void;
}) {
  const [hover, setHover] = useState(false);
  const color = TAG_COLOR[memory.tags[0] || "note"] || "#9b8cff";
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.8}>
      <group position={pos}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(memory);
          }}
          scale={hover ? 1.7 : memory.kept ? 1.2 : 1}
        >
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={hover ? 2.4 : 1.2}
            toneMapped={false}
          />
        </mesh>
        {hover && (
          <Html distanceFactor={9} position={[0, 0.18, 0]} center>
            <div
              style={{
                background: "rgba(10,10,10,.92)",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                width: 200,
                lineHeight: 1.45,
                border: "1px solid #2e2e2e",
                pointerEvents: "none",
              }}
            >
              <div>
                {memory.text.length > 90
                  ? memory.text.slice(0, 90) + "…"
                  : memory.text}
              </div>
              <div style={{ opacity: 0.6, marginTop: 4, fontSize: 11 }}>
                {memory.tags[0]} · {ago(memory.ts)}
              </div>
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}

function Nodes({
  memories,
  onOpen,
}: {
  memories: Memory[];
  onOpen: (m: Memory) => void;
}) {
  const placed = useMemo(() => {
    const n = memories.length,
      r = 2.7;
    return memories.map((m, i) => {
      const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * 2.399963; // golden angle
      const pos: [number, number, number] = [
        Math.cos(theta) * rad * r,
        y * r,
        Math.sin(theta) * rad * r,
      ];
      return { m, pos };
    });
  }, [memories]);
  return (
    <>
      {placed.map(({ m, pos }) => (
        <Node key={m.id} memory={m} pos={pos} onOpen={onOpen} />
      ))}
    </>
  );
}

export function BrainScene({ onOpen }: { onOpen: (m: Memory) => void }) {
  const liveFn = useCortex((s) => s.live);
  const mems = liveFn();
  return (
    <Canvas
      camera={{ position: [0, 0, 6.5], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#050505"]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={45} color="#b79bea" />
      <pointLight position={[-5, -3, -4]} intensity={32} color="#d98e63" />
      <Suspense fallback={null}>
        <Mind />
        <Nodes memories={mems} onOpen={onOpen} />
        <Environment preset="night" />
      </Suspense>
      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        minDistance={4}
        maxDistance={11}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
