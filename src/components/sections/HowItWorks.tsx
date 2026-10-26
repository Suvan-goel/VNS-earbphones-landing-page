import Image from "next/image";
import networkImage from "@/assets/earbuds/science-network-earbuds-v2.png";
import { site } from "@/config/site";
import { productStory } from "@/config/product-story";
import { Container, Eyebrow, Headline } from "../ui";
import { HeroModel } from "../HeroModel";
import styles from "./HowItWorks.module.css";

export function HowItWorks({ modelUrl = null, posterUrl = null }: { modelUrl?: string | null; posterUrl?: string | null }) {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className={styles.section}>
      <span id="science" className={styles.legacyAnchor} aria-hidden="true" />
      <Container>
        <div className={styles.layout}>
          <header className={`${styles.intro} reveal`}>
            <Eyebrow>How it works</Eyebrow>
            <Headline id="how-it-works-title" lines={productStory.technology.headline} className={styles.title} />
            <p className={styles.lede}>
              {productStory.technology.description}
            </p>
          </header>

          {/* The ear side of the bud, live, with the sensor and contacts lit; the illustration stands in under reduced motion. */}
          <figure className={`${styles.figure} reveal`}>
            <HeroModel modelUrl={modelUrl} posterUrl={posterUrl} pose="inner" className={styles.live} />
            <Image
              src={networkImage}
              alt={`A white stone sculpture wearing a ${site.product} wired earbud, with a transparent back showing a pink pathway from the ear connecting to branching purple fibres inside the head. A simplified illustration of the proposed signalling pathway.`}
              sizes="(min-width: 1024px) 420px, (min-width: 600px) 380px, (min-width: 340px) 300px, calc(100vw - 40px)"
              quality={90}
              className={`${styles.image} ${styles.still}`}
            />
          </figure>

          <ol role="list" className={`${styles.steps} reveal`}>
            {productStory.technology.steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.number} aria-hidden="true">0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.line}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
