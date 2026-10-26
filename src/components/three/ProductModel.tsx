"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, forwardRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { Bud } from "./Bud";

/*
 * The product, from whichever source exists:
 *   - the complete wired assembly web export (Draco-compressed), or
 *   - the code-built Bud until then.
 *
 * A loaded model is centred and scaled so its largest dimension matches
 * TARGET_SIZE, which keeps it in the same frame as the Bud, so the camera
 * moves on the page need little retuning when the file arrives.
 */

/** The whole assembly is 5.2 scene units wide; camera anchors use this scale. */
export const TARGET_SIZE = 5.2;

type Focus = { name: string; contextOpacity: MotionValue<number> };

function Sculpted({ url, focus }: { url: string; focus?: Focus }) {
  const { scene } = useGLTF(url, "/draco/");
  const normalised = useMemo(() => {
    const clone = scene.clone(true);
    // glTF is Y-up. Present the Blender tabletop arrangement upright to the camera.
    clone.rotation.x += Math.PI / 2;
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z);
    clone.position.sub(centre).multiplyScalar(scale);
    clone.scale.setScalar(scale);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const context: { mesh: THREE.Mesh; materials: { material: THREE.Material; opacity: number; transparent: boolean; depthWrite: boolean }[] }[] = [];
    if (focus) {
      clone.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.name === focus.name || mesh.name === focus.name.replaceAll(" ", "_")) return;
        // Only clone materials being faded; cached geometry and textures remain shared.
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((original) => {
          const material = original.clone();
          return { material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite };
        });
        mesh.material = Array.isArray(mesh.material) ? materials.map((m) => m.material) : materials[0].material;
        context.push({ mesh, materials });
      });
    }
    return { clone, context };
  }, [scene, focus?.name]);
  useEffect(() => () => {
    normalised.context.forEach(({ materials }) => materials.forEach(({ material }) => material.dispose()));
  }, [normalised]);
  const lastOpacity = useRef(-1);
  useFrame(() => {
    const opacity = focus?.contextOpacity.get() ?? 1;
    if (opacity === lastOpacity.current) return;
    lastOpacity.current = opacity;
    normalised.context.forEach(({ mesh, materials }) => {
      mesh.visible = opacity > 0.001;
      materials.forEach(({ material, opacity: originalOpacity, transparent, depthWrite }) => {
        const fading = opacity < 0.999;
        const nextTransparent = transparent || fading;
        if (material.transparent !== nextTransparent) {
          material.transparent = nextTransparent;
          material.needsUpdate = true;
        }
        material.opacity = originalOpacity * opacity;
        material.depthWrite = depthWrite && !fading;
      });
    });
  });
  return <primitive object={normalised.clone} dispose={null} />;
}

/** Mounts once the model it sits next to has resolved, and says so. */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}

export const ProductModel = forwardRef<
  THREE.Group,
  {
    modelUrl: string | null;
    rotation?: [number, number, number];
    /** Show the code-built bud while the file loads (default). Turn off when a poster covers the canvas. */
    placeholder?: boolean;
    onReady?: () => void;
    focus?: Focus;
  }
>(function ProductModel({ modelUrl, rotation = [0.12, 0.9, 0], placeholder = true, onReady, focus }, ref) {
  const inner = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (typeof ref === "function") ref(inner.current);
    else if (ref) ref.current = inner.current;
  });
  return (
    <group ref={inner} rotation={rotation}>
      {modelUrl ? (
        <Suspense fallback={placeholder ? <Bud /> : null}>
          <Sculpted url={modelUrl} focus={focus} />
          <Ready onReady={onReady} />
        </Suspense>
      ) : (
        <>
          <Bud />
          <Ready onReady={onReady} />
        </>
      )}
    </group>
  );
});

/** Call ahead of time so the model is cached before its section scrolls into view. */
export function preloadProductModel(url: string | null) {
  if (url) useGLTF.preload(url, "/draco/");
}
