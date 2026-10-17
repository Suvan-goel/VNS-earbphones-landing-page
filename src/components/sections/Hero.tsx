import type { HeroVariant } from "@/config/site";
import { ConceptCaption, Container, CtaButton, TextLink } from "../ui";
import { HeroPair } from "../visuals/HeroPair";

const pillars = [
  { n: "01", t: "Exceptional wired sound", s: "A genuinely great pair of earphones first." },
  { n: "02", t: "Built-in ear stimulation", s: "Gentle, non-invasive taVNS, in development." },
  { n: "03", t: "Research-stage sensing", s: "Exploring ear-EEG and optical pulse signals." },
];

export function Hero({ v }: { v: HeroVariant }) {
  return (
    <section id="top" className="grain relative overflow-hidden bg-ink text-bone">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_72%_52%,rgba(201,196,186,0.14),transparent_70%),radial-gradient(30%_25%_at_70%_60%,rgba(255,90,31,0.07),transparent_70%)]"
      />
      <Container className="relative grid min-h-[100svh] grid-cols-1 content-center gap-y-6 pt-24 pb-10 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-6 lg:pt-24">
        <div className="lg:col-span-6 lg:row-start-1 lg:self-end">
          <p className="hero-in tag text-bone/60" style={{ ["--d" as string]: "0ms" }}>
            <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            {v.eyebrow}
          </p>
          <h1 className="display mt-6 text-[clamp(2.6rem,5.8vw,4.7rem)]">
            {v.headline.map((line, i) => (
              <span key={i} className="hero-in block" style={{ ["--d" as string]: `${120 + i * 110}ms` }}>
                {line}
              </span>
            ))}
          </h1>
        </div>

        <div className="product-in relative -mx-5 -my-2 sm:mx-0 lg:col-span-6 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:-mr-12 lg:-ml-6 lg:self-center">
          <div className="float-slow">
            <HeroPair className="mx-auto h-auto w-full max-w-[560px] lg:max-w-none" />
          </div>
          <ConceptCaption className="mt-1 justify-center px-5 text-bone sm:absolute sm:bottom-0 sm:right-0 sm:mt-0 sm:px-0" />
        </div>

        <div className="lg:col-span-6 lg:row-start-2 lg:self-start">
          <p className="hero-in max-w-[34rem] text-[1.06rem] leading-relaxed text-bone/65 sm:text-lg" style={{ ["--d" as string]: "380ms" }}>
            {v.subhead}
          </p>
          <div className="hero-in mt-8 flex flex-wrap items-center gap-x-6 gap-y-3" style={{ ["--d" as string]: "500ms" }}>
            <CtaButton location="hero">{v.primaryCta}</CtaButton>
            <TextLink href="#technology" cta="hero_secondary" className="text-bone/75 hover:text-bone">
              {v.secondaryCta}
            </TextLink>
          </div>
        </div>

        <ul className="hero-in mt-6 grid lg:row-start-3 grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3 lg:col-span-12" style={{ ["--d" as string]: "700ms" }}>
          {pillars.map((p) => (
            <li key={p.n} className="flex gap-4 bg-ink px-5 py-4 sm:block sm:py-5">
              <span className="eyebrow text-accent">{p.n}</span>
              <div className="sm:mt-3">
                <p className="text-[0.95rem] font-medium tracking-tight text-bone">{p.t}</p>
                <p className="mt-0.5 text-sm text-bone/50">{p.s}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
