"use client";

import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useStore, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { MotionValue } from "motion/react";
import { estimateDownlinkMbps, loadingBudgetMs, sceneRecoveryReason, type SceneHealth } from "@/lib/scene-health";
import { SceneQualityContext } from "./sceneQuality";
import { ScenePerformanceDiagnostics } from "./ScenePerformanceDiagnostics";

type DrawHealth = SceneHealth & { draws: number };

/** Never leave a suspended asset hidden behind a permanent hero still. */
export function AssetLoading() {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(() => setExpired(true), loadingBudgetMs(estimateDownlinkMbps()));
    };
    start();
    document.addEventListener("visibilitychange", start);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);
  if (expired) throw new Error("The 3D model took too long to load. Please retry.");
  return null;
}

class SceneBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={1.1}>
      <color attach="background" args={["#777779"]} />
      <Lightformer position={[0, 5, 3]} scale={[8, 5]} intensity={2.5} />
      <Lightformer position={[-5, 1, 2]} scale={[3, 7]} intensity={2} />
      <Lightformer position={[5, 2, -3]} scale={[3, 6]} intensity={1.5} color="#dfe6ff" />
      <Lightformer position={[0, -3, 5]} scale={[6, 2]} intensity={0.6} />
    </Environment>
  );
}

/** Reattach guards when effects replay, including development refreshes. */
function RendererGuard({ onLost, onRestored, onError, health }: {
  onLost: () => void;
  onRestored: () => void;
  onError: (error: Error) => void;
  health: RefObject<DrawHealth>;
}) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    let active = true;
    let lost = false;
    const handleLost = (event?: Event) => {
      event?.preventDefault();
      if (!active || lost) return;
      lost = true;
      onLost();
    };
    const handleRestored = () => { if (active) onRestored(); };
    const render = gl.render;
    gl.render = function (...args: Parameters<THREE.WebGLRenderer["render"]>) {
      if (!active || lost) return;
      try {
        render.apply(gl, args);
        // Count completed screen draws, not frame callbacks or offscreen passes.
        if (gl.getRenderTarget() === null && !gl.getContext().isContextLost()) {
          health.current.lastDrawAt = performance.now();
          health.current.pendingSince = null;
          health.current.draws++;
        }
      } catch (error) {
        queueMicrotask(() => {
          if (active) onError(error instanceof Error ? error : new Error(String(error)));
        });
      }
    };
    gl.domElement.addEventListener("webglcontextlost", handleLost);
    gl.domElement.addEventListener("webglcontextrestored", handleRestored);
    if (gl.getContext().isContextLost()) handleLost();
    return () => {
      active = false;
      gl.domElement.removeEventListener("webglcontextlost", handleLost);
      gl.domElement.removeEventListener("webglcontextrestored", handleRestored);
      gl.render = render;
    };
  }, [gl, onLost, onRestored, onError, health]);
  return null;
}

// Hide the poster only after the ready content has actually reached the screen.
function ContentReady({ onReady, health }: { onReady: () => void; health: RefObject<DrawHealth> }) {
  const start = useRef(0);
  const reported = useRef(false);
  useEffect(() => {
    // Strict Mode, Suspense and Fast Refresh can replay effects with old refs.
    start.current = health.current.draws;
    reported.current = false;
  }, [health, onReady]);
  useFrame((state) => {
    if (reported.current) return;
    if (health.current.draws - start.current >= 2) {
      reported.current = true;
      onReady();
    } else {
      state.invalidate();
    }
  });
  return null;
}

/**
 * Frames are drawn on demand: scrolling, resizing and React updates request
 * one here, and running animations request their own from inside useFrame.
 * Each request is noted, so the heartbeat can tell a renderer that has stopped
 * answering from a scene that is simply still.
 */
function FrameDriver({ health }: { health: RefObject<DrawHealth> }) {
  const store = useStore();
  useEffect(() => {
    const invalidate = store.getState().invalidate;
    const request = (frames?: number) => {
      if (store.getState().frameloop !== "never") health.current.pendingSince ??= performance.now();
      invalidate(frames);
    };
    store.setState({ invalidate: request });
    const redraw = () => request();
    window.addEventListener("scroll", redraw, { passive: true });
    window.addEventListener("resize", redraw);
    return () => {
      window.removeEventListener("scroll", redraw);
      window.removeEventListener("resize", redraw);
      store.setState({ invalidate });
    };
  }, [store, health]);
  return null;
}

/** Request a frame whenever a motion value that drives the scene changes. */
export function RedrawOnChange({ value }: { value: MotionValue<number> }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => value.on("change", () => invalidate()), [value, invalidate]);
  return null;
}

/*
 * One studio for every 3D moment on the page: the same light, the same
 * exposure, the same floor shadow, so the product looks like the same object
 * wherever it appears. Neutral tone mapping keeps white stone white and the
 * champagne trim bronze rather than orange. Frames are drawn only when scrolling or an
 * animation asks for one, rendering pauses while the canvas is off screen, and
 * resolution is capped on small screens.
 */
export function Scene({
  children,
  className = "",
  camera = { position: [0, 0.6, 8.5] as [number, number, number], fov: 28 },
  shadowY = -3.1,
  shadows = true,
  sculptureShadows = false,
  onReady,
  onLoading,
  onError,
  onResetAssets,
}: {
  children: ReactNode;
  className?: string;
  camera?: { position: [number, number, number]; fov: number };
  shadowY?: number;
  shadows?: boolean;
  sculptureShadows?: boolean;
  onReady?: () => void;
  onLoading?: () => void;
  onError?: (error: Error) => void;
  onResetAssets?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const errorCallback = useRef(onError);
  errorCallback.current = onError;
  const loadingCallback = useRef(onLoading);
  loadingCallback.current = onLoading;
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  const resetAssetsCallback = useRef(onResetAssets);
  resetAssetsCallback.current = onResetAssets;
  const health = useRef<DrawHealth>({ lastDrawAt: 0, loadingSince: 0, ready: false, pendingSince: null, draws: 0 });
  const failed = useRef(false);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryAttempts = useRef(0);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [activated, setActivated] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [mobile, setMobile] = useState(false);

  const handleError = useCallback((error: Error) => {
    if (failed.current) return;
    failed.current = true;
    setUnavailable(true);
    errorCallback.current?.(error);
  }, []);

  const cancelRecovery = useCallback(() => {
    if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    recoveryTimer.current = null;
  }, []);

  const restart = useCallback(() => {
    if (failed.current) return;
    cancelRecovery();
    setRecovering(false);
    health.current.ready = false;
    health.current.lastDrawAt = health.current.loadingSince = performance.now();
    health.current.pendingSince = null;
    // Progress lives outside the canvas, so recreating GPU resources resumes
    // the current chapter instead of resetting the product to the hero pose.
    setCanvasVersion((version) => version + 1);
  }, [cancelRecovery]);

  const handleContextLost = useCallback(() => {
    if (failed.current) return;
    cancelRecovery();
    loadingCallback.current?.();
    if (++recoveryAttempts.current > 2) {
      handleError(new Error("The 3D graphics context could not be recovered."));
      return;
    }
    setRecovering(true);
    recoveryTimer.current = setTimeout(restart, 1500);
  }, [cancelRecovery, handleError, restart]);

  const handleReady = useCallback(() => {
    // Limit consecutive failed restarts, not interruptions over the whole visit.
    recoveryAttempts.current = 0;
    health.current.ready = true;
    readyCallback.current?.();
  }, []);

  useEffect(() => {
    if (!activated || unavailable || recovering || !visible || !pageVisible) return;
    // Background tabs and offscreen pauses get a fresh grace period on return.
    // A new or resumed canvas draws a first frame on its own, which must arrive.
    health.current.lastDrawAt = health.current.loadingSince = health.current.pendingSince = performance.now();
    const loadingBudget = loadingBudgetMs(estimateDownlinkMbps());
    // A browser that is not running animation frames (a covered window, a throttled view) draws
    // nothing without anything being wrong. Only count stalled time while frames are flowing.
    let lastFrameAt = performance.now();
    let heartbeat = requestAnimationFrame(function tick() {
      lastFrameAt = performance.now();
      heartbeat = requestAnimationFrame(tick);
    });
    const timer = setInterval(() => {
      const now = performance.now();
      if (now - lastFrameAt > 1500) {
        health.current.lastDrawAt = health.current.loadingSince = now;
        if (health.current.pendingSince !== null) health.current.pendingSince = now;
        return;
      }
      const reason = sceneRecoveryReason(health.current, now, !document.hidden, loadingBudget);
      if (!reason || failed.current) return;
      loadingCallback.current?.();
      if (++recoveryAttempts.current > 2) {
        handleError(new Error("The animation could not resume. Please retry."));
        return;
      }
      if (reason === "loading") resetAssetsCallback.current?.();
      restart();
    }, 1000);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(heartbeat);
    };
  }, [activated, unavailable, recovering, visible, pageVisible, canvasVersion, handleError, restart]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let frame = 0;
    let hadLayout = false;
    const checkViewport = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const hasLayout = rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
      const inView = hasLayout && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      setVisible(inView);
      setPageVisible(!document.hidden);
      // Release the CSS-hidden responsive alternative instead of keeping
      // another WebGL context alive after a layout change.
      if (hadLayout && !hasLayout) {
        cancelRecovery();
        setRecovering(false);
        setActivated(false);
        health.current.ready = false;
        loadingCallback.current?.();
      }
      hadLayout = hasLayout;
      if (!inView || document.hidden || failed.current) return;
      if (typeof window.WebGL2RenderingContext === "undefined") {
        handleError(new Error("WebGL 2 is unavailable on this device."));
        return;
      }
      setActivated(true);
    };
    const scheduleCheck = () => {
      if (!frame) frame = requestAnimationFrame(checkViewport);
    };
    const screenSize = window.matchMedia("(max-width: 1023px)");
    const syncResolution = () => setMobile(screenSize.matches);
    syncResolution();
    checkViewport();
    screenSize.addEventListener("change", syncResolution);
    document.addEventListener("visibilitychange", checkViewport);
    window.addEventListener("pageshow", checkViewport);
    window.addEventListener("focus", checkViewport);
    window.addEventListener("resize", scheduleCheck);
    // Intersection handles scrolling; ResizeObserver handles CSS-hidden
    // alternatives. Avoid reading every hidden canvas's layout on each scroll.
    const intersection = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(scheduleCheck) : null;
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleCheck) : null;
    intersection?.observe(el);
    resize?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      intersection?.disconnect();
      resize?.disconnect();
      screenSize.removeEventListener("change", syncResolution);
      document.removeEventListener("visibilitychange", checkViewport);
      window.removeEventListener("pageshow", checkViewport);
      window.removeEventListener("focus", checkViewport);
      window.removeEventListener("resize", scheduleCheck);
    };
  }, [handleError, cancelRecovery]);

  useEffect(() => {
    if (unavailable) cancelRecovery();
  }, [unavailable, cancelRecovery]);

  useEffect(() => cancelRecovery, [cancelRecovery]);

  return (
    <div ref={host} className={className} aria-hidden="true" data-scene-generation={canvasVersion} data-scene-state={unavailable ? "unavailable" : recovering ? "recovering" : !activated ? "idle" : visible && pageVisible ? "running" : "paused"} style={{ width: "100%", height: "100%", overflowAnchor: "none" }}>
      {activated && !unavailable && (
        <SceneBoundary onError={handleError}>
          <SceneQualityContext.Provider value={{ mobile }}>
          <Canvas
            key={canvasVersion}
            // Phones commonly have 2.6–3.5 device pixels per CSS pixel; a cap of 2 left the
            // product upscaled and soft there. Desktop keeps 2: its canvas is far larger.
            dpr={mobile ? [1, 3] : [1, 2]}
            shadows={sculptureShadows && !mobile ? "percentage" : false}
            frameloop={visible && pageVisible && !recovering ? "demand" : "never"}
            camera={camera}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
            fallback={null}
            style={{ background: "transparent" }}
          >
            <RendererGuard onLost={handleContextLost} onRestored={restart} onError={handleError} health={health} />
            <FrameDriver health={health} />
            {process.env.NODE_ENV === "development" && <ScenePerformanceDiagnostics />}
            <RenderBudget mobile={mobile} sculptureShadows={sculptureShadows} />
            <Suspense fallback={<AssetLoading />}>
              <StudioEnvironment />
              <directionalLight
                position={[4, 6, 5]} intensity={1.4}
                castShadow={sculptureShadows && !mobile}
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-3.3} shadow-camera-right={3.3}
                shadow-camera-top={3.3} shadow-camera-bottom={-3.3}
                shadow-camera-near={0.1} shadow-camera-far={20}
                shadow-normalBias={0.025} shadow-bias={-0.0002}
                shadow-radius={3}
              />
              <directionalLight position={[-5, 2, -3]} intensity={0.5} color="#dfe6ff" />
              {/* A cool rim from behind separates the stone from the page; kept low so the lit edge stays darker than the page. */}
              <directionalLight position={[-3, 3, -6]} intensity={0.8} color="#eef2ff" />
              <directionalLight position={[0, -2, 6]} intensity={0.3} />
              {children}
              <ContentReady onReady={handleReady} health={health} />
              {shadows && <ContactShadows position={[0, shadowY, 0]} opacity={0.35} scale={10} blur={2.4} far={4} color="#1d1d1f" />}
            </Suspense>
          </Canvas>
          </SceneQualityContext.Provider>
        </SceneBoundary>
      )}
    </div>
  );
}

function RenderBudget({ mobile, sculptureShadows }: { mobile: boolean; sculptureShadows: boolean }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.transmissionResolutionScale = mobile ? 0.5 : 1;
    // The key light is stationary. Pose/reveal changes invalidate the map;
    // holding a chapter does not need another full sculpture shadow pass.
    gl.shadowMap.autoUpdate = !sculptureShadows;
    gl.shadowMap.needsUpdate = true;
    return () => { gl.shadowMap.autoUpdate = true; };
  }, [gl, mobile, sculptureShadows]);
  return null;
}
