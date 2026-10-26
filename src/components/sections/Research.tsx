import Image from "next/image";
import studyImage from "@/assets/earbuds/breakthrough-natural-v1/study.webp";
import deskImage from "@/assets/earbuds/breakthrough-natural-v1/deep-work.webp";
import learningImage from "@/assets/earbuds/breakthrough-natural-v1/learning-art-v2.png";
import { site } from "@/config/site";
import { Container, Eyebrow, Headline } from "../ui";
import styles from "./Research.module.css";

/* Three moments that connect CYMBA's cognitive ambition to the reader's goals. */
const moments = [
  {
    image: studyImage,
    label: "Study",
    line: "For working through complex ideas and building lasting understanding.",
    alt: `An open notebook with handwritten study notes, a reference book and pencil on a pale table, with small ${site.product} earbuds set to one side.`,
  },
  {
    image: deskImage,
    label: "Deep work",
    line: "For the projects and problems that need your full attention.",
    alt: `An evening workspace with a computer, keyboard and a scrap of notes on a wooden desk, with ${site.product} earbuds resting beside the keyboard.`,
  },
  {
    image: learningImage,
    label: "Learning something new",
    line: "For building a new skill, one practice session at a time.",
    alt: `Simple colourful watercolours of oranges, a landscape and flowers on loose A4 sheets scattered across a wooden desk, with brushes, paints and small ${site.product} earbuds.`,
  },
];

export function Research() {
  return (
    <section id="research" aria-labelledby="research-title" className={styles.section}>
      <Container className={styles.layout}>
        <header className={`${styles.intro} reveal`}>
          <Eyebrow>Everyday use</Eyebrow>
          <Headline id="research-title" lines={["For your next", "breakthrough."]} className={styles.title} />
        </header>

        <ul role="list" className={styles.moments}>
          {moments.map((m) => (
            <li key={m.label} className={`${styles.moment} reveal`}>
              <figure className={styles.figure}>
                <Image
                  src={m.image}
                  alt={m.alt}
                  fill
                  sizes="(min-width: 1330px) 400px, (min-width: 1024px) 30vw, (min-width: 600px) 160px, (min-width: 380px) 112px, 88px"
                  className={styles.image}
                />
              </figure>
              <div className={styles.copy}>
                <h3 className={styles.momentTitle}>{m.label}</h3>
                <p className={styles.description}>{m.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
