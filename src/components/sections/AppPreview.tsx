import Image from "next/image";
import { useId } from "react";
import appMockup from "@/assets/app/cymba-app-devices-gold-v1.png";
import styles from "./AppPreview.module.css";

export function AppPreview() {
  const titleId = useId();

  return (
    <section className={styles.section} aria-labelledby={titleId} data-app-preview>
      <div className={styles.content}>
        <header className={styles.copy}>
          <p className={styles.eyebrow}>cymba app</p>
          <h2 id={titleId} className={`headline ${styles.title}`}>
            <span className="block">For those who</span>
            <span className="soft block">want their best</span>
          </h2>
          <p className={styles.description}>Go beyond tracking. Discover patterns in your brain activity, get personalised insights and let cymba’s AI optimise stimulation around what works for your brain.</p>
        </header>
        <figure className={styles.visual}>
          <Image
            src={appMockup}
            alt="cymba app concept on a laptop and phone, showing a work session timer, brain and pulse signals, stimulation activity and recent sessions."
            sizes="(min-width: 1440px) 860px, (min-width: 1024px) 58vw, (min-width: 768px) 90vw, 100vw"
            quality={90}
            className={styles.image}
          />
        </figure>
      </div>
    </section>
  );
}
