import Image from "next/image";
import listeningScene from "@/assets/earbuds/listening-portrait-selected-retouch-v2.webp";
import listeningExtension from "@/assets/earbuds/listening-portrait-studio-grey-wide-v3.webp";
import { closingCta, closingHeadline, reservation, site, type HeroVariant } from "@/config/site";
import styles from "./Worn.module.css";

/* The ending of the desktop story as a single frame, for the stacked layout. */
export function Worn({ variant }: { variant: HeroVariant["id"] }) {
  return (
    <section aria-labelledby="worn-title" data-nav-dark-start className={styles.section}>
      <div className={styles.extensionTail} style={{ borderImageSource: `url(${listeningExtension.src})` }} aria-hidden="true" />
      <div className={styles.extensionFrame} aria-hidden="true">
        <Image src={listeningExtension} alt="" fill sizes="1600px" quality={95} className={styles.extensionImage} />
      </div>
      <div className={styles.imageFrame}>
        <Image
          src={listeningScene}
          alt={`A man in a black sweater wearing ${site.product} against a grey studio background.`}
          fill
          sizes="(min-width: 1248px) 540px, (min-width: 1024px) calc((94vw - 96px) / 2), 100vw"
          quality={95}
          className={styles.image}
        />
      </div>
      <div className={styles.shade} />
      <div className={styles.copy}>
        <h2 id="worn-title" className={`headline ${styles.title}`}>
          <span className="block">{closingHeadline[0]}</span>
          <span className={`block ${styles.soft}`}>{closingHeadline[1]}</span>
        </h2>
        <div className={styles.actions}>
          <a href="#signup" data-cta="worn" className={`btn-primary ${styles.cta}`}>
            {closingCta}
          </a>
          <a href={`${reservation.path}?v=${variant}`} data-cta="worn_reserve" className={styles.reserve}>
            Reserve yours <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
