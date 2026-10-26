"use client";

import { useCallback, useRef, useState } from "react";
import { useMotionValue } from "motion/react";
import { readProductStageProgress, STORY_SCROLL_SCREENS } from "@/lib/product-stage-scroll";
import { StageScene } from "./StageScene";

/** Regression case: the source value stays at the hero while native scroll moves. */
export function ScrollSyncStudio() {
  const staleProgress = useMotionValue(0);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const readProgress = useCallback(() => readProductStageProgress(track.current, stage.current), []);
  const onReady = useCallback(() => setReady(true), []);
  const onLoading = useCallback(() => setReady(false), []);
  const seek = (progress: number) => {
    if (!track.current || !stage.current) return;
    window.scrollTo({ top: track.current.getBoundingClientRect().top + window.scrollY + stage.current.clientHeight * STORY_SCROLL_SCREENS * progress, behavior: "instant" });
  };
  return <main>
    <header style={{ position: "sticky", top: 0, zIndex: 2, padding: 16, background: "white" }}>
      <h1>Scroll synchronization check</h1>
      <p>Source progress deliberately frozen at 0. The model must follow the page.</p>
      <p role="status">{ready ? "ready" : "loading"}</p>
      <div style={{ display: "flex", gap: 24 }}>
        <button onClick={() => seek(0)}>Show hero</button>
        <button onClick={() => seek(0.57)}>Show mannequin</button>
        <button onClick={() => { setReady(false); setVersion(value => value + 1); }}>Reload 3D at this scroll position</button>
      </div>
    </header>
    <div ref={track} style={{ height: "calc(70vh * 7.2)" }}>
      <div ref={stage} style={{ height: "70vh", position: "sticky", top: 120 }}>
        <StageScene key={version} progress={staleProgress} readProgress={readProgress} modelUrl="/models/cymba-earbuds-hero.glb" onReady={onReady} onLoading={onLoading} />
      </div>
    </div>
  </main>;
}
