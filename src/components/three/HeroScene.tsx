"use client";

import { useMotionValue } from "motion/react";
import { Scene } from "./Scene";
import { EarbudExperience } from "./EarbudExperience";
import { useCallback } from "react";
import { clearProductAssets } from "./productAssets";

export type HeroPose = "hero" | "inner";

export function HeroScene({ modelUrl, pose = "hero", onReady, onLoading, onError }: {
  modelUrl: string | null;
  pose?: HeroPose;
  onReady?: () => void;
  onLoading?: () => void;
  onError?: () => void;
}) {
  const progress = useMotionValue(pose === "hero" ? 0 : 0.5);
  const resetAssets = useCallback(() => clearProductAssets(modelUrl), [modelUrl]);
  return <Scene shadows={false} camera={{ position: [0, -0.2, 10], fov: 28 }} shadowY={-2.4} onReady={onReady} onLoading={onLoading} onError={onError} onResetAssets={resetAssets}>
    {modelUrl && <EarbudExperience modelUrl={modelUrl} progress={progress} />}
  </Scene>;
}
