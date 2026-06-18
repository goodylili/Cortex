"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const BRAIN_MODEL = "/models/brain.glb";

const NODE_COLORS = [
  "#c9b8ff",
  "#b79bea",
  "#9b8cff",
  "#7fd0a0",
  "#e0b760",
  "#f778ba",
];
const NODE_COUNT = 18;

// The anatomical human brain at the centre, slowly turning on its axis.
function Brain() {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(BRAIN_MODEL);

  // Clone so the cached scene isn't mutated, and re-skin every mesh with a
  // polished lavender-chrome metal that catches the lights as it turns.
  const model = useMemo(() => {
    const root = scene.clone(true);
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#c2b2e6"),
      metalness: 1,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      iridescence: 0.4,
      iridescenceIOR: 1.5,
      emissive: new THREE.Color("#241b3f"),
      emissiveIntensity: 0.12,
      envMapIntensity: 2,
    });
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        // Smooth out the low-poly facets into soft, continuous gyri.
        mesh.geometry.deleteAttribute("normal");
        mesh.geometry.computeVertexNormals();
        mesh.material = material;
      }
    });
    // Auto-fit: normalise the model to a fixed size and recentre at the origin
    // so it frames consistently whatever its native scale.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    root.scale.setScalar(3.6 / maxDim);
    const center = new THREE.Box3()
      .setFromObject(root)
      .getCenter(new THREE.Vector3());
    root.position.sub(center);
    return root;
  }, [scene]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.35;
  });

  return (
    <group ref={ref} rotation={[0.18, 0, 0]}>
      <primitive object={model} />
    </group>
  );
}

// Memory nodes scattered on a sphere via the golden angle, gently bobbing.
function Nodes() {
  const placed = useMemo(() => {
    const r = 2.7;
    return Array.from({ length: NODE_COUNT }, (_, i) => {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * 2.399963;
      const pos: [number, number, number] = [
        Math.cos(theta) * rad * r,
        y * r,
        Math.sin(theta) * rad * r,
      ];
      return {
        pos,
        color: NODE_COLORS[i % NODE_COLORS.length]!,
        scale: 0.7 + (i % 3) * 0.3,
      };
    });
  }, []);
  return (
    <group>
      {placed.map(({ pos, color, scale }, i) => (
        <Float key={i} speed={1.6} rotationIntensity={0.4} floatIntensity={1.2}>
          <mesh position={pos} scale={scale}>
            <sphereGeometry args={[0.07, 20, 20]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.6}
              toneMapped={false}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

export function BrainOrb() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6.6], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[5, 5, 5]} intensity={48} color="#c9b8ff" />
      <pointLight position={[-5, -3, -4]} intensity={30} color="#d98e63" />
      <pointLight position={[0, 4, -5]} intensity={24} color="#f778ba" />
      <Suspense fallback={null}>
        <Brain />
        <Nodes />
        <Environment preset="night" />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}

useGLTF.preload(BRAIN_MODEL);
