import { site } from "@/config/site";
import { ConceptCaption, Container, CtaButton, Eyebrow, Headline } from "../ui";
import { Earpiece, EarpieceDefs } from "../visuals/Earpiece";

const statement =
  "You already put them in to think. Before the exam, before the hard problem, before the chapter you’ve read three times. Earphones are the first thing we reach for when we need our minds at their best. Until now, all they could change was what you hear.";

export function Opportunity() {
  return (
    <section aria-labelledby="idea-title" className="section">
      <Container className="flex flex-col items-center text-center">
        <Eyebrow className="reveal">01 / The idea</Eyebrow>
        {/* Words brighten as the statement scrolls through the viewport (where supported). */}
        <h2 id="idea-title" className="scrub headline mt-8 max-w-[26ch] text-[clamp(1.75rem,3.3vw,3rem)] !leading-[1.18]">
          {statement.split(" ").map((w, i) => (
            <span key={i} className="w">
              {w}{" "}
            </span>
          ))}
        </h2>
        <p className="reveal mt-10 max-w-[38rem] text-[1.0625rem] leading-relaxed text-ivory-soft sm:text-lg">
          {site.product} is designed to do more, without a headband or a new routine.
        </p>
      </Container>
    </section>
  );
}

const soundPoints = [
  { t: "Tuned for music first", s: "A dedicated acoustic system and a clean wired signal path, tuned for the music you love." },
  { t: "Comfortable for hours", s: "An anatomical shell and soft, replaceable tips, designed for long study and work sessions." },
  { t: "Quiet by design", s: "A deep, secure fit for strong passive isolation, so the room falls away." },
  { t: "Familiar and discreet", s: "Looks and wears like a premium pair of in-ear monitors. Plug in and listen." },
];

function SoundPoint({ p, side, i }: { p: (typeof soundPoints)[number]; side: "left" | "right"; i: number }) {
  return (
    <div className={`reveal ${side === "left" ? "lg:text-right" : ""}`} style={{ ["--d" as string]: `${i * 80}ms` }}>
      <div className={`flex items-center gap-3 ${side === "left" ? "lg:flex-row-reverse" : ""}`}>
        <span className="size-1.5 shrink-0 rounded-full bg-rose" aria-hidden="true" />
        <span className="hidden h-px w-10 bg-[var(--line-strong)] lg:block" aria-hidden="true" />
        <h3 className="text-[1.125rem] font-medium tracking-[-0.02em] text-ivory">{p.t}</h3>
      </div>
      <p className={`mt-2 max-w-[22rem] text-[0.9375rem] leading-relaxed text-muted ${side === "left" ? "lg:ml-auto" : ""}`}>{p.s}</p>
    </div>
  );
}

export function Sound() {
  return (
    <section id="sound" aria-labelledby="sound-title" className="section relative overflow-hidden scroll-mt-10">
      <Container>
        <div className="flex flex-col items-center text-center">
          <Eyebrow className="reveal">02 / Sound</Eyebrow>
          <Headline id="sound-title" lines={["Earphones first.", "Uncompromisingly."]} className="reveal mt-5 text-[clamp(2.5rem,5.4vw,4.75rem)]" />
          <p className="reveal mt-6 max-w-[38rem] text-[1.0625rem] leading-relaxed text-ivory-soft sm:text-lg">
            If it isn&rsquo;t a pair you love listening to, nothing else matters. The technology earns its place inside a genuinely
            excellent set of earphones, never the other way round. Stimulation off, it is simply a pair you&rsquo;ll love.
          </p>
        </div>

        {/* Product stage */}
        <div className="panel relative mt-16 overflow-hidden !rounded-[36px] px-6 py-12 sm:px-10 lg:px-14 lg:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(38%_55%_at_50%_45%,rgba(238,234,225,0.10),transparent_70%),radial-gradient(20%_25%_at_50%_70%,rgba(207,162,142,0.08),transparent_70%)]"
          />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,440px)_1fr] lg:gap-8">
            <div className="order-2 grid gap-8 sm:grid-cols-2 lg:order-1 lg:grid-cols-1 lg:gap-16">
              <SoundPoint p={soundPoints[0]} side="left" i={0} />
              <SoundPoint p={soundPoints[1]} side="left" i={1} />
            </div>
            <div className="order-1 lg:order-2">
              <div className="reveal float-slow relative mx-auto aspect-square max-w-[420px]">
                <svg
                  viewBox="40 30 330 330"
                  className="relative h-full w-full drop-shadow-[0_50px_60px_rgba(0,0,0,0.6)]"
                  role="img"
                  aria-label={`Concept close-up of a single ${site.product} earpiece: a compact titanium-tone shell with a graphite faceplate, a soft silicone ear tip and a slim fin.`}
                >
                  <EarpieceDefs p="sound" />
                  <Earpiece p="sound" />
                </svg>
              </div>
            </div>
            <div className="order-3 grid gap-8 sm:grid-cols-2 lg:grid-cols-1 lg:gap-16">
              <SoundPoint p={soundPoints[2]} side="right" i={2} />
              <SoundPoint p={soundPoints[3]} side="right" i={3} />
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col items-center gap-1 text-center sm:flex-row sm:justify-center sm:gap-3">
          <ConceptCaption>Concept render. Industrial design in development.</ConceptCaption>
          <span aria-hidden="true" className="hidden size-1 rounded-full bg-faint/60 sm:block" />
          <p className="text-[0.8125rem] text-faint">Acoustic specifications will be published once the design is finalised.</p>
        </div>

        {/* A quiet ask, early */}
        <div className="reveal mt-20 flex flex-col items-start justify-between gap-6 border-y border-[var(--line)] py-8 sm:mt-24 sm:flex-row sm:items-center">
          <div>
            <p className="text-[1.375rem] font-normal tracking-[-0.035em] text-ivory">Be first to hear it.</p>
            <p className="mt-1 text-[0.9375rem] text-muted">Early access is free, with no commitment.</p>
          </div>
          <CtaButton location="band">Join early access</CtaButton>
        </div>
      </Container>
    </section>
  );
}
