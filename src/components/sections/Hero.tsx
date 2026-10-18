import type { HeroVariant } from "@/config/site";
import { site } from "@/config/site";
import { ConceptCaption, Container, CtaButton, SecondaryButton } from "../ui";
import { HeroPair } from "../visuals/HeroPair";

const specs = [
  { k: "Audio", v: "Wired, in-ear", note: "Tuned for music first" },
  { k: "Stimulation", v: "Integrated taVNS", note: "Non-invasive, you control it" },
  { k: "Control", v: "Inline module", note: "Compact earpieces" },
  { k: "Sensing", v: "Ear-EEG and PPG", note: "Research stage" },
];

export function Hero({ v }: { v: HeroVariant }) {
  const [first, ...rest] = v.headline;
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Studio light: a soft key from above and a warm pool where the product sits */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_30%_at_50%_0%,rgba(238,234,225,0.07),transparent_70%),radial-gradient(42%_34%_at_50%_74%,rgba(238,234,225,0.09),transparent_72%),radial-gradient(22%_16%_at_50%_80%,rgba(207,162,142,0.10),transparent_70%)]"
      />
      <Container className="relative flex flex-col items-center pt-28 pb-16 text-center sm:pt-32">
        <p className="hero-in inline-flex items-center gap-3 rounded-full border border-[var(--line)] bg-black/30 py-1.5 pr-4 pl-1.5 text-[0.8125rem] text-ivory-soft backdrop-blur" style={{ ["--d" as string]: "0ms" }}>
          <span className="rounded-full bg-ivory px-2.5 py-0.5 text-[0.6875rem] font-medium tracking-[0.08em] text-[#141414] uppercase">New</span>
          {v.eyebrow}
        </p>
        <h1 className="headline mt-7 max-w-[15ch] text-[clamp(2.5rem,6vw,5.25rem)] !leading-[1.04] sm:max-w-none">
          <span className="hero-in block" style={{ ["--d" as string]: "120ms" }}>
            {first}
          </span>
          {rest.map((line, i) => (
            <span key={i} className="hero-in soft block" style={{ ["--d" as string]: `${230 + i * 110}ms` }}>
              {line}
            </span>
          ))}
        </h1>
        <p className="hero-in mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed text-ivory-soft sm:text-lg" style={{ ["--d" as string]: "380ms" }}>
          {v.subhead}
        </p>
        <div className="hero-in mt-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-3" style={{ ["--d" as string]: "500ms" }}>
          <CtaButton location="hero">{v.primaryCta}</CtaButton>
          <span className="hidden sm:contents">
            <SecondaryButton href="#technology" cta="hero_secondary">
              {v.secondaryCta}
            </SecondaryButton>
          </span>
          <a href="#technology" data-cta="hero_secondary" className="inline-flex items-center gap-2 text-[0.9375rem] text-ivory-soft underline decoration-[var(--line-strong)] underline-offset-4 sm:hidden">
            {v.secondaryCta}
            <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className="product-in relative mt-2 w-full max-w-[960px] sm:-mt-2">
          <div className="float-slow">
            <HeroPair className="mx-auto h-auto w-full max-h-[78svh]" />
          </div>
          {/* Floor reflection */}
          <div aria-hidden="true" className="mx-auto -mt-10 h-10 w-[46%] rounded-[100%] bg-black/60 blur-2xl" />
        </div>

        <dl className="hero-in mt-6 grid w-full max-w-[1080px] grid-cols-2 gap-y-8 border-y border-[var(--line)] py-8 text-left sm:grid-cols-4 sm:py-9" style={{ ["--d" as string]: "700ms" }}>
          {specs.map((s, i) => (
            <div key={s.k} className={`px-4 sm:px-7 ${i % 2 ? "border-l border-[var(--line)]" : ""} ${i > 0 ? "sm:border-l sm:border-[var(--line)]" : ""}`}>
              <dt className="eyebrow !text-[0.6875rem]">{s.k}</dt>
              <dd className="mt-2 text-[1.0625rem] font-medium tracking-[-0.02em] text-ivory">{s.v}</dd>
              <dd className="mt-0.5 text-sm text-faint">{s.note}</dd>
            </div>
          ))}
        </dl>
        <div className="hero-in mt-5 flex max-w-[60rem] flex-col items-center gap-1 sm:flex-row sm:gap-3" style={{ ["--d" as string]: "800ms" }}>
          <ConceptCaption className="sm:whitespace-nowrap">Concept render. Industrial design in development.</ConceptCaption>
          <span aria-hidden="true" className="hidden size-1 rounded-full bg-faint/60 sm:block" />
          <p className="text-[0.8125rem] leading-relaxed text-faint sm:whitespace-nowrap">
            {site.product} is in development. Effects on learning are being studied, not yet proven.
          </p>
        </div>
      </Container>
    </section>
  );
}
