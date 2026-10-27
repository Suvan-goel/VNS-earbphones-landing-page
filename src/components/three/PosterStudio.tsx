"use client";

import { useCallback, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useMotionValue } from "motion/react";
import { EarbudExperience } from "./EarbudExperience";
import { Scene } from "./Scene";
import { HeroPoster } from "../HeroPoster";
import heroPoster from "../../../public/models/cymba-earbuds-hero-poster.webp";

// Capture immediately after drawing, so normal viewers never need the costly
// preserveDrawingBuffer option. This tool is available only in development.
function CaptureFrame({ request, onCapture }: { request: number; onCapture: (image: string) => void }) {
  const captured = useRef(0);
  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera);
    if (request > captured.current) {
      captured.current = request;
      const image = gl.domElement.toDataURL("image/png");
      queueMicrotask(() => onCapture(image));
    }
  }, 1);
  return null;
}

export function PosterStudio() {
  const progress = useMotionValue(0);
  const [ready, setReady] = useState(false);
  const [request, setRequest] = useState(0);
  const [image, setImage] = useState<string>();
  const [frame, setFrame] = useState<[number, number]>([1260, 1410]);
  const [showPoster, setShowPoster] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return <main style={{ padding: 24 }}>
    <h1>Hero loading image</h1>
    <p>Capture the current live materials, lighting, camera and layout on a transparent background.</p>
    <button type="button" disabled={!ready} onClick={() => setRequest((value) => value + 1)}>Capture current hero</button>
    <button type="button" onClick={() => setFrame([360, 327.6])}>Phone frame</button>
    <button type="button" onClick={() => setFrame([360, 235.2])}>Compact phone frame</button>
    <button type="button" onClick={() => setFrame([720, 900])}>Desktop frame</button>
    <button type="button" onClick={() => setFrame([1260, 1410])}>Master frame</button>
    <button type="button" onClick={() => setShowPoster((value) => !value)}>{showPoster ? "Show live model" : "Show loading image"}</button>
    {/* Same 4.2 × 4.7 framing rectangle as the live hero camera. */}
    <div style={{ width: frame[0], height: frame[1], position: "relative", background: "white" }}>
      <Scene shadows={false} camera={{ position: [0, -0.2, 10], fov: 28 }} onReady={onReady}>
        <EarbudExperience modelUrl="/models/cymba-earbuds-hero.glb" progress={progress} />
        <CaptureFrame request={request} onCapture={setImage} />
      </Scene>
      <HeroPoster src={heroPoster.src} ready={!showPoster} />
    </div>
    {image && <a href={image} download="hero-live-poster.png">
      {/* The captured data URL is also exposed in the DOM for local asset tooling. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-poster-capture src={image} alt="Captured live hero" width={600} height={672} />
    </a>}
  </main>;
}
