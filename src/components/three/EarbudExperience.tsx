"use client";

import { Suspense, useEffect, useMemo, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMotionValue, type MotionValue } from "motion/react";
import { Mannequin } from "./Mannequin";
import { EarSensingCue } from "./EarSensingCue";
import { smoothEarbudNormals } from "./smoothEarbudNormals";
import sleeveRim from "./earbudSleeveRim.json";
import { preloadMannequin } from "./productAssets";
import { AssetLoading } from "./Scene";

const CABLE_RADIUS = 0.036;
// Measured in the normalized earbud's sleeve, on its slanted end face.
const SLEEVE_END = new THREE.Vector3(0.02178, -0.45850, 0.10645);
const SLEEVE_AXIS = new THREE.Vector3(0.55, -0.83, 0.06).normalize();
const OUTLET = SLEEVE_END.clone().addScaledVector(SLEEVE_AXIS, 0.014);

const ease = (a: number, b: number, value: number) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function prepareEarbud(scene: THREE.Group, side: "L" | "R") {
  scene.updateMatrixWorld(true);
  let source: THREE.Object3D | undefined;
  scene.traverse((object) => {
    const name = String(object.userData.name ?? object.name);
    if ((object as THREE.Mesh).isMesh && name.includes("Earbud") && new RegExp(`(?:_| )${side}(?:_| )`).test(name)) source = object;
  });
  if (!source) throw new Error(`The ${side} earbud is missing from the product model.`);
  const mesh = source.clone(true);
  source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
  const oriented = new THREE.Group();
  oriented.rotation.x = Math.PI / 2;
  oriented.add(mesh);
  oriented.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(oriented, true);
  const scale = 1 / box.getSize(new THREE.Vector3()).y;
  oriented.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
  oriented.scale.setScalar(scale);
  oriented.updateMatrixWorld(true);
  // Remove the scanned cable stump at the actual angled sleeve opening.
  // Restrict the cut to the lower sleeve so the silicone tip is untouched.
  // Source geometry and textures remain cache-owned and unchanged.
  oriented.traverse((object) => {
    const part = object as THREE.Mesh;
    if (!part.isMesh) return;
    part.geometry = smoothEarbudNormals(part.geometry);
    const sign = side === "L" ? 1 : -1;
    const centre = new THREE.Vector3(sign * SLEEVE_END.x, SLEEVE_END.y, SLEEVE_END.z);
    const inward = new THREE.Vector3(-sign * SLEEVE_AXIS.x, -SLEEVE_AXIS.y, -SLEEVE_AXIS.z);
    const inverse = part.matrixWorld.clone().invert();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(inward, centre).applyMatrix4(inverse);
    const region = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.30).applyMatrix4(inverse);
    const trim = (sourceMaterial: THREE.Material) => {
      const material = sourceMaterial instanceof THREE.MeshStandardMaterial
        ? new THREE.MeshPhysicalMaterial() : sourceMaterial.clone();
      if (material instanceof THREE.MeshPhysicalMaterial && sourceMaterial instanceof THREE.MeshStandardMaterial) {
        THREE.MeshStandardMaterial.prototype.copy.call(material, sourceMaterial);
        material.defines = { STANDARD: "", PHYSICAL: "" };
        material.transmission = 0.78;
        material.thickness = 0.028 / part.matrixWorld.getMaxScaleOnAxis();
        material.attenuationColor.set("#d5d8d5");
        material.attenuationDistance = 0.75;
      }
      // Keep the original colour and reflectivity, but remove the scanned
      // normal map that gives the shell its scratched, etched surface.
      if (material instanceof THREE.MeshStandardMaterial) material.normalMap = null;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.sleeveTrimPlane = { value: new THREE.Vector4(...plane.normal.toArray(), plane.constant) };
        shader.uniforms.sleeveTrimRegion = { value: new THREE.Vector4(...region.normal.toArray(), region.constant) };
        shader.uniforms.siliconeColor = { value: new THREE.Color("#b8bdb9") };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nuniform vec4 sleeveTrimPlane;\nuniform vec4 sleeveTrimRegion;\nvarying vec2 vSleeveTrim;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSleeveTrim = vec2(dot(sleeveTrimPlane, vec4(position, 1.0)), dot(sleeveTrimRegion, vec4(position, 1.0)));");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec2 vSleeveTrim;\nuniform vec3 siliconeColor;")
          .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vSleeveTrim.x < 0.0 && vSleeveTrim.y < 0.0) discard;")
          // The source atlas separates the cool-grey tips from the warm metal
          // and black housing. Use that mask before changing any surface colour.
          .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
            vec3 tipSource = sRGBTransferOETF(vec4(diffuseColor.rgb, 1.0)).rgb;
            float tipLuma = dot(tipSource, vec3(0.2126, 0.7152, 0.0722));
            float siliconeMask = smoothstep(0.012, 0.04, tipSource.b - tipSource.r) * smoothstep(0.12, 0.25, tipLuma);
            vec3 softSilicone = siliconeColor * mix(0.95, 1.04, smoothstep(0.18, 0.65, tipLuma));
            diffuseColor.rgb = mix(diffuseColor.rgb, softSilicone, siliconeMask);
            roughnessFactor = mix(roughnessFactor, 0.38, siliconeMask);
            metalnessFactor = mix(metalnessFactor, 0.0, siliconeMask);
          `)
          .replace("#include <lights_physical_fragment>", THREE.ShaderChunk.lights_physical_fragment
            .replace("material.ior = ior;", "material.ior = mix(ior, 1.41, siliconeMask);"))
          .replace("#include <transmission_fragment>", THREE.ShaderChunk.transmission_fragment
            .replace("material.transmission = transmission;", "material.transmission = transmission * siliconeMask;"));
      };
      material.customProgramCacheKey = () => "cymba-sleeve-trim-translucent-silicone-v8";
      return material;
    };
    part.material = Array.isArray(part.material) ? part.material.map(trim) : trim(part.material);
  });
  return oriented;
}

/** A flush end cap on the existing sleeve, with the cable seated in its centre. */
function CableSleeve({ side }: { side: "L" | "R" }) {
  const geometry = useMemo(() => {
    const sign = side === "L" ? 1 : -1;
    const centre = new THREE.Vector3(sign * SLEEVE_END.x, SLEEVE_END.y, SLEEVE_END.z);
    const axis = new THREE.Vector3(sign * SLEEVE_AXIS.x, SLEEVE_AXIS.y, SLEEVE_AXIS.z);
    const normal = new THREE.Vector3(-axis.y, axis.x, 0).normalize();
    const binormal = new THREE.Vector3().crossVectors(axis, normal).normalize();
    // This shallow rolled rim replaces only the damaged end of the scan.
    // Its face is perpendicular to the sleeve, rather than the screen.
    const profile = [
      [-0.007, 0.015], [0, 0], [0.005, 0.03], [0.010, 0.10],
      [0.015, 0.24], [0.018, 0.52], [0.018, 0.84], [0.014, 1], [0.004, 1],
    ];
    // Reuse the measured cut contour so the rim meets the scan precisely
    // instead of leaving the overlap/gap produced by an approximate ellipse.
    const contour = sleeveRim.samples.map(([u, v]) => [sign * u, v])
      .sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    const positions: number[] = [], indices: number[] = [];
    const rows = profile.length - 1, sides = contour.length;
    profile.forEach(([distance, blend], row) => {
      const ring = centre.clone().addScaledVector(axis, distance);
      for (let col = 0; col <= sides; col++) {
        const [u, v] = contour[col % sides];
        const outerRadius = Math.hypot(u, v);
        const ratio = THREE.MathUtils.lerp(outerRadius, CABLE_RADIUS + 0.0003, blend) / outerRadius;
        const point = ring.clone().addScaledVector(normal, u * ratio).addScaledVector(binormal, v * ratio);
        positions.push(point.x, point.y, point.z);
        if (row < rows && col < sides) {
          const a = row * (sides + 1) + col, b = a + sides + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    });
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    // Share the normal across the duplicated UV seam for a continuous finish.
    const normals = result.getAttribute("normal") as THREE.BufferAttribute;
    const average = new THREE.Vector3();
    for (let row = 0; row <= rows; row++) {
      const first = row * (sides + 1), last = first + sides;
      average.fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
      normals.setXYZ(first, average.x, average.y, average.z);
      normals.setXYZ(last, average.x, average.y, average.z);
    }
    return result;
  }, [side]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: "#181a1c", roughness: 0.48, metalness: 0.02 }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <mesh geometry={geometry} material={material} />;
}

/** The socket follows the product, while the cable hangs vertically under gravity. */
function TrailingCable({ side, anchor }: { side: "L" | "R"; anchor: RefObject<THREE.Group | null> }) {
  const cable = useRef<THREE.Mesh>(null);
  const { geometry, lastTransform, socketOffset } = useMemo(() => {
    // The cable is straight, so two rings describe the same surface as 97.
    // Fade still interpolates continuously along uv.x in the fragment shader.
    const geometry = new THREE.TubeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(), new THREE.Vector3(0, -2.42, 0),
    ), 1, CABLE_RADIUS, 16, false);
    const sign = side === "L" ? 1 : -1;
    const localTangent = new THREE.Vector3(sign * SLEEVE_AXIS.x, SLEEVE_AXIS.y, SLEEVE_AXIS.z);
    const socketOffset = new THREE.Vector3(sign * OUTLET.x, OUTLET.y, OUTLET.z)
      .addScaledVector(localTangent, -0.006);
    return { geometry, socketOffset, lastTransform: new THREE.Matrix4().makeScale(0, 0, 0) };
  }, [side]);
  const material = useMemo(() => {
    const value = new THREE.MeshStandardMaterial({ color: "#181a1c", roughness: 0.37, metalness: 0.1, transparent: true, depthWrite: false });
    value.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vCableProgress;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvCableProgress = uv.x;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vCableProgress;").replace("#include <opaque_fragment>", "diffuseColor.a *= 1.0 - smoothstep(0.42, 0.98, vCableProgress);\n#include <opaque_fragment>");
    };
    value.customProgramCacheKey = () => "trailing-cable-fade-v2";
    return value;
  }, []);
  useFrame(() => {
    const bud = anchor.current;
    const mesh = cable.current;
    if (!bud || !mesh) return;
    bud.updateMatrix();
    if (bud.matrix.equals(lastTransform)) return;
    // Move the fixed mesh instead of rebuilding and uploading its vertices.
    // Only the radius follows the bud scale; the vertical drop stays 2.42 units.
    mesh.position.copy(socketOffset).applyMatrix4(bud.matrix);
    mesh.scale.set(bud.scale.x, 1, bud.scale.x);
    mesh.visible = true;
    lastTransform.copy(bud.matrix);
  }, -1);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <mesh ref={cable} geometry={geometry} material={material} visible={false} renderOrder={5} />;
}

function EarbudPair({ modelUrl, progress }: { modelUrl: string; progress: MotionValue<number> }) {
  const { scene } = useGLTF(modelUrl, "/draco/");
  const left = useMemo(() => prepareEarbud(scene, "L"), [scene]);
  const right = useMemo(() => prepareEarbud(scene, "R"), [scene]);
  const leftGroup = useRef<THREE.Group>(null);
  const rightGroup = useRef<THREE.Group>(null);
  useEffect(() => () => {
    [left, right].forEach((bud) => bud.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
      }
    }));
  }, [left, right]);
  // Position the earbuds before the cables read their sockets, including
  // the first frame and the frame used to generate the loading poster.
  useFrame(() => {
    const p = progress.get();
    // Start and finish with zero acceleration. Overlap the final approach
    // with the flight so the earbuds glide into place without stopping first.
    const shrink = THREE.MathUtils.smootherstep(p, 0.14, 0.39);
    const travel = THREE.MathUtils.smootherstep(p, 0.14, 0.42);
    const seat = THREE.MathUtils.smootherstep(p, 0.35, 0.46);
    // Begin with a small hero turn, carry most of the rotation through the
    // flight, then finish aligning the nozzles as the earbuds slide into place.
    const lead = Math.sin(THREE.MathUtils.clamp(p / 0.16, 0, 1) * Math.PI / 2);
    const turn = 0.16 * lead + 0.70 * travel + 0.14 * seat;
    [leftGroup.current, rightGroup.current].forEach((group, index) => {
      if (!group) return;
      const sign = index === 0 ? -1 : 1;
      const arc = Math.sin(Math.PI * travel);
      // Turn the mirrored pair in flight and exchange sides so the
      // silicone nozzles point into the canals as they settle. The two
      // paths pass in front of the face at different heights and depths.
      // Clear the nose and chin before the cables descend; the mannequin's
      // depth pass is active even while its marble surface is fading in.
      // Finish lower, slightly inward, and toward the face (+Z) to seat the tips in the canals.
      group.position.set(
        sign * (THREE.MathUtils.lerp(0.60, -1.46, travel) + 0.34 * seat),
        THREE.MathUtils.lerp(index === 0 ? 0.04 : 0.78, -0.06, travel) + arc * 0.12 - 0.06 * seat,
        THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(index === 0 ? 0 : -0.05, 0.36, travel) + arc * (index === 0 ? 2.3 : 2.1),
          0.15, seat,
        ),
      );
      group.scale.setScalar(THREE.MathUtils.lerp(0.79, 0.36, shrink));
      group.rotation.set(
        THREE.MathUtils.lerp(-0.06, 0, turn),
        sign * THREE.MathUtils.lerp(-0.30, -Math.PI + 0.72, turn),
        sign * THREE.MathUtils.lerp(0.09, 0, turn),
      );
    });
  }, -2);
  return <>
    <group ref={leftGroup}><primitive object={left} dispose={null} /><CableSleeve side="L" /></group>
    <group ref={rightGroup}><primitive object={right} dispose={null} /><CableSleeve side="R" /></group>
    <TrailingCable side="L" anchor={leftGroup} />
    <TrailingCable side="R" anchor={rightGroup} />
  </>;
}

export function EarbudExperience({ modelUrl, progress, mannequinGate }: {
  modelUrl: string;
  progress: MotionValue<number>;
  /** Used by the development fixture to hold only the mannequin's loading. */
  mannequinGate?: ReactNode;
}) {
  // Start both downloads together; the head must not hold the earbuds in Suspense.
  preloadMannequin();
  const presentation = useRef<THREE.Group>(null);
  const reveal = useMotionValue(0);
  const stimulation = useMotionValue(0);
  const target = useRef(new THREE.Vector3());
  const framingZoom = useRef(1);
  const shadowProgress = useRef<number | null>(null);
  useEffect(() => {
    // Use the page breakpoint: desktop canvases also occupy a narrow column.
    const mobile = window.matchMedia("(max-width: 1023px)");
    const updateFraming = () => { framingZoom.current = mobile.matches ? 1.15 : 1; };
    updateFraming();
    mobile.addEventListener("change", updateFraming);
    return () => mobile.removeEventListener("change", updateFraming);
  }, []);
  useFrame(({ camera, size, gl }) => {
    // Enlarge the whole scene together, preserving the earbuds' fit on the head.
    if (camera.zoom !== framingZoom.current) {
      camera.zoom = framingZoom.current;
      camera.updateProjectionMatrix();
    }
    const p = progress.get();
    if (p !== shadowProgress.current) {
      // Refresh the stationary light's cached shadow only when this pose moves.
      // Covers both the scroll story and the fixed-pose fallback/preview scenes.
      gl.shadowMap.needsUpdate = true;
      shadowProgress.current = p;
    }
    const worn = THREE.MathUtils.smootherstep(p, 0.14, 0.46);
    // Let the product lead the turn before bringing in the mannequin.
    reveal.set(ease(0.27, 0.46, p));
    // Give sensing its own quiet beat, then grow the signal toward the crown.
    // Hold the completed signal while the research chapter is shown.
    stimulation.set(ease(0.57, 0.71, p));
    if (presentation.current) {
      // Rotate only 45 degrees in total, then hold that pose.
      // The slower opening keeps the face visible while the pair settles in.
      presentation.current.rotation.y = -THREE.MathUtils.degToRad(45) * ease(0.28, 0.74, p) ** 1.7;
    }
    const frameHeight = THREE.MathUtils.lerp(4.7, 5.9, worn);
    const frameWidth = THREE.MathUtils.lerp(4.2, 4.5, worn);
    const distance = Math.max(frameHeight, frameWidth / (size.width / size.height)) / (2 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2)));
    const targetY = THREE.MathUtils.lerp(-0.2, -0.12, worn);
    camera.position.set(0, targetY + worn * 0.12, distance);
    camera.lookAt(target.current.set(0, targetY, 0));
  });
  return <group ref={presentation}>
    <EarbudPair modelUrl={modelUrl} progress={progress} />
    <Suspense fallback={<AssetLoading />}>
      {mannequinGate}
      <Mannequin reveal={reveal} stimulation={stimulation} />
      <EarSensingCue progress={progress} reveal={reveal} />
    </Suspense>
  </group>;
}
