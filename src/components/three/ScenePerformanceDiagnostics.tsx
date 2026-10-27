"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/** Development-only counters include every render pass in the previous frame. */
export function ScenePerformanceDiagnostics() {
  const gl = useThree((state) => state.gl);
  const publishedAt = useRef(0);
  useEffect(() => {
    const autoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = autoReset; };
  }, [gl]);
  useFrame(() => {
    const now = performance.now();
    if (now - publishedAt.current > 500 && gl.info.render.calls > 0) {
      gl.domElement.dataset.renderCalls = String(gl.info.render.calls);
      gl.domElement.dataset.renderTriangles = String(gl.info.render.triangles);
      publishedAt.current = now;
    }
    gl.info.reset();
  }, -4);
  return null;
}
