"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type MotionValue } from "motion/react";
import * as THREE from "three";

type Point = [number, number, number];
type Branch = { curve: THREE.CatmullRomCurve3; radius: number; endRadius: number; distance: number; length: number; warm: number; segments: number };

const clamp = THREE.MathUtils.clamp;
const vector = (point: Point) => new THREE.Vector3(...point);

// The branching structure is deterministic. Small phase differences keep the
// two sides organic while preserving an intentional, balanced crown silhouette.
function crownPoint(point: THREE.Vector3) {
  const centred = new THREE.Vector3(point.x / 0.79, (point.y - 1.09) / 0.77, (point.z + 0.04) / 0.66);
  if (centred.length() > 0.96) centred.setLength(0.96);
  return new THREE.Vector3(centred.x * 0.79, Math.max(0.64, centred.y * 0.77 + 1.09), centred.z * 0.66 - 0.04);
}

function makeNetwork() {
  const branches: Branch[] = [];
  const pulsePaths: THREE.CatmullRomCurve3[] = [];

  const add = (points: THREE.Vector3[], radius: number, endRadius: number, distance: number, warm = 0, segments = 24) => {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    curve.arcLengthDivisions = 160;
    const branch = { curve, radius, endRadius, distance, length: curve.getLength(), warm, segments };
    branches.push(branch);
    return branch;
  };

  const sprout = (parent: Branch, at: number, direction: THREE.Vector3, length: number, radius: number, phase: number) => {
    const start = parent.curve.getPointAt(at);
    const tangent = parent.curve.getTangentAt(at);
    const end = crownPoint(start.clone().addScaledVector(direction, length));
    const displacement = end.clone().sub(start);
    const bend = new THREE.Vector3(Math.sin(phase), 0.3, Math.cos(phase)).multiplyScalar(length * 0.11);
    return add([
      start,
      start.clone().addScaledVector(tangent, length * 0.20),
      start.clone().addScaledVector(displacement, 0.55).add(bend),
      start.clone().addScaledVector(displacement, 0.85).addScaledVector(bend, 0.32),
      end,
    ], radius, Math.max(0.0005, radius * 0.20), parent.distance + parent.length * at, 0, 16);
  };

  for (const side of [-1, 1]) {
    // The rose entry is tucked behind the concha and temple rather than looping
    // across the cheek. A few close companion fibres read as one nerve bundle.
    const entry = add([
      [side * 1.025, 0.05, 0.015], [side * 0.91, 0.08, -0.025],
      [side * 0.77, 0.28, -0.10], [side * 0.68, 0.53, -0.13],
      [side * 0.52, 0.77, -0.12], [side * 0.37, 1.00, -0.08],
    ].map((point) => vector(point as Point)), 0.015, 0.008, 0, 1, 64);
    pulsePaths.push(entry.curve);
    for (let fibre = 0; fibre < 3; fibre++) {
      const points = Array.from({ length: 12 }, (_, index) => {
        const t = index / 11;
        const point = entry.curve.getPointAt(t);
        const envelope = Math.sin(Math.PI * t);
        point.y += Math.sin(t * 5.8 + fibre * 2.1) * 0.015 * envelope;
        point.z += Math.cos(t * 5.8 + fibre * 2.1) * 0.017 * envelope;
        return point;
      });
      add(points, 0.0032, 0.0015, 0, 1, 48);
    }

    const tips: Point[] = [
      [side * 0.12, 1.82, 0.02],
      [side * 0.34, 1.72, -0.33],
      [side * 0.62, 1.49, -0.27],
      [side * 0.58, 1.53, 0.25],
      [side * 0.28, 1.65, 0.45],
      [side * 0.16, 1.45, -0.57],
      [side * 0.16, 1.41, 0.55],
    ];
    tips.forEach((tip, index) => {
      const phase = index * 2.399 + (side < 0 ? 0.22 : 0.85);
      const rootAt = 0.70 + (index % 4) * 0.085;
      const root = entry.curve.getPointAt(rootAt);
      const end = crownPoint(vector(tip));
      const delta = end.clone().sub(root);
      const stem = add([
        root,
        root.clone().add(new THREE.Vector3(-side * 0.025, 0.16, 0)).addScaledVector(delta, 0.08),
        root.clone().addScaledVector(delta, 0.48).add(new THREE.Vector3(side * 0.025, 0.10, 0)),
        root.clone().addScaledVector(delta, 0.78).add(new THREE.Vector3(side * 0.018, 0.045, 0)),
        end,
      ], 0.0088 - index * 0.0005, 0.0019, entry.length * rootAt, 0, 36);
      if (index === 0 || index === 3) pulsePaths.push(stem.curve);

      // Each limb grows upward before splitting into paired, tapered twigs.
      // Fork planes vary in depth, so the tree reads in a complete 3D orbit.
      for (let fork = 0; fork < 4; fork++) {
        const at = 0.38 + fork * 0.15;
        const tangent = stem.curve.getTangentAt(at);
        const across = new THREE.Vector3(Math.cos(phase), 0, Math.sin(phase));
        across.addScaledVector(tangent, -across.dot(tangent)).normalize();
        for (const direction of [-1, 1]) {
          const growth = tangent.clone().multiplyScalar(0.68).addScaledVector(across, direction * 0.68);
          growth.y = Math.max(0.48, growth.y + 0.35);
          growth.normalize();
          const twigLength = (0.32 - fork * 0.036) * (0.94 + 0.06 * Math.sin(phase + fork));
          const twig = sprout(stem, at, growth, twigLength, 0.0036 - fork * 0.00035, phase + fork);

          for (let split = 0; split < 3; split++) {
            const childAt = 0.38 + split * 0.21;
            const childTangent = twig.curve.getTangentAt(childAt);
            const childAcross = new THREE.Vector3(Math.cos(phase + fork + 0.7), 0.28, Math.sin(phase + fork + 0.7));
            childAcross.addScaledVector(childTangent, -childAcross.dot(childTangent)).normalize();
            const feather = (split + fork) % 2 === 0 ? -1 : 1;
            const fineDirection = childTangent.clone().multiplyScalar(0.70).addScaledVector(childAcross, feather * 0.57);
            fineDirection.y = Math.max(0.46, fineDirection.y + 0.28);
            sprout(twig, childAt, fineDirection.normalize(), twigLength * (0.47 - split * 0.07), 0.00165, phase + fork + feather);
          }
        }
      }
    });
  }

  // Build the tree in its compact design space first, then fit all shared
  // curves to the deeper cranium. The ear connection stays exactly in place.
  // Retaining the design-space path distances keeps each pulse continuous
  // through its parent/child junction as the upper branches gain depth.
  branches.forEach(({ curve }) => {
    curve.points.forEach((point) => {
      const amount = THREE.MathUtils.smoothstep(point.y, 0.05, 0.75);
      point.z = THREE.MathUtils.lerp(point.z, point.z * 2.2 - 0.18, amount);
    });
    curve.updateArcLengths();
  });

  const positions: number[] = [], normals: number[] = [], paths: number[] = [], warmth: number[] = [], indices: number[] = [];
  const radialSegments = 6;
  branches.forEach((branch) => {
    const frames = branch.curve.computeFrenetFrames(branch.segments, false);
    const first = positions.length / 3;
    for (let row = 0; row <= branch.segments; row++) {
      const t = row / branch.segments;
      const centre = branch.curve.getPointAt(t);
      const radius = THREE.MathUtils.lerp(branch.radius, branch.endRadius, t ** 0.8);
      for (let column = 0; column <= radialSegments; column++) {
        const angle = column / radialSegments * Math.PI * 2;
        const normal = frames.normals[row].clone().multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[row], Math.sin(angle));
        positions.push(centre.x + normal.x * radius, centre.y + normal.y * radius, centre.z + normal.z * radius);
        normals.push(normal.x, normal.y, normal.z);
        paths.push(branch.distance + branch.length * t);
        warmth.push(branch.warm * (1 - t * 0.72));
        if (row < branch.segments && column < radialSegments) {
          const a = first + row * (radialSegments + 1) + column;
          const b = a + radialSegments + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("pathDistance", new THREE.Float32BufferAttribute(paths, 1));
  geometry.setAttribute("warmth", new THREE.Float32BufferAttribute(warmth, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return { geometry, pulsePaths, bead: new THREE.SphereGeometry(1, 8, 6) };
}

function networkMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { time: { value: 0 }, reveal: { value: 0 }, activity: { value: 0 } },
    vertexShader: `
      attribute float pathDistance;
      attribute float warmth;
      varying float vDistance;
      varying float vWarmth;
      varying vec3 vNormal;
      void main() {
        vDistance = pathDistance;
        vWarmth = warmth;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float reveal;
      uniform float activity;
      varying float vDistance;
      varying float vWarmth;
      varying vec3 vNormal;
      void main() {
        float phase = fract(vDistance * 0.48 - time * 0.32 + 0.5) - 0.5;
        float travelling = exp(-phase * phase * 104.0);
        float breath = 0.5 + 0.5 * sin(time * 2.1 - vDistance * 2.2);
        float strength = pow(activity, 0.62);
        float lighting = 0.83 + 0.17 * abs(dot(normalize(vNormal), normalize(vec3(-0.4, 0.7, 0.8))));
        vec3 violet = vec3(0.29, 0.045, 0.60);
        vec3 rose = vec3(0.82, 0.055, 0.25);
        vec3 base = mix(violet, rose, vWarmth) * lighting;
        vec3 signal = mix(vec3(0.79, 0.22, 0.94), vec3(0.98, 0.25, 0.46), vWarmth);
        vec3 colour = mix(base, signal, strength * (0.12 + breath * 0.14 + travelling * 0.73));
        colour += strength * travelling * vec3(0.16, 0.13, 0.17);
        gl_FragColor = vec4(colour, reveal * (0.81 + strength * 0.17));
        #include <colorspace_fragment>
      }
    `,
  });
}

/** A stylised signal illustration inside the glass crown, in mannequin coordinates. */
export function NeuralNetwork({ reveal, stimulation }: { reveal: MotionValue<number>; stimulation: MotionValue<number> }) {
  const root = useRef<THREE.Group>(null);
  const particles = useRef<THREE.InstancedMesh>(null);
  const network = useMemo(makeNetwork, []);
  const material = useMemo(networkMaterial, []);
  const pulseMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#f1b8fa", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => () => {
    network.geometry.dispose();
    network.bead.dispose();
    material.dispose();
    pulseMaterial.dispose();
  }, [network, material, pulseMaterial]);

  useFrame(({ clock }) => {
    const visibility = clamp(reveal.get(), 0, 1);
    const activity = clamp(stimulation.get(), 0, 1);
    if (root.current) root.current.visible = visibility > 0.002;
    material.uniforms.time.value = clock.elapsedTime;
    material.uniforms.reveal.value = visibility;
    material.uniforms.activity.value = activity;
    pulseMaterial.opacity = visibility * activity * 0.62;
    if (!particles.current || visibility < 0.002) return;
    network.pulsePaths.forEach((path, index) => {
      const phase = (clock.elapsedTime * 0.16 + index * 0.147) % 1;
      path.getPointAt(phase, point);
      transform.position.copy(point);
      transform.scale.setScalar(0.0085 * Math.sin(phase * Math.PI) * activity);
      transform.updateMatrix();
      particles.current!.setMatrixAt(index, transform.matrix);
    });
    particles.current.instanceMatrix.needsUpdate = true;
  });

  return <group ref={root} dispose={null} visible={false}>
    <mesh geometry={network.geometry} material={material} renderOrder={3} />
    <instancedMesh ref={particles} args={[network.bead, pulseMaterial, network.pulsePaths.length]} frustumCulled={false} renderOrder={4} />
  </group>;
}
