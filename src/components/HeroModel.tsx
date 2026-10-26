"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useState } from "react";
import type { HeroPose } from "./three/HeroScene";
import { ModelLoadingNotice, ModelRecoveryNotice } from "./ModelRecoveryNotice";

/* The 3D hero only runs in the browser; the frame holds its place until it loads. */
const HeroScene = dynamic(() => import("./three/HeroScene").then((m) => m.HeroScene), { ssr: false });

export function HeroModel({ modelUrl, posterUrl, pose = "hero", className = "" }: { modelUrl: string | null; posterUrl?: string | null; pose?: HeroPose; className?: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onLoading = useCallback(() => setReady(false), []);
  const onError = useCallback(() => { setFailed(true); setReady(false); }, []);
  const retry = useCallback(async () => {
    const { clearProductAssets } = await import("./three/productAssets");
    clearProductAssets(modelUrl);
    setReady(false);
    setFailed(false);
  }, [modelUrl]);
  return (
    <div className={className} style={{ position: "relative" }} data-product-model={failed || !modelUrl ? "fallback" : ready ? "loaded" : "loading"}>
      {!failed && modelUrl && <HeroScene modelUrl={modelUrl} pose={pose} onReady={onReady} onLoading={onLoading} onError={onError} />}
      {posterUrl && <Image src={posterUrl} alt="" fill quality={95} priority={pose === "hero"} sizes="(min-width: 768px) 640px, 100vw" style={{ objectFit: "contain", opacity: ready ? 0 : 1, transition: "opacity .4s ease", pointerEvents: "none" }} />}
      {!ready && !failed && modelUrl && <ModelLoadingNotice />}
      {failed && modelUrl && <ModelRecoveryNotice onRetry={retry} />}
    </div>
  );
}
