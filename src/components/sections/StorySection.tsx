import Image, { type StaticImageData } from "next/image";
import { defaultVariant, reservation, type HeroVariant } from "@/config/site";
import { Container, Headline } from "../ui";
import { HeroModel } from "../HeroModel";
import type { HeroPose } from "../three/HeroScene";
import styles from "./HowItWorks.module.css";
import heroStyles from "./Hero.module.css";

export type StoryModelProps = { modelUrl?: string | null; posterUrl?: string | null; variant?: HeroVariant["id"] };

/** A shared frame keeps the stacked story's model area independent of its copy. */
export function StorySection({
  id,
  legacyAnchor,
  headline,
  description,
  image,
  imageAlt,
  imageFirst = false,
  modelUrl = null,
  posterUrl = null,
  pose = "inner",
  variant = defaultVariant,
}: StoryModelProps & {
  id: string;
  legacyAnchor?: string;
  headline: readonly [string, string?];
  description: string;
  image: StaticImageData;
  imageAlt: string;
  imageFirst?: boolean;
  pose?: HeroPose;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={styles.section}>
      {legacyAnchor && <span id={legacyAnchor} className={styles.legacyAnchor} aria-hidden="true" />}
      <Container>
        <div className={`${styles.layout} ${imageFirst ? styles.imageFirst : ""}`}>
          <header className={`${styles.intro} reveal`}>
            <Headline id={`${id}-title`} lines={[headline[0], headline[1]]} className={heroStyles.title} />
            <p className={styles.lede}>{description}</p>
          </header>
          <figure className={`${styles.figure} reveal`}>
            <HeroModel modelUrl={modelUrl} posterUrl={posterUrl ?? image.src} pose={pose} className={styles.live} />
            <Image
              src={image}
              alt={imageAlt}
              sizes="(min-width: 1024px) 480px, (min-width: 640px) 576px, calc(100vw - 40px)"
              quality={90}
              className={`${styles.image} ${styles.still}`}
            />
          </figure>
          <div className={`${styles.actions} reveal`}>
            <a href="#signup" data-cta={`${id}_waitlist`} className="btn-primary">Join the waitlist</a>
            <a href={`${reservation.path}?v=${variant}`} data-cta={`${id}_reserve`} className={styles.reserve}>
              Reserve yours <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
