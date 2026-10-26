import Image from "next/image";
import cognitionImage from "@/assets/earbuds/listening-portrait-selected-retouch-v2.webp";
import { site } from "@/config/site";
import { productStory } from "@/config/product-story";
import { Container } from "../ui";

export function ProductReveal() {
  return (
    <section id="idea" aria-labelledby="idea-title" className="product-reveal">
      <Container className="product-reveal__layout">
        <header className="product-reveal__intro reveal">
          <h2 id="idea-title" className="product-reveal__title">
            {productStory.work.headline.map((line) => <span key={line}>{line}</span>)}
          </h2>
        </header>

        <figure className="product-reveal__scene reveal">
          <div className="product-reveal__stage">
            <Image
              src={cognitionImage}
              alt={`A man wearing a matte black ${site.brand} earbud with a champagne rim and braided cable looks upward against a studio-grey background.`}
              fill
              quality={95}
              sizes="(min-width: 1248px) 540px, (min-width: 1024px) calc((94vw - 96px) / 2), (min-width: 640px) 576px, calc(100vw - 40px)"
              className="product-reveal__image"
            />
          </div>
        </figure>

        <ul role="list" className="product-reveal__benefits">
          {productStory.work.examples.map((example) => (
            <li key={example} className="product-reveal__benefit reveal">
              <p className="product-reveal__benefit-title">{example}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
