"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MotionValue } from "motion/react";
import * as THREE from "three";
import { MANNEQUIN_MODEL_URL } from "./productAssets";

/** The supplied Meshy sculpture, with Blender-baked marble and surface fibres. */
export function Mannequin({ reveal, stimulation }: {
  reveal: MotionValue<number>;
  stimulation: MotionValue<number>;
}) {
  const { scene } = useGLTF(MANNEQUIN_MODEL_URL, "/draco/");
  const root = useRef<THREE.Group>(null);
  const prepared = useMemo(() => {
    const model = scene.clone(true);
    const activity = { value: 0 };
    const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const nerveMeshes: THREE.Mesh[] = [];
    const surfaceMeshes: THREE.Mesh[] = [];
    // Resolve the nearest marble surface before blending its reveal colour.
    // Without this pass, triangles inside the nose, ears and jaw show through
    // one another while opacity is below one, making the scan look fractured.
    const surfaceDepth = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    });
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const prepare = (source: THREE.Material) => {
        const cached = materials.get(source);
        if (cached) return cached;
        // Clone only mutable materials. The loader owns geometry and textures.
        const material = source.clone() as THREE.MeshStandardMaterial;
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
        material.side = THREE.FrontSide;
        const isNerve = source.name === "Purple neural fibres";
        if (isNerve) material.onBeforeCompile = (shader) => {
          shader.uniforms.neuralActivity = activity;
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec2 vNeuralUv;")
            .replace("#include <begin_vertex>", `#include <begin_vertex>
              vNeuralUv = uv;
              // Preserve the fine taper and the existing centre lines.
              transformed += normalize(objectNormal) * 0.00065;
            `);
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec2 vNeuralUv;\nuniform float neuralActivity;")
            .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
              // Blender stores continuous distance from the ear in each fibre's u.
              // Unreached fragments do not draw, including their unlit geometry.
              float growth = smoothstep(vNeuralUv.x - 0.016, vNeuralUv.x + 0.016, neuralActivity);
              if (neuralActivity < 0.003 || growth < 0.008) discard;
              diffuseColor.a *= growth;
              float tip = exp(-pow((neuralActivity - vNeuralUv.x) / 0.045, 2.0));
              tip *= 1.0 - smoothstep(0.94, 1.0, neuralActivity);
              // Two scroll-driven waves pass through the already grown arbors.
              // Varying fibre energy keeps quiet connections between bright regions.
              float wavePhase = neuralActivity * 2.1 - vNeuralUv.x * 1.5;
              float wave = pow(0.5 + 0.5 * cos(wavePhase * 6.283185), 6.0);
              float energy = mix(0.45, 1.0, vNeuralUv.y);
              float facing = max(dot(normal, normalize(vViewPosition)), 0.0);
              float core = pow(facing, 1.6);
              // A rounded light profile gives each fibre depth: a pale core
              // surrounded by violet, rather than a uniformly coloured stroke.
              vec3 violetLight = mix(vec3(0.12, 0.018, 0.65), vec3(0.30, 0.11, 1.0), core * 0.55);
              diffuseColor.rgb = vec3(0.028, 0.012, 0.065);
              totalEmissiveRadiance = violetLight * (0.55 + core * 0.7) * energy * (2.4 + 1.2 * neuralActivity + tip * 2.2 + wave * 1.8);
            `);
        };
        material.customProgramCacheKey = () => isNerve ? "cymba-organic-activation-v4" : "cymba-clean-marble-v1";
        materials.set(source, material);
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prepare) : prepare(mesh.material);
      const isNerveMesh = mesh.name.includes("Fibres");
      mesh.renderOrder = isNerveMesh ? 2 : 1;
      if (isNerveMesh) { mesh.visible = false; nerveMeshes.push(mesh); }
      else surfaceMeshes.push(mesh);
    });
    // Add after traversal so the depth-only copies are never prepared as
    // colour materials. Geometry and transforms exactly match the surface.
    for (const mesh of surfaceMeshes) {
      const depthMesh = new THREE.Mesh(mesh.geometry, surfaceDepth);
      depthMesh.name = `${mesh.name}_RevealDepth`;
      depthMesh.position.copy(mesh.position);
      depthMesh.quaternion.copy(mesh.quaternion);
      depthMesh.scale.copy(mesh.scale);
      depthMesh.matrix.copy(mesh.matrix);
      depthMesh.matrixAutoUpdate = mesh.matrixAutoUpdate;
      depthMesh.renderOrder = -1;
      mesh.parent?.add(depthMesh);
    }
    return { model, materials: [...materials.values()], surfaceDepth, nerveMeshes, activity };
  }, [scene]);

  useEffect(() => () => {
    prepared.materials.forEach((material) => material.dispose());
    prepared.surfaceDepth.dispose();
  }, [prepared]);

  useFrame((_, delta) => {
    const visibility = THREE.MathUtils.clamp(reveal.get(), 0, 1);
    if (root.current) root.current.visible = visibility > 0.001;
    const targetActivity = THREE.MathUtils.clamp(stimulation.get(), 0, 1);
    prepared.activity.value = THREE.MathUtils.damp(prepared.activity.value, targetActivity, 12, Math.min(delta, 0.1));
    if (Math.abs(prepared.activity.value - targetActivity) < 0.0001) prepared.activity.value = targetActivity;
    for (const mesh of prepared.nerveMeshes) mesh.visible = prepared.activity.value >= 0.003;
    for (const material of prepared.materials) {
      material.opacity = visibility;
    }
  });

  return <group ref={root} visible={false} dispose={null}>
    <primitive object={prepared.model} dispose={null} />
  </group>;
}
