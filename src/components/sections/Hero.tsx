import type { HeroVariant } from "@/config/site";
import { ConceptCaption, Container, CtaButton, SecondaryButton } from "../ui";
import { HeroPair } from "../visuals/HeroPair";

const pillars = [
  { n: "01", t: "Exceptional wired sound", s: "A genuinely great pair of earphones first." },
  { n: "02", t: "Built-in ear stimulation", s: "Gentle, non-invasive taVNS, in development." },
  { n: "03", t: "Research-stage sensing", s: "Exploring ear-EEG and optical pulse signals." },
];

export function Hero({ v }: { v: HeroVariant }) {
  const [first, ...rest] = v.headline;
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(48%_38%_at_50%_68%,rgba(238,234,225,0.08),transparent_72%),radial-gradient(26%_20%_at_50%_70%,rgba(207,162,142,0.07),transparent_70%)]"
      />
      <Container className="relative flex min-h-[100svh] flex-col items-center pt-32 pb-12 text-center sm:pt-40">
        <p className="hero-in eyebrow" style={{ ["--d" as string]: "0ms" }}>
          {v.eyebrow}
        </p>
        <h1 className="headline mt-6 max-w-[16ch] text-[clamp(2.75rem,5.6vw,4.75rem)] sm:max-w-none">
          <span className="hero-in block" style={{ ["--d" as string]: "120ms" }}>
            {first}
          </span>
          {rest.map((line, i) => (
            <span key={i} className="hero-in soft block" style={{ ["--d" as string]: `${230 + i * 110}ms` }}>
              {line}
            </span>
          ))}
        </h1>
        <p className="hero-in mt-7 max-w-[36rem] text-[1.0625rem] leading-relaxed text-ivory-soft sm:text-lg" style={{ ["--d" as string]: "380ms" }}>
          {v.subhead}
        </p>
        <div className="hero-in mt-9 flex flex-wrap items-center justify-center gap-3" style={{ ["--d" as string]: "500ms" }}>
          <CtaButton location="hero">{v.primaryCta}</CtaButton>
          <SecondaryButton href="#technology" cta="hero_secondary">
            {v.secondaryCta}
          </SecondaryButton>
        </div>

        <div className="product-in relative mt-6 w-full max-w-[880px] sm:mt-2">
          <div className="float-slow">
            <HeroPair className="mx-auto h-auto w-full" />
          </div>
          <ConceptCaption className="-mt-2 text-center" />
        </div>

        <ul className="hero-in mt-14 grid w-full max-w-[1080px] grid-cols-1 gap-8 text-center sm:grid-cols-3 sm:gap-6" style={{ ["--d" as string]: "700ms" }}>
          {pillars.map((p) => (
            <li key={p.n}>
              <span className="eyebrow">{p.n}</span>
              <p className="mt-3 text-[1.0625rem] font-medium tracking-[-0.02em] text-ivory">{p.t}</p>
              <p className="mt-1 text-[0.9375rem] text-muted">{p.s}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
