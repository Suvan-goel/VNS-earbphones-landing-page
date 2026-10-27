import Image from "next/image";
import studyImage from "@/assets/earbuds/breakthrough-natural-v1/study.webp";
import deskImage from "@/assets/earbuds/breakthrough-natural-v1/deep-work.webp";
import ideasImage from "@/assets/earbuds/cognition-ideas-v2.webp";
import { site } from "@/config/site";
import { Container, Headline } from "../ui";
import styles from "./Research.module.css";

/* Three moments that connect CYMBA's cognitive ambition to the reader's goals. */
const moments = [
  {
    image: deskImage,
    label: "Solve complex problems",
    line: "Untangle difficult code and work through unfamiliar problems.",
    alt: `An evening workspace with a computer, keyboard and a scrap of notes on a wooden desk, with ${site.product} earbuds resting beside the keyboard.`,
  },
  {
    image: studyImage,
    label: "Learn difficult material",
    line: "Get to grips with technical papers and complex concepts.",
    alt: `An open notebook with handwritten study notes, a reference book and pencil on a pale table, with small ${site.product} earbuds set to one side.`,
  },
  {
    image: ideasImage,
    label: "Develop new ideas",
    line: "Explore possibilities and turn your ideas into a plan.",
    alt: `A woman wearing ${site.product} earbuds sketches ideas in a notebook and arranges diagrams on a wooden desk.`,
  },
];

export function Research() {
  return (
    <section id="research" aria-labelledby="research-title" className={styles.section}>
      <Container className={styles.layout}>
        <header className={`${styles.intro} reveal`}>
          <Headline id="research-title" lines={["For the work", "that matters to you."]} className={styles.title} />
        </header>

        <ul role="list" className={styles.moments}>
          {moments.map((m) => (
            <li key={m.label} className={`${styles.moment} reveal`}>
              <figure className={styles.figure}>
                <Image
                  src={m.image}
                  alt={m.alt}
                  fill
                  sizes="(min-width: 1330px) 400px, (min-width: 1024px) 30vw, (min-width: 600px) 160px, (min-width: 400px) 104px, (min-width: 339px) 26vw, 88px"
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
