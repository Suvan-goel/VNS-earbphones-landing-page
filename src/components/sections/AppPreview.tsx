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
          <p className={styles.eyebrow}>Cymba app</p>
          <h2 id={titleId} className={`headline ${styles.title}`}>
            <span className="block">Your deep work,</span>
            <span className="soft block">in one place.</span>
          </h2>
          <p className={styles.description}>See your signals, track your sessions and pick up where you left off.</p>
        </header>
        <figure className={styles.visual}>
          <Image
            src={appMockup}
            alt="Cymba app concept on a laptop and phone, showing a work session timer, brain and pulse signals, stimulation activity and recent sessions."
            sizes="(min-width: 1440px) 1000px, (min-width: 1024px) 68vw, (min-width: 768px) 90vw, 100vw"
            quality={90}
            className={styles.image}
          />
        </figure>
      </div>
    </section>
  );
}
