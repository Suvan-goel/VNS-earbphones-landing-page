"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useMotionValue, useMotionValueEvent, type MotionValue } from "motion/react";
import { EarbudExperience } from "./EarbudExperience";
import { NeuralGlow } from "./NeuralGlow";
import { RedrawOnChange, Scene } from "./Scene";
import { ModelRecoveryNotice } from "../ModelRecoveryNotice";
import { clearProductAssets } from "./productAssets";
import { SceneQualityContext } from "./sceneQuality";

const heldAsset = new Promise<never>(() => {});
function HoldMannequin(): never { throw heldAsset; }

function ProgressProbe({ progress }: { progress: MotionValue<number> }) {
  useFrame(({ gl }) => { gl.domElement.dataset.modelProgress = progress.get().toFixed(4); }, -3);
  return null;
}

function FailureProbe({ fail }: { fail: boolean }) {
  if (fail) throw new Error("Simulated scene failure");
  return null;
}

function ContextControl({ onContext, onStop }: {
  onContext: (extension: WEBGL_lose_context | null) => void;
  onStop: (stop: () => void) => void;
}) {
  const gl = useThree((state) => state.gl);
  const setFrameloop = useThree((state) => state.setFrameloop);
  useEffect(() => {
    onContext(gl.getContext().getExtension("WEBGL_lose_context"));
  }, [gl, onContext]);
  useEffect(() => onStop(() => setFrameloop("never")), [setFrameloop, onStop]);
  return null;
}

/** Development-only controls for testing a real graphics reset, without reloading. */
export function SceneRecoveryStudio() {
  const progress = useMotionValue(0.57);
  const [previewProgress, setPreviewProgress] = useState(0.57);
  useMotionValueEvent(progress, "change", setPreviewProgress);
  const context = useRef<WEBGL_lose_context | null>(null);
  const stop = useRef<() => void>(() => {});
  const [status, setStatus] = useState("loading");
  const [supported, setSupported] = useState(false);
  const [version, setVersion] = useState(0);
  const [fail, setFail] = useState(false);
  const [held, setHeld] = useState(false);
  const [mobile, setMobile] = useState(false);
  const onStop = useCallback((callback: () => void) => { stop.current = callback; }, []);
  const onContext = useCallback((extension: WEBGL_lose_context | null) => {
    context.current = extension;
    setSupported(Boolean(extension));
  }, []);
  const onReady = useCallback(() => setStatus("ready"), []);
  const onLoading = useCallback(() => setStatus("recovering"), []);
  const onError = useCallback((error: Error) => setStatus(`failed: ${error.message}`), []);
  const retry = () => { clearProductAssets("/models/cymba-earbuds-hero.glb"); setFail(false); setHeld(false); setStatus("loading"); setVersion((value) => value + 1); };
  return <main style={{ padding: 24 }}>
    <h1>3D recovery check</h1>
    <p role="status">{status}</p>
    <label>Animation progress <input aria-label="Animation progress" type="number" min={0} max={1} step={0.001} value={previewProgress}
      onChange={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) progress.set(Math.max(0, Math.min(1, value))); }} /></label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      <button disabled={!supported} onClick={() => context.current?.loseContext()}>Lose graphics context</button>
      <button disabled={!supported} onClick={() => context.current?.restoreContext()}>Restore graphics context</button>
      <button onClick={() => progress.set(0)}>Hero pose</button>
      <button onClick={() => progress.set(0.28)}>Turning pose</button>
      <button onClick={() => progress.set(0.46)}>Seated pose</button>
      <button onClick={() => progress.set(0.57)}>Mannequin pose</button>
      <button onClick={() => progress.set(0.84)}>Rotated pose</button>
      <button onClick={() => setMobile(value => !value)}>{mobile ? "Desktop preview" : "Phone preview"}</button>
      <button onClick={() => setFail(true)}>Simulate scene failure</button>
      <button onClick={() => stop.current()}>Stop render loop</button>
      <button onClick={() => { setHeld(true); setStatus("loading"); setVersion(value => value + 1); }}>Restart with mannequin loading held</button>
      <button onClick={() => setHeld(false)}>Release mannequin</button>
    </div>
    <div style={{ position: "relative", width: mobile ? 390 : "100%", maxWidth: "100%", height: mobile ? 560 : "75vh", marginInline: "auto" }}>
      <SceneQualityContext.Provider value={{ mobile }}>
      <Scene key={`${version}-${mobile}`} shadows={false} onReady={onReady} onLoading={onLoading} onError={onError}>
        <RedrawOnChange value={progress} />
        <FailureProbe fail={fail} />
        <ContextControl onContext={onContext} onStop={onStop} />
        <ProgressProbe progress={progress} />
        <EarbudExperience modelUrl="/models/cymba-earbuds-hero.glb" progress={progress} mannequinGate={held ? <HoldMannequin /> : undefined} />
        <NeuralGlow progress={progress} />
      </Scene>
      </SceneQualityContext.Provider>
      {status.startsWith("failed:") && <ModelRecoveryNotice onRetry={retry} />}
    </div>
  </main>;
}
