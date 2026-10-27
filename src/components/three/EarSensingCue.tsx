"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type MotionValue } from "motion/react";
import * as THREE from "three";

const ease = (a: number, b: number, value: number) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** An illustrative sensing cue at the seated earbuds, driven only by scroll. */
export function EarSensingCue({ progress, reveal }: {
  progress: MotionValue<number>;
  reveal: MotionValue<number>;
}) {
  const root = useRef<THREE.Group>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  // Keep a roughly one-pixel stroke in the compact mobile model frame.
  const geometry = useMemo(() => new THREE.TorusGeometry(0.24, 0.012, 8, 64), []);
  const materials = useMemo(() => [0, 1].map(() => new THREE.MeshBasicMaterial({
    color: "#3f898b",
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  })), []);

  useEffect(() => () => {
    geometry.dispose();
    materials.forEach((material) => material.dispose());
  }, [geometry, materials]);

  useFrame(() => {
    const p = progress.get();
    const sensing = ease(0.46, 0.49, p) * (1 - ease(0.56, 0.595, p));
    const visibility = sensing * THREE.MathUtils.clamp(reveal.get(), 0, 1);
    if (root.current) root.current.visible = visibility > 0.001;
    const expansion = ease(0.46, 0.595, p);
    materials[0].opacity = visibility * 0.80;
    materials[1].opacity = visibility * 0.56;
    rings.current.forEach((ring, index) => {
      const size = index % 2 === 0 ? 0.78 : 1.14;
      ring?.scale.setScalar(size + expansion * 0.20);
    });
  });

  return <group ref={root} visible={false} dispose={null}>
    {[-1, 1].map((side, earIndex) => (
      <group key={side} position={[side * 1.18, -0.04, 0.52]} rotation={[0, side * 0.55, 0]}>
        {materials.map((material, ringIndex) => (
          <mesh
            key={ringIndex}
            ref={(mesh) => { rings.current[earIndex * 2 + ringIndex] = mesh; }}
            geometry={geometry}
            material={material}
            renderOrder={3}
          />
        ))}
      </group>
    ))}
  </group>;
}
