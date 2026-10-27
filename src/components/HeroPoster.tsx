import mobilePoster from "../../public/models/cymba-earbuds-hero-poster-mobile.webp";
import styles from "./HeroPoster.module.css";

/** Captured from the same camera rectangle, zoom and materials as each viewer. */
export function HeroPoster({ src, ready, priority = false }: { src: string; ready: boolean; priority?: boolean }) {
  return <picture className={styles.poster} data-hero-poster data-ready={ready || undefined} aria-hidden="true">
    <source media="(max-width: 1023px)" srcSet={mobilePoster.src} />
    {/* The browser chooses one small, pre-rendered asset before hydration. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt="" width={1260} height={1410} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" />
  </picture>;
}
