import Image from "next/image";
import heroImage from "@/assets/earbuds/hero-premium-pair-v4.webp";
import { site, type HeroVariant } from "@/config/site";
import type { StorageMode } from "@/lib/storage";
import { HeroModel } from "../HeroModel";
import { HeroSignup } from "../HeroSignup";
import { Container } from "../ui";
import styles from "./Hero.module.css";

export function Hero({ mode, v, modelUrl = null, posterUrl = null, reservations = false }: { mode: StorageMode; v: HeroVariant; modelUrl?: string | null; posterUrl?: string | null; reservations?: boolean }) {
  return (
    <section id="top" aria-labelledby="hero-title" data-hero className={styles.hero}>
      <Container className={styles.layout}>
        <div data-hero-copy className={styles.copy}>
          <div className={styles.intro}>
            <h1 id="hero-title" className={`headline ${styles.title}`}>
              {v.headline.map((line, i) => (
                <span key={line} className={"hero-in block " + (i > 0 ? "soft" : "")} style={{ ["--d" as string]: `${80 + i * 60}ms` }}>
                  {line}
                </span>
              ))}
            </h1>
            {v.subhead && (
              <p className={`hero-in whitespace-pre-line ${styles.description}`} style={{ ["--d" as string]: "180ms" }}>
                {v.subhead}
              </p>
            )}
          </div>
          <div className={`hero-in ${styles.signup}`} style={{ ["--d" as string]: "240ms" }}>
            <HeroSignup mode={mode} v={v} reservations={reservations} />
          </div>
        </div>

        {/* The live model, or the still for readers who prefer reduced motion. */}
        <figure data-hero-media className={`product-in ${styles.media}`}>
          <HeroModel modelUrl={modelUrl} posterUrl={posterUrl} className={styles.live} />
          <Image
            src={posterUrl ?? heroImage}
            width={posterUrl ? 1200 : 1600}
            height={posterUrl ? 1344 : 900}
            alt={`${site.product} earbuds with two softly fading trailing cables.`}
            priority
            quality={95}
            sizes="(min-width: 704px) 640px, (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
            className={`${styles.product} ${styles.still}`}
          />
        </figure>
      </Container>
    </section>
  );
}
