"use client";

import { useMotionValue } from "motion/react";
import { Scene } from "./Scene";
import { EarbudExperience } from "./EarbudExperience";
import { useCallback, useEffect } from "react";
import { clearProductAssets } from "./productAssets";

export type HeroPose = "hero" | "inner" | "product" | "personalisation" | "evidence";

const POSE_PROGRESS: Record<HeroPose, number> = {
  hero: 0,
  inner: 0.5,
  product: 0.46,
  personalisation: 0.70,
  evidence: 0.84,
};

export function HeroScene({ modelUrl, pose = "hero", onReady, onLoading, onError }: {
  modelUrl: string | null;
  pose?: HeroPose;
  onReady?: () => void;
  onLoading?: () => void;
  onError?: () => void;
}) {
  const progress = useMotionValue(POSE_PROGRESS[pose]);
  useEffect(() => { progress.set(POSE_PROGRESS[pose]); }, [pose, progress]);
  const resetAssets = useCallback(() => clearProductAssets(modelUrl), [modelUrl]);
  return <Scene shadows={false} sculptureShadows camera={{ position: [0, -0.2, 10], fov: 28 }} shadowY={-2.4} onReady={onReady} onLoading={onLoading} onError={onError} onResetAssets={resetAssets}>
    {modelUrl && <EarbudExperience modelUrl={modelUrl} progress={progress} />}
  </Scene>;
}
