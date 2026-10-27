"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type MotionValue } from "motion/react";
import * as THREE from "three";
import { MANNEQUIN_AO_URL, MANNEQUIN_STONE_NORMAL_URL, MANNEQUIN_STONE_ROUGHNESS_URL, MANNEQUIN_MODEL_URL } from "./productAssets";

/** The supplied Meshy sculpture, with Blender-baked marble and surface fibres. */
export function Mannequin({ reveal, stimulation, stimulationVisibility }: {
  reveal: MotionValue<number>;
  stimulation: MotionValue<number>;
  stimulationVisibility?: MotionValue<number>;
}) {
  const { scene } = useGLTF(MANNEQUIN_MODEL_URL, "/draco/");
  const occlusion = useTexture(MANNEQUIN_AO_URL);
  const stoneNormal = useTexture(MANNEQUIN_STONE_NORMAL_URL);
  const stoneRoughness = useTexture(MANNEQUIN_STONE_ROUGHNESS_URL);
  const root = useRef<THREE.Group>(null);
  const prepared = useMemo(() => {
    // Surface relief and cavity shading are baked to the original UV0.
    for (const texture of [occlusion, stoneNormal, stoneRoughness]) {
      texture.flipY = false;
      texture.channel = 0;
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
    }
    const model = scene.clone(true);
    const activity = { value: 0 };
    const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const nerveMaterials = new Set<THREE.MeshStandardMaterial>();
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
        if (isNerve) {
          nerveMaterials.add(material);
          material.roughness = 0.46;
          material.metalness = 0;
        } else {
          // Unveined white stone: the texture changes surface relief and sheen.
          material.map = null;
          material.color.set("#faf9f6");
          material.envMapIntensity = 0.6;
          material.normalMap = stoneNormal;
          material.normalScale.setScalar(0.65);
          material.roughnessMap = stoneRoughness;
          material.roughness = 1;
          material.metalness = 0;
          material.metalnessMap = null;
          material.aoMap = occlusion;
          material.aoMapIntensity = 0.65;
        }
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
              float energy = mix(0.72, 1.0, vNeuralUv.y);
              float facing = max(dot(normal, normalize(vViewPosition)), 0.0);
              float core = pow(facing, 2.0);
              // Keep a violet body and a narrow rounded highlight. Excessive
              // emission washed the fine branches into pale lines on white.
              vec3 violetLight = mix(vec3(0.055, 0.008, 0.24), vec3(0.18, 0.035, 0.72), core);
              diffuseColor.rgb = vec3(0.045, 0.009, 0.105);
              totalEmissiveRadiance = violetLight * energy * (1.45 + 0.35 * neuralActivity + tip * 1.25 + wave * 0.55);
            `);
        };
        material.customProgramCacheKey = () => isNerve ? "cymba-organic-activation-v5" : "cymba-textured-white-stone-v1";
        materials.set(source, material);
        return material;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(prepare) : prepare(mesh.material);
      const isNerveMesh = mesh.name.includes("Fibres");
      // Only the stone casts and receives the key light's self-shadow.
      mesh.castShadow = !isNerveMesh;
      mesh.receiveShadow = !isNerveMesh;
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
    // Keep the shadow at the sculpture's contact point on an invisible floor.
    // The receiver turns with the model so the contact patch stays under its base.
    const shadowY = new THREE.Box3().setFromObject(model).min.y - 0.015;
    const shadowGeometry = new THREE.PlaneGeometry(3, 3);
    const shadowMaterial = new THREE.ShadowMaterial({
      color: "#26242a",
      opacity: 0,
      depthWrite: false,
    });
    shadowMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGroundPosition;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGroundPosition = position.xy;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGroundPosition;")
        // Soften the floor independently of the sculpture's surface shadows.
        .replace("#include <shadowmask_pars_fragment>", THREE.ShaderChunk.shadowmask_pars_fragment.replace("directionalLight.shadowRadius,", "directionalLight.shadowRadius * 6.0,"))
        .replace("#include <tonemapping_fragment>", `
          // Plane-local Y maps to model -Z. Centre the soft patch on the lowest stone.
          float contactRadius = length((vGroundPosition - vec2(0.0, -0.36)) / vec2(0.85, 0.32));
          float edgeFade = 1.0 - smoothstep(0.45, 1.0, contactRadius);
          gl_FragColor.a *= edgeFade;
          #include <tonemapping_fragment>
        `);
    };
    shadowMaterial.customProgramCacheKey = () => "cymba-contact-shadow-v2";
    return { model, materials: [...materials.values()], nerveMaterials, surfaceDepth, nerveMeshes, activity, shadowY, shadowGeometry, shadowMaterial };
  }, [scene, occlusion, stoneNormal, stoneRoughness]);

  useEffect(() => () => {
    prepared.materials.forEach((material) => material.dispose());
    prepared.surfaceDepth.dispose();
    prepared.shadowGeometry.dispose();
    prepared.shadowMaterial.dispose();
  }, [prepared]);

  useFrame((_, delta) => {
    const visibility = THREE.MathUtils.clamp(reveal.get(), 0, 1);
    if (root.current) root.current.visible = visibility > 0.001;
    prepared.shadowMaterial.opacity = visibility * 0.19;
    const targetActivity = THREE.MathUtils.clamp(stimulation.get(), 0, 1);
    const signalVisibility = THREE.MathUtils.clamp(stimulationVisibility?.get() ?? 1, 0, 1);
    prepared.activity.value = THREE.MathUtils.damp(prepared.activity.value, targetActivity, 12, Math.min(delta, 0.1));
    if (Math.abs(prepared.activity.value - targetActivity) < 0.0001) prepared.activity.value = targetActivity;
    for (const mesh of prepared.nerveMeshes) mesh.visible = prepared.activity.value >= 0.003 && signalVisibility > 0.001;
    for (const material of prepared.materials) {
      material.opacity = visibility * (prepared.nerveMaterials.has(material) ? signalVisibility : 1);
    }
  });

  return <group ref={root} visible={false} dispose={null}>
    <mesh
      name="Sculpture contact shadow"
      geometry={prepared.shadowGeometry}
      material={prepared.shadowMaterial}
      position={[0, prepared.shadowY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      renderOrder={0}
    />
    <primitive object={prepared.model} dispose={null} />
  </group>;
}
