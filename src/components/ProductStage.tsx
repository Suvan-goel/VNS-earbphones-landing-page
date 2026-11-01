"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionValue, useScroll, useTransform, type MotionStyle, type MotionValue } from "motion/react";
import listeningScene from "@/assets/earbuds/listening-portrait-selected-retouch-v2.webp";
import listeningExtension from "@/assets/earbuds/listening-portrait-studio-grey-wide-v3.webp";
import { closingCta, closingHeadline, reservation, type HeroVariant } from "@/config/site";
import type { StorageMode } from "@/lib/storage";
import { productStory } from "@/config/product-story";
import { STORY_SCROLL_SCREENS, PORTRAIT_ENTRY_START, MODEL_SCROLL_SCREENS, CLOSING_SCROLL_SCREENS, productStageProgress, measuredProductStageProgress } from "@/lib/product-stage-scroll";
import { HeroSignup } from "./HeroSignup";
import { AppPreview } from "./sections/AppPreview";
import { ModelRecoveryNotice } from "./ModelRecoveryNotice";
import { ProductAssetHints } from "./ProductAssetHints";
import { HeroPoster } from "./HeroPoster";
import styles from "./ProductStage.module.css";

/* The 3D stage only runs in the browser. */
const StageScene = dynamic(() => import("./three/StageScene").then((m) => m.StageScene), { ssr: false });
/* Start downloading its code with the page, rather than once hydration reaches the stage. A failure surfaces where the stage renders. */
if (typeof window !== "undefined") import("./three/StageScene").catch(() => undefined);

/*
 * One object, one scroll. The product stays pinned while four chapters of
 * copy pass it; every move is driven by scroll position, so it reverses
 * when the reader scrolls back. After the model settles, the next section scrolls into place.
 *
 * Progress (0..1) along the track:
 *   0.00–0.12  hero: copy left, product full size on the right, turning from the first scroll
 *   0.17–0.45  product: the mannequin appears and the earbuds settle
 *   0.46–0.73  personalisation: sensing cues precede the stimulation illustration
 *   0.74–0.85  evidence: the signal holds while the research is introduced
 *   0.85       the model releases into the normally scrolling app section
 * The closing portrait has its own track after the app, so its expansion
 * does not pin the app or depend on the app's responsive height.
 *
 * One stage, two shapes: on desktop the copy sits left and the product right;
 * on phones each chapter groups its text above the product, with shared
 * signup controls below it. Readers who prefer reduced motion, and very short
 * screens, get `fallback` (the stacked sections) via CSS instead.
 */

/* Keep the ending photograph identical to the live portrait. */
const scene = { image: listeningScene };

const storyChapters = [
  { copy: productStory.product, range: [0.15, 0.21, 0.4, 0.45] },
  { copy: productStory.personalisation, range: [0.46, 0.50, 0.69, 0.73] },
  { copy: productStory.evidence, range: [0.74, 0.77, 0.85, 0.86] },
] satisfies { copy: { headline: readonly string[]; description: string }; range: [number, number, number, number] }[];

function Fade({
  progress,
  range,
  children,
  className,
  holdStart = false,
}: {
  progress: MotionValue<number>;
  range: [number, number, number, number];
  children: ReactNode;
  className?: string;
  /** The hero is already visible at the top of the page; it only fades out. */
  holdStart?: boolean;
}) {
  const opacity = useTransform(progress, range, holdStart ? [1, 1, 1, 0] : [0, 1, 1, 0]);
  const y = useTransform(progress, range, holdStart ? [0, 0, 0, -24] : [24, 0, 0, -24]);
  const visibility = useTransform(opacity, (o) => (o > 0.01 ? "visible" : "hidden"));
  return (
    <motion.div className={className} style={{ opacity, y, visibility }}>
      {children}
    </motion.div>
  );
}

/* One layout for both ink colours keeps the reveal aligned down to each letter. */
function ClosingCopy({ variant, visualOnly = false }: { variant: HeroVariant["id"]; visualOnly?: boolean }) {
  const Heading = visualOnly ? "div" : "h2";
  return (
    <div className={`${styles.copy} ${styles.closingCopy} ${visualOnly ? styles.copyOnScene : ""}`}>
      <div className={styles.closingIntro}>
        <Heading className={`headline ${styles.title}`}>
          <span className="block">{closingHeadline[0]}</span>
          <span className="soft block">{closingHeadline[1]}</span>
        </Heading>
      </div>
      <div className={styles.sceneActions}>
        {visualOnly ? (
          <>
            <span className={`btn-primary ${styles.sceneCta}`}>{closingCta}</span>
            <span className={styles.sceneReserve}>Reserve yours <span aria-hidden="true">→</span></span>
          </>
        ) : (
          <>
            <a href="#signup" data-cta="stage" className={`btn-primary ${styles.sceneCta}`}>
              {closingCta}
            </a>
            <a href={`${reservation.path}?v=${variant}`} data-cta="stage_reserve" className={styles.sceneReserve}>
              Reserve yours <span aria-hidden="true">→</span>
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function ProductStage({
  mode,
  v,
  modelUrl,
  posterUrl = null,
  fallback,
}: {
  mode: StorageMode;
  v: HeroVariant;
  modelUrl: string | null;
  /** A still of the model shown until the 3D scene is ready. */
  posterUrl?: string | null;
  fallback: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const appSection = useRef<HTMLDivElement>(null);
  const closingTrack = useRef<HTMLDivElement>(null);
  const portrait = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mobilePortrait, setMobilePortrait] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onLoading = useCallback(() => setReady(false), []);
  const onError = useCallback(() => { setFailed(true); setReady(false); }, []);
  const retry = useCallback(async () => {
    const { clearProductAssets } = await import("./three/productAssets");
    clearProductAssets(modelUrl);
    setReady(false);
    setFailed(false);
  }, [modelUrl]);

  const { scrollY } = useScroll();
  const trackGeometry = useMotionValue({ top: 0, closingTop: 1, width: 1, height: 1 });
  const readProgress = useCallback(() => {
    const geometry = trackGeometry.get();
    // ResizeObserver keeps these measurements current. Reading native scroll
    // here still handles restored pages without forcing layout every 3D frame.
    return measuredProductStageProgress(window.scrollY, geometry.top, geometry.height);
  }, [trackGeometry]);
  const portraitBounds = useMotionValue({ top: 72, right: 0, bottom: 0, left: 0, width: 1, height: 1 });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobilePortrait(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const trackElement = track.current;
    const stageElement = stage.current;
    const appElement = appSection.current;
    const closingElement = closingTrack.current;
    const frame = portrait.current;
    const sceneElement = frame?.parentElement;
    if (!trackElement || !stageElement || !appElement || !closingElement || !frame || !sceneElement) return;
    let active = true;
    const measure = () => {
      // A queued resize can arrive after React has cleared or replaced refs.
      if (!active || !frame.isConnected || !stageElement.isConnected) return;
      const frameStyle = getComputedStyle(frame);
      const left = parseFloat(frameStyle.left) || 0;
      const top = parseFloat(frameStyle.top) || 0;
      const width = parseFloat(frameStyle.width) || 0;
      const height = parseFloat(frameStyle.height) || 0;
      trackGeometry.set({
        top: trackElement.getBoundingClientRect().top + window.scrollY,
        closingTop: closingElement.getBoundingClientRect().top + window.scrollY,
        width: stageElement.clientWidth,
        height: Math.max(1, stageElement.clientHeight),
      });
      portraitBounds.set({
        top,
        right: Math.max(0, sceneElement.clientWidth - left - width),
        bottom: Math.max(0, sceneElement.clientHeight - top - height),
        left,
        width: sceneElement.clientWidth,
        height: sceneElement.clientHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(trackElement);
    observer.observe(stageElement);
    observer.observe(appElement);
    observer.observe(closingElement);
    observer.observe(frame);
    observer.observe(sceneElement);
    return () => { active = false; observer.disconnect(); };
  }, [portraitBounds, trackGeometry]);

  /* Match the page's actual scroll pixels, including when mobile browser chrome changes size. */
  const distance = useTransform(() => Math.max(0, scrollY.get() - trackGeometry.get().top) / trackGeometry.get().height);
  const closingDistance = useTransform(() => (scrollY.get() - trackGeometry.get().closingTop) / trackGeometry.get().height);
  const sceneY = useTransform(() => Math.min(trackGeometry.get().height, Math.max(0, trackGeometry.get().closingTop - scrollY.get())));
  const sceneVisibility = useTransform(closingDistance, (value) => value > -1 ? "visible" : "hidden");

  /* Freeze the last model pose during entry; continued scroll immediately opens the backdrop. */
  const p = useTransform(() => productStageProgress(distance.get()));
  /* On a slow connection the hero still should not sit under the later chapters. */
  const posterOpacity = useTransform(p, (value) => (value > 0.14 ? 0 : 1));
  /* After the stage: the room blurs and darkens over one more screen, then stays behind the rest of the page. */
  const q = useTransform(() => Math.max(0, closingDistance.get() - CLOSING_SCROLL_SCREENS));
  // The blurred copy takes over a little ahead of the scale, so the mixed stage is short.
  const sceneBlurOpacity = useTransform(q, [0, 0.35], [0, 1]);
  const sceneScale = useTransform(q, [0, 0.5], [1, 1.06]);
  const sceneDark = useTransform(q, [0, 0.5], [0, 0.72]);
  const sceneShade = useTransform(q, [0, 0.3], [1, 0]);
  /* A fully transparent layer still costs a composited surface on phones; hide it until it has something to show. */
  const sceneDarkVisibility = useTransform(sceneDark, (value) => (value > 0.001 ? "visible" : "hidden"));
  const sceneShadeVisibility = useTransform(sceneShade, (value) => (value > 0.001 ? "visible" : "hidden"));
  // The blurred room appears a little before its fade starts, once the portrait is fully open, so its one-time rasterisation never lands inside the expansion.
  const sceneBlurVisibility = useTransform(closingDistance, (value) => (value > CLOSING_SCROLL_SCREENS - 0.12 ? "visible" : "hidden"));

  /* Four times the previous scroll distance, with no wait or ease-in dead zone. */
  const expansion = useTransform(closingDistance, [0, STORY_SCROLL_SCREENS * (0.97 - PORTRAIT_ENTRY_START)], [0, 1]);
  const portraitRadius = useTransform(expansion, [0, 1], [12, 0]);
  // A wide feather once the portrait is open, so the join with the extended background never reads as a rectangle.
  const portraitFeather = useTransform(expansion, [0, 1], ["0px", "56px"]);
  // A fixed mobile gradient can be composited by opacity, rather than painted
  // again for every scroll position. Its final shading matches the desktop art.
  const mobileSceneShade = useTransform(() => expansion.get() * sceneShade.get());
  const mobileSceneShadeVisibility = useTransform(mobileSceneShade, (value) => (value > 0.001 ? "visible" : "hidden"));
  /*
   * Open from the live portrait's exact frame, keeping the photograph stationary.
   * The opening is a plain overflow box whose size and position follow the scroll,
   * with the room inside it translated the opposite way so it never moves. A box clip
   * is applied by the compositor; an animated clip-path made Chrome rasterise the whole
   * room, and a mask for its corners, again on every frame of the expansion.
   */
  // Whole pixels: the box is laid out at a snapped position while the room's counter-move is exact,
  // so a fractional offset would shift the photograph by the remainder as the opening grows.
  const windowTop = useTransform(() => Math.round(portraitBounds.get().top * (1 - expansion.get())));
  const windowLeft = useTransform(() => Math.round(portraitBounds.get().left * (1 - expansion.get())));
  const windowWidth = useTransform(() => {
    const remaining = 1 - expansion.get();
    const bounds = portraitBounds.get();
    return Math.max(0, bounds.width - (bounds.left + bounds.right) * remaining);
  });
  const windowHeight = useTransform(() => {
    const remaining = 1 - expansion.get();
    const bounds = portraitBounds.get();
    return Math.max(0, bounds.height - (bounds.top + bounds.bottom) * remaining);
  });
  const windowRadius = useTransform(expansion, [0, 1], [12, 0]);
  const roomX = useTransform(windowLeft, (value) => -value);
  const roomY = useTransform(windowTop, (value) => -value);
  /* The same opening inside the 100svh stage, whose top edge the fixed room shares. Mobile browser chrome can make the room taller than the stage. */
  const revealHeight = useTransform(() => {
    const remaining = 1 - expansion.get();
    const bounds = portraitBounds.get();
    const size = trackGeometry.get();
    const bottom = Math.max(0, bounds.bottom * remaining + size.height - bounds.height);
    return Math.max(0, size.height - bounds.top * remaining - bottom);
  });

  return (
    <>
      {modelUrl && <ProductAssetHints modelUrl={modelUrl} />}
      {/* The room, fixed behind the page. It appears for the last chapter and stays, blurred and dark, under everything after. */}
      <motion.div className={styles.scene} style={{ y: sceneY, visibility: sceneVisibility }} aria-hidden="true">
        <motion.div className={styles.sceneWindow} style={{ top: windowTop, left: windowLeft, width: windowWidth, height: windowHeight, borderRadius: windowRadius }}>
          <motion.div className={styles.sceneRoom} style={{ x: roomX, y: roomY }}>
            <motion.div className={styles.sceneVisual} style={{ scale: sceneScale }}>
              {/* The existing extended shoulders sit behind the unchanged live portrait. */}
              <div className={styles.sceneExtensionTail} style={{ borderImageSource: `url(${listeningExtension.src})` }} />
              <div className={styles.sceneExtension}>
                <Image src={listeningExtension} alt="" fill sizes="1600px" quality={95} className={styles.extensionImage} />
              </div>
              <motion.div ref={portrait} className={styles.sceneFrame} style={{ borderRadius: mobilePortrait ? 0 : portraitRadius, "--portrait-feather": mobilePortrait ? "16px" : portraitFeather } as MotionStyle}>
                <Image src={scene.image} alt="" fill loading="eager" sizes="(min-width: 1248px) 540px, (min-width: 1024px) calc((94vw - 96px) / 2), 100vw" quality={95} className={styles.sceneImage} />
              </motion.div>
            </motion.div>
            {/* The same room, already blurred; it fades in by opacity so no frame re-blurs the picture. */}
            <motion.div className={`${styles.sceneVisual} ${styles.sceneBlurred}`} style={{ opacity: sceneBlurOpacity, visibility: sceneBlurVisibility }}>
              <div className={styles.sceneExtensionTail} style={{ borderImageSource: `url(${listeningExtension.src})` }} />
              <div className={styles.sceneExtension}>
                <Image src={listeningExtension} alt="" fill sizes="1600px" quality={75} className={styles.extensionImage} />
              </div>
              <div className={styles.sceneFrame} style={{ borderRadius: 0, "--portrait-feather": mobilePortrait ? "16px" : "56px" } as CSSProperties}>
                {/* Eager, like the sharp copy: a lazily loaded image behind a transparent layer never shows before the fade. */}
                <Image src={scene.image} alt="" fill loading="eager" sizes="(min-width: 1248px) 540px, (min-width: 1024px) calc((94vw - 96px) / 2), 100vw" quality={75} className={styles.sceneImage} />
              </div>
            </motion.div>
            <motion.div className={styles.sceneShade} style={{ opacity: mobilePortrait ? mobileSceneShade : sceneShade, visibility: mobilePortrait ? mobileSceneShadeVisibility : sceneShadeVisibility }} />
            <motion.div className={styles.sceneDark} style={{ opacity: sceneDark, visibility: sceneDarkVisibility }} />
          </motion.div>
        </motion.div>
      </motion.div>
      {/* Phones and reduced motion get the same room, already blurred, behind the sections after the stacked ones. */}
      <div className={styles.sceneStatic} aria-hidden="true">
        <div className={styles.sceneFrame}>
          <Image src={scene.image} alt="" fill sizes="100vw" quality={75} className={styles.sceneImage} />
        </div>
      </div>

      <div className={styles.animatedStory} style={{ "--story-scroll-screens": STORY_SCROLL_SCREENS, "--model-scroll-screens": MODEL_SCROLL_SCREENS, "--closing-scroll-screens": CLOSING_SCROLL_SCREENS, "--portrait-expansion-screens": STORY_SCROLL_SCREENS * (0.97 - PORTRAIT_ENTRY_START) } as CSSProperties}>
        <div ref={track} className={styles.track}>
          {/* Anchors for the header links, at the scroll positions where each chapter is on screen. */}
          <span data-anchor="idea" className={styles.anchor} style={{ top: `${STORY_SCROLL_SCREENS * 0.245 * 100}svh` }} aria-hidden="true" />
          <span data-anchor="how-it-works" className={`${styles.anchor} ${styles.technologyAnchor}`} aria-hidden="true" />

          <div ref={stage} className={styles.stage}>
            <div className={styles.storyPane}>
              <div className={styles.storyContent}>
                {/* Chapter 1: headline, product and actions share the first screen. */}
                <Fade progress={p} range={[0, 0.03, 0.07, 0.14]} holdStart className={`${styles.copy} ${styles.heroCopy}`}>
                  <div className={styles.heroIntro}>
                    <p className={`hero-in ${styles.heroStatus}`}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      {v.eyebrow}
                    </p>
                    <h1 id="stage-title" className={`headline ${styles.heroTitle}`}>
                      {v.headline.map((line, i) => (
                        <span key={line} className={"hero-in block " + (i > 0 ? "soft" : "")} style={{ ["--d" as string]: `${120 + i * 80}ms` }}>
                          {line}
                        </span>
                      ))}
                    </h1>
                    {v.subhead && (
                      <p className={`hero-in whitespace-pre-line ${styles.heroText}`} style={{ ["--d" as string]: "300ms" }}>
                        {v.subhead}
                      </p>
                    )}
                  </div>
                </Fade>

                {/* Chapters 2–4: one clear message for each model state. */}
                {storyChapters.map(({ copy, range }) => (
                  <Fade key={copy.headline[0]} progress={p} range={range} className={`${styles.copy} ${styles.heroCopy}`}>
                    <header className={styles.storyIntro}>
                      <h2 className={`headline ${styles.heroTitle}`}>
                        {copy.headline.map((line, i) => (
                          <span key={line} className={i === 0 ? "block" : "soft block"}>{line}</span>
                        ))}
                      </h2>
                      <p className={styles.lede}>{copy.description}</p>
                    </header>
                  </Fade>
                ))}

                {/* One persistent form keeps the same action and entered email across chapters. */}
                <div className={styles.storySignup}>
                  <HeroSignup mode={mode} v={v} />
                </div>
              </div>

              {/* The pair moves onto the mannequin; further scrolling progressively lights the surface fibres. */}
              <div className={styles.flight}>
                <motion.div className={styles.media} data-product-model={failed || !modelUrl ? "fallback" : ready ? "loaded" : "loading"}>
                  {!failed && modelUrl && <div className={styles.modelWindow}>
                    <StageScene progress={p} readProgress={readProgress} modelUrl={modelUrl} onReady={onReady} onLoading={onLoading} onError={onError} verticalOverscan={0.12} />
                  </div>}
                  {/* The poster covers loading; no label is needed over it. */}
                  {posterUrl && (
                    <motion.div className={styles.posterLayer} style={{ opacity: posterOpacity }}>
                      <HeroPoster src={posterUrl} ready={ready} priority />
                    </motion.div>
                  )}
                  {failed && modelUrl && <ModelRecoveryNotice onRetry={retry} />}
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        <div ref={appSection} className={styles.appSection}>
          <AppPreview />
        </div>

        <div ref={closingTrack} className={styles.closingTrack}>
          <span data-nav-dark-start className={`${styles.anchor} ${styles.closingThemeAnchor}`} aria-hidden="true" />
          <div className={styles.stage}>
            {/* Only the portrait pins here; the app above remains in normal flow. */}
            <div className={styles.closingPane}>
              <ClosingCopy variant={v.id} />
              <motion.div className={styles.closingReveal} style={{ top: windowTop, left: windowLeft, width: windowWidth, height: revealHeight, borderRadius: windowRadius }} aria-hidden="true" inert>
                <motion.div className={styles.closingRevealContent} style={{ x: roomX, y: roomY }}>
                  <ClosingCopy variant={v.id} visualOnly />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.fallback}>{fallback}</div>
    </>
  );
}
