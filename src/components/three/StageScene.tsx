"use client";

import { useMotionValue, type MotionValue } from "motion/react";
import { useFrame } from "@react-three/fiber";
import { Scene } from "./Scene";
import { EarbudExperience } from "./EarbudExperience";
import { NeuralGlow } from "./NeuralGlow";
import { useCallback } from "react";
import { clearProductAssets } from "./productAssets";

function ScrollProgressSync({ source, progress, readProgress }: {
  source: MotionValue<number>;
  progress: MotionValue<number>;
  readProgress: () => number | null;
}) {
  useFrame(({ gl }) => {
    // Sample before the earbuds (-2), cables (-1), camera and glow. A missed
    // Motion update or a late canvas mount must not leave the 3D scene at zero.
    const current = readProgress() ?? source.get();
    progress.set(current);
    const label = current.toFixed(4);
    if (gl.domElement.dataset.modelProgress !== label) gl.domElement.dataset.modelProgress = label;
  }, -3);
  return null;
}

export function StageScene({ progress, readProgress, modelUrl, onReady, onLoading, onError }: {
  progress: MotionValue<number>;
  readProgress: () => number | null;
  modelUrl: string | null;
  onReady?: () => void;
  onLoading?: () => void;
  onError?: () => void;
}) {
  const renderProgress = useMotionValue(progress.get());
  const resetAssets = useCallback(() => clearProductAssets(modelUrl), [modelUrl]);
  return <Scene shadows={false} sculptureShadows camera={{ position: [0, -0.2, 10], fov: 28 }} shadowY={-2.4} onReady={onReady} onLoading={onLoading} onError={onError} onResetAssets={resetAssets}>
    <ScrollProgressSync source={progress} progress={renderProgress} readProgress={readProgress} />
    {modelUrl && <EarbudExperience modelUrl={modelUrl} progress={renderProgress} />}
    <NeuralGlow progress={renderProgress} />
  </Scene>;
}
