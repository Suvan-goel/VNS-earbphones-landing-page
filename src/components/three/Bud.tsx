"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";

/*
 * CYMBA One modelled in code from the product renders. Used until the
 * sculpted model lands in public/models/cymba-one.glb, and as the fallback
 * if that file ever fails to load.
 *
 * Units are roughly centimetres. The bud points its tip along +x; the
 * faceplate faces -x; the wing rises along +y; the cable leaves along -y;
 * the inner face (stimulation contacts and sensor window) looks along +z,
 * towards the camera at rest. Meshes that the page highlights carry a `name`:
 * "contact", "sensor", "button" and "light".
 */

const champagne = "#cfae7c";

/** The bud is shifted inside its group so the housing sits near the origin. */
const OFFSET: [number, number, number] = [-0.6, 0.2, 0];

const wingCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.35, 0.75, 0),
  new THREE.Vector3(0.55, 1.25, -0.05),
  new THREE.Vector3(0.95, 1.62, -0.05),
  new THREE.Vector3(1.45, 1.55, 0.05),
  new THREE.Vector3(1.75, 1.25, 0.1),
]);

const cableCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.5, -0.8, 0.05),
  new THREE.Vector3(0.52, -1.5, 0.1),
  new THREE.Vector3(0.7, -2.6, 0.3),
  new THREE.Vector3(1.3, -3.8, 0.6),
]);

/* The inline controller sits half way down the cable, aligned with it. */
const controllerT = 0.5;
const controllerPoint = cableCurve.getPointAt(controllerT);
const controllerQuaternion = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, -1, 0),
  cableCurve.getTangentAt(controllerT).normalize(),
);

function latheProfile(points: [number, number][], segments = 96) {
  // points are [radius, x]; LatheGeometry rotates around y, so the mesh is rotated afterwards.
  return new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), segments);
}

function Housing() {
  const shell = useMemo(
    () =>
      latheProfile([
        [0.02, 0.06],
        [0.86, 0.06],
        [0.92, 0.2],
        [0.9, 0.55],
        [0.8, 0.9],
        [0.62, 1.15],
        [0.46, 1.3],
        [0.3, 1.36],
        [0.28, 1.72],
        [0.02, 1.72],
      ]),
    [],
  );
  const core = useMemo(
    () =>
      latheProfile([
        [0.02, 0.12],
        [0.6, 0.12],
        [0.66, 0.5],
        [0.55, 0.9],
        [0.3, 1.1],
        [0.02, 1.1],
      ]),
    [],
  );
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh geometry={core}>
        <meshStandardMaterial color="#0d0d10" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh geometry={shell} name="shell">
        <meshPhysicalMaterial
          color="#3b3b42"
          transmission={0.8}
          thickness={0.5}
          ior={1.45}
          roughness={0.15}
          metalness={0}
          attenuationColor="#2a2a30"
          attenuationDistance={2.2}
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </mesh>
    </group>
  );
}

function Faceplate() {
  return (
    <group position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh position={[0, 0.04, 0]} name="rim">
        <cylinderGeometry args={[1.0, 1.0, 0.1, 128]} />
        <meshStandardMaterial color="#b8955f" metalness={1} roughness={0.3} envMapIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0.12, 0]} name="faceplate">
        <cylinderGeometry args={[0.86, 0.92, 0.08, 128]} />
        <meshPhysicalMaterial color="#1a1a1d" metalness={0.8} roughness={0.46} anisotropy={0.6} anisotropyRotation={Math.PI / 2} envMapIntensity={0.7} />
      </mesh>
    </group>
  );
}

function Tip() {
  const geo = useMemo(
    () =>
      latheProfile([
        [0.3, 1.5],
        [0.5, 1.56],
        [0.62, 1.78],
        [0.6, 2.05],
        [0.5, 2.22],
        [0.26, 2.3],
        [0.22, 2.3],
        [0.22, 1.9],
        [0.3, 1.5],
      ]),
    [],
  );
  return (
    <mesh geometry={geo} rotation={[0, 0, -Math.PI / 2]} name="tip">
      <meshPhysicalMaterial color="#7f7f85" roughness={0.6} transmission={0.12} thickness={0.3} ior={1.4} />
    </mesh>
  );
}

function Wing() {
  const geo = useMemo(() => new THREE.TubeGeometry(wingCurve, 48, 0.18, 24, false), []);
  return (
    <group name="wing">
      <mesh geometry={geo}>
        <meshStandardMaterial color="#121214" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[1.75, 1.25, 0.1]}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color="#121214" roughness={0.9} />
      </mesh>
      <RoundedBox args={[0.34, 0.16, 0.05]} radius={0.05} position={[1.02, 1.6, 0.14]} rotation={[0.2, 0, -0.1]}>
        <meshStandardMaterial color={champagne} metalness={1} roughness={0.25} />
      </RoundedBox>
    </group>
  );
}

/* Two raised contacts and the sensor window, proud of the shell on the side that meets the ear. */
function InnerFace() {
  return (
    <group position={[0.55, 0, 0.86]}>
      <RoundedBox args={[0.3, 0.42, 0.06]} radius={0.06} position={[0, 0.3, 0]} name="contact">
        <meshStandardMaterial color={champagne} metalness={1} roughness={0.25} />
      </RoundedBox>
      <RoundedBox args={[0.3, 0.42, 0.06]} radius={0.06} position={[0, -0.3, 0]} name="contact">
        <meshStandardMaterial color={champagne} metalness={1} roughness={0.25} />
      </RoundedBox>
      <RoundedBox args={[0.26, 0.3, 0.05]} radius={0.04} position={[0.42, 0.05, -0.1]} name="sensor">
        <meshPhysicalMaterial color="#1f4d2e" roughness={0.1} metalness={0.2} clearcoat={1} emissive="#1d6b3a" emissiveIntensity={0.25} />
      </RoundedBox>
    </group>
  );
}

/* The inline controller: volume down, play, volume up, and a small light. */
function Controller() {
  return (
    <group position={controllerPoint} quaternion={controllerQuaternion} name="controller">
      <RoundedBox args={[0.26, 1.15, 0.16]} radius={0.075} smoothness={6}>
        <meshStandardMaterial color="#1a1a1d" metalness={0.6} roughness={0.42} />
      </RoundedBox>
      {[0.3, 0, -0.3].map((y, i) => (
        <RoundedBox key={y} args={[0.14, 0.2, 0.03]} radius={0.03} position={[0, y, 0.085]} name="button">
          <meshStandardMaterial color={i === 1 ? champagne : "#2a2a2f"} metalness={i === 1 ? 1 : 0.5} roughness={0.3} />
        </RoundedBox>
      ))}
      <mesh position={[0, 0.5, 0.08]} name="light">
        <sphereGeometry args={[0.026, 16, 16]} />
        <meshStandardMaterial color="#f4e7cf" emissive={champagne} emissiveIntensity={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Cable() {
  const geo = useMemo(() => new THREE.TubeGeometry(cableCurve, 64, 0.075, 16, false), []);
  return (
    <group name="cable">
      <mesh position={[0.5, -0.72, 0.05]}>
        <cylinderGeometry args={[0.17, 0.14, 0.36, 32]} />
        <meshStandardMaterial color="#1a1a1d" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#111113" roughness={0.85} metalness={0.05} />
      </mesh>
      <Controller />
    </group>
  );
}

/** The whole earbud, housing near the origin. About 5.6 units tall including the cable. */
export function Bud() {
  return (
    <group position={OFFSET}>
      <Housing />
      <Faceplate />
      <Tip />
      <Wing />
      <InnerFace />
      <Cable />
    </group>
  );
}
