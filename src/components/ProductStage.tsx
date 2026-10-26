"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionValue, useScroll, useTransform, type MotionStyle, type MotionValue } from "motion/react";
import listeningScene from "@/assets/earbuds/listening-portrait-selected-retouch-v2.webp";
import listeningExtension from "@/assets/earbuds/listening-portrait-studio-grey-wide-v3.webp";
import { closingHeadline, closingLine, reservation, site, type HeroVariant } from "@/config/site";
import type { StorageMode } from "@/lib/storage";
import { productStory } from "@/config/product-story";
import { STORY_SCROLL_SCREENS, PORTRAIT_ENTRY_START, PORTRAIT_ENTRY_SCREENS, productStageProgress, readProductStageProgress } from "@/lib/product-stage-scroll";
import { HeroSignup } from "./HeroSignup";
import { ModelLoadingNotice, ModelRecoveryNotice } from "./ModelRecoveryNotice";
import styles from "./ProductStage.module.css";

/* The 3D stage only runs in the browser. */
const StageScene = dynamic(() => import("./three/StageScene").then((m) => m.StageScene), { ssr: false });

/*
 * One object, one scroll. The product stays pinned while four chapters of
 * copy pass it; every move is driven by scroll position, so it reverses
 * when the reader scrolls back. After the model settles, the next section scrolls into place.
 *
 * Progress (0..1) along the track:
 *   0.00–0.12  hero: copy left, product full size on the right, turning from the first scroll
 *   0.17–0.46  outcomes: a slower turn, then the mannequin appears and the pair settles
 *   0.46–0.72  how it works: live signals travel from the ears to the brain
 *   0.73–0.85  a closer view of the animated neural network
 *   0.85–1.00  the portrait: scroll into place, then expand with continued scrolling
 *
 * One stage, two shapes: on desktop the copy sits left and the product right;
 * on phones the product sits in a sticky band across the top and the same
 * chapters pass beneath it. Readers who prefer reduced motion, and very short
 * screens, get `fallback` (the stacked sections) via CSS instead.
 */

/* Keep the ending photograph identical to the live portrait. */
const scene = { image: listeningScene };

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

/* A list item that rises in when the reader reaches it and stays. */
function Rise({ progress, at, children }: { progress: MotionValue<number>; at: number; children: ReactNode }) {
  const opacity = useTransform(progress, [at - 0.02, at + 0.01], [0, 1]);
  const y = useTransform(progress, [at - 0.02, at + 0.01], [16, 0]);
  return <motion.li style={{ opacity, y }}>{children}</motion.li>;
}

/* The current beat stays bright; the others sit back. */
function Highlight({ progress, start, end, children }: { progress: MotionValue<number>; start: number; end: number; children: ReactNode }) {
  const opacity = useTransform(progress, [start - 0.03, start, end, end + 0.03], [0.32, 1, 1, 0.32]);
  return <motion.li style={{ opacity }}>{children}</motion.li>;
}

/* One layout for both ink colours keeps the reveal aligned down to each letter. */
function ClosingCopy({ reservations, cta, visualOnly = false }: { reservations: boolean; cta: string; visualOnly?: boolean }) {
  const Heading = visualOnly ? "div" : "h2";
  const label = reservations ? reservation.cta : cta;
  return (
    <div className={`${styles.copy} ${styles.closingCopy} ${visualOnly ? styles.copyOnScene : ""}`}>
      <div className={styles.closingIntro}>
        <Heading className={`headline ${styles.title}`}>
          <span className="block">{closingHeadline[0]}</span>
          <span className="soft block">{closingHeadline[1]}</span>
        </Heading>
        <p className={styles.lede}>{closingLine(reservations)}</p>
      </div>
      {visualOnly ? (
        <span className={`btn-primary ${styles.sceneCta}`}>{label}</span>
      ) : (
        <a href={reservations ? reservation.path : "#signup"} data-cta="stage" className={`btn-primary ${styles.sceneCta}`}>
          {label}
        </a>
      )}
    </div>
  );
}

export function ProductStage({
  mode,
  v,
  modelUrl,
  posterUrl = null,
  reservations = false,
  fallback,
}: {
  mode: StorageMode;
  v: HeroVariant;
  modelUrl: string | null;
  /** A still of the model shown until the 3D scene is ready. */
  posterUrl?: string | null;
  /** Deposits are open: the closing chapter and the form offer the reservation. */
  reservations?: boolean;
  fallback: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const portrait = useRef<HTMLDivElement>(null);
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
  const readProgress = useCallback(() => readProductStageProgress(track.current, stage.current), []);

  const { scrollY } = useScroll();
  const trackGeometry = useMotionValue({ top: 0, width: 1, height: 1 });
  const portraitBounds = useMotionValue({ top: 72, right: 0, bottom: 0, left: 0, width: 1, height: 1 });

  useEffect(() => {
    const trackElement = track.current;
    const stageElement = stage.current;
    const frame = portrait.current;
    const sceneElement = frame?.parentElement;
    if (!trackElement || !stageElement || !frame || !sceneElement) return;
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
    observer.observe(frame);
    observer.observe(sceneElement);
    return () => { active = false; observer.disconnect(); };
  }, [portraitBounds, trackGeometry]);

  /* Match the page's actual scroll pixels, including when mobile browser chrome changes size. */
  const distance = useTransform(() => Math.max(0, scrollY.get() - trackGeometry.get().top) / trackGeometry.get().height);
  const entry = useTransform(() => Math.min(PORTRAIT_ENTRY_SCREENS, Math.max(0, distance.get() - STORY_SCROLL_SCREENS * PORTRAIT_ENTRY_START)));
  const storyY = useTransform(() => -entry.get() * trackGeometry.get().height);
  const sceneY = useTransform(() => (PORTRAIT_ENTRY_SCREENS - entry.get()) * trackGeometry.get().height);
  const sceneVisibility = useTransform(entry, (value) => value > 0 ? "visible" : "hidden");

  /* Freeze the last model pose during entry; continued scroll immediately opens the backdrop. */
  const p = useTransform(() => productStageProgress(distance.get()));
  /* After the stage: the room blurs and darkens over one more screen, then stays behind the rest of the page. */
  const q = useTransform(() => Math.max(0, distance.get() - STORY_SCROLL_SCREENS - PORTRAIT_ENTRY_SCREENS));
  const sceneBlur = useTransform(q, [0, 0.5], ["blur(0px)", "blur(18px)"]);
  const sceneScale = useTransform(q, [0, 0.5], [1, 1.06]);
  const sceneDark = useTransform(q, [0, 0.5], [0, 0.72]);
  const sceneShade = useTransform(q, [0, 0.3], [1, 0]);

  /* Four times the previous scroll distance, with no wait or ease-in dead zone. */
  const expansion = useTransform(p, [PORTRAIT_ENTRY_START, 0.97], [0, 1]);
  const portraitRadius = useTransform(expansion, [0, 1], [12, 0]);
  const portraitFeather = useTransform(expansion, [0, 1], ["0px", "24px"]);
  /* Open from the live portrait's exact frame, keeping the photograph stationary. */
  const sceneClip = useTransform(() => {
    const remaining = 1 - expansion.get();
    const bounds = portraitBounds.get();
    return `inset(${bounds.top * remaining}px ${bounds.right * remaining}px ${bounds.bottom * remaining}px ${bounds.left * remaining}px round ${12 * remaining}px)`;
  });
  const closingClip = useTransform(() => {
    const remaining = 1 - expansion.get();
    const bounds = portraitBounds.get();
    const size = trackGeometry.get();
    /* Mobile browser chrome can make the fixed image taller than the 100svh stage. */
    const right = bounds.right * remaining + size.width - bounds.width;
    const bottom = bounds.bottom * remaining + size.height - bounds.height;
    return `inset(${bounds.top * remaining}px ${right}px ${bottom}px ${bounds.left * remaining}px round ${12 * remaining}px)`;
  });
  const introCaptionOpacity = useTransform(p, [0.28, 0.44], [1, 0]);

  /* The room changes tone with the chapter, with no borders. */
  const paperTone = useTransform(p, [0.15, 0.25, 0.7, 0.8], [0, 1, 1, 0]);
  const background = useTransform(() => {
    const tone = paperTone.get();
    return `rgb(${245 + 10 * tone}, ${245 + 10 * tone}, ${247 + 8 * tone})`;
  });

  return (
    <>
      {/* The room, fixed behind the page. It appears for the last chapter and stays, blurred and dark, under everything after. */}
      <motion.div className={styles.scene} style={{ clipPath: sceneClip, y: sceneY, visibility: sceneVisibility, "--portrait-expansion": expansion } as MotionStyle} aria-hidden="true">
        <motion.div className={styles.sceneVisual} style={{ filter: sceneBlur, scale: sceneScale }}>
          {/* The existing extended shoulders sit behind the unchanged live portrait. */}
          <div className={styles.sceneExtensionTail} style={{ borderImageSource: `url(${listeningExtension.src})` }} />
          <div className={styles.sceneExtension}>
            <Image src={listeningExtension} alt="" fill sizes="1600px" quality={95} className={styles.extensionImage} />
          </div>
          <motion.div ref={portrait} className={styles.sceneFrame} style={{ borderRadius: portraitRadius, "--portrait-feather": portraitFeather } as MotionStyle}>
            <Image src={scene.image} alt="" fill loading="eager" sizes="(min-width: 1248px) 540px, (min-width: 1024px) calc((94vw - 96px) / 2), 100vw" quality={95} className={styles.sceneImage} />
          </motion.div>
        </motion.div>
        <motion.div className={styles.sceneShade} style={{ opacity: sceneShade }} />
        <motion.div className={styles.sceneDark} style={{ opacity: sceneDark }} />
      </motion.div>
      {/* Phones and reduced motion get the same room, already blurred, behind the sections after the stacked ones. */}
      <div className={styles.sceneStatic} aria-hidden="true">
        <div className={styles.sceneFrame}>
          <Image src={scene.image} alt="" fill sizes="100vw" quality={75} className={styles.sceneImage} />
        </div>
      </div>

      <div ref={track} className={styles.track} style={{ "--story-scroll-screens": STORY_SCROLL_SCREENS, "--portrait-entry-start": PORTRAIT_ENTRY_START, "--portrait-entry-screens": PORTRAIT_ENTRY_SCREENS } as CSSProperties}>
        {/* Switch the header as the expanding backdrop reaches the navigation. */}
        <span data-nav-dark-start className={`${styles.anchor} ${styles.closingThemeAnchor}`} aria-hidden="true" />
        {/* Anchors for the header links, at the scroll positions where each chapter is on screen. */}
        <span data-anchor="idea" className={styles.anchor} style={{ top: `${STORY_SCROLL_SCREENS * 0.245 * 100}svh` }} aria-hidden="true" />
        <span data-anchor="how-it-works" className={styles.anchor} style={{ top: `${STORY_SCROLL_SCREENS * 0.572 * 100}svh` }} aria-hidden="true" />

        <div ref={stage} className={styles.stage}>
          <motion.div className={styles.storyPane} style={{ backgroundColor: background, y: storyY }}>
            {/* Chapter 1: the hero, the first frame of the same system, with more air. The words rise in once on load. */}
            <Fade progress={p} range={[0, 0.03, 0.07, 0.14]} holdStart className={`${styles.copy} ${styles.heroCopy}`}>
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
              <div className={`hero-in ${styles.heroForm}`} style={{ ["--d" as string]: "400ms" }}>
                <HeroSignup mode={mode} v={v} reservations={reservations} />
              </div>
            </Fade>

            {/* Chapter 2: the work that calls for sustained thinking. */}
            <Fade progress={p} range={[0.17, 0.23, 0.4, 0.45]} className={styles.copy}>
              <h2 className={`headline ${styles.title}`}>
                {productStory.work.headline.map((line, i) => (
                  <span key={line} className={i === 0 ? "block" : "soft block"}>{line}</span>
                ))}
              </h2>
              <ul role="list" className={styles.outcomes}>
                {productStory.work.examples.map((example, i) => (
                  <Rise key={example} progress={p} at={0.25 + i * 0.05}>
                    <p className={styles.itemTitle}>{example}</p>
                  </Rise>
                ))}
              </ul>
            </Fade>

            {/* Chapter 3: how it works. */}
            <Fade progress={p} range={[0.46, 0.51, 0.68, 0.72]} className={styles.copy}>
              <p className={styles.eyebrow}>How it works</p>
              <h2 className={`headline ${styles.title}`}>
                {productStory.technology.headline.map((line, i) => (
                  <span key={line} className={i === 0 ? "block" : "soft block"}>{line}</span>
                ))}
              </h2>
              <p className={styles.lede}>{productStory.technology.description}</p>
              <ol role="list" className={styles.beats}>
                {productStory.technology.steps.map((b, i) => (
                  <Highlight key={b.title} progress={p} start={0.52 + i * 0.055} end={0.52 + (i + 1) * 0.055}>
                    <h3 className={styles.itemTitle}>{b.title}</h3>
                    <p className={styles.itemLine}>{b.line}</p>
                  </Highlight>
                ))}
              </ol>
            </Fade>

            {/* Chapter 4: the live signal illustration. */}
            <Fade progress={p} range={[0.73, 0.77, 0.85, 0.86]} className={styles.copy}>
              <h2 className={`headline ${styles.title}`}>
                <span className="block">Follow</span>
                <span className="soft block">the signal.</span>
              </h2>
              <p className={styles.lede}>
                Sound, sensing and gentle stimulation come together at the ear.
              </p>
            </Fade>

            {/* The pair moves onto the mannequin; further scrolling progressively lights the surface fibres. */}
            <div className={styles.flight}>
              <motion.div className={styles.media} data-product-model={failed || !modelUrl ? "fallback" : ready ? "loaded" : "loading"}>
                {!failed && modelUrl && <StageScene progress={p} readProgress={readProgress} modelUrl={modelUrl} onReady={onReady} onLoading={onLoading} onError={onError} />}
                {posterUrl && <Image src={posterUrl} alt="" fill sizes="50vw" quality={95} priority className={styles.poster} data-ready={ready || undefined} />}
                {!ready && !failed && modelUrl && <ModelLoadingNotice />}
                {failed && modelUrl && <ModelRecoveryNotice onRetry={retry} />}
              </motion.div>
            </div>
            <motion.p className={styles.caption} style={{ opacity: introCaptionOpacity }}>
              {`Scroll to explore ${site.product}`}
            </motion.p>
          </motion.div>

          {/* Chapter 5 enters beside the portrait, with light ink only inside the expanding image. */}
          <motion.div className={styles.closingPane} style={{ y: sceneY, visibility: sceneVisibility }}>
            <ClosingCopy reservations={reservations} cta={v.primaryCta} />
            <motion.div className={styles.closingReveal} style={{ clipPath: closingClip }} aria-hidden="true" inert>
              <ClosingCopy reservations={reservations} cta={v.primaryCta} visualOnly />
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className={styles.fallback}>{fallback}</div>
    </>
  );
}
