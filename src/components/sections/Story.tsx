import Image from "next/image";
import soundImage from "@/assets/earbuds/site-imagery-v2/08-sound.webp";
import { site } from "@/config/site";
import { Container, Eyebrow } from "../ui";
import styles from "./Sound.module.css";

export function Sound() {
  return (
    <section id="sound" aria-labelledby="sound-title" className={`${styles.section} scroll-mt-20`}>
      <Container>
        <header className={styles.header}>
          <Eyebrow>Sound</Eyebrow>
          <h2 id="sound-title" className={styles.title}>Sounds as good <span>as it feels.</span></h2>
          <p className={styles.lede}>A dedicated driver and a wired connection. No latency, no battery, nothing to pair.</p>
        </header>
      </Container>

      <figure className={styles.figure}>
        <Image
          src={soundImage}
          alt={`A single ${site.product} earbud suspended at a diagonal against a dark slate background with soft curved light, its faceplate toward the viewer and cable sweeping to the right.`}
          sizes="(min-width: 1330px) 1234px, (min-width: 1024px) calc(100vw - 96px), (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
          quality={90}
          className={styles.image}
        />
      </figure>


    </section>
  );
}
