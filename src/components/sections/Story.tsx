import { site } from "@/config/site";
import { ConceptCaption, Container, Eyebrow } from "../ui";
import { Earpiece, EarpieceDefs } from "../visuals/Earpiece";

export function Opportunity() {
  return (
    <section aria-labelledby="idea-title" className="bg-bone py-28 sm:py-36 lg:py-44">
      <Container className="grid gap-12 lg:grid-cols-12">
        <Eyebrow className="reveal text-mute lg:col-span-3">The idea</Eyebrow>
        <div className="lg:col-span-9">
          <h2 id="idea-title" className="reveal display text-[clamp(2.3rem,5.6vw,4.6rem)] text-balance">
            You already put them in to think.
          </h2>
          <div className="mt-12 grid gap-8 text-lg leading-relaxed text-ink/70 sm:grid-cols-2 sm:gap-12">
            <p className="reveal" style={{ ["--d" as string]: "80ms" }}>
              Before the exam. Before the hard problem. Before the chapter you&rsquo;ve read three times. Earphones are the first thing
              we reach for when we need our minds at their best. Until now, all they could change was what you hear.
            </p>
            <p className="reveal" style={{ ["--d" as string]: "160ms" }}>
              We&rsquo;re building a pair that could do more: a quiet, everyday interface to the body&rsquo;s own pathways for attention
              and learning. No headband. No new routine. Just the earphones you&rsquo;d want to wear anyway.
            </p>
          </div>
        </div>
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

export function Sound() {
  return (
    <section id="sound" aria-labelledby="sound-title" className="relative overflow-hidden bg-bone-2 py-28 sm:py-36">
      <Container className="grid items-center gap-16 lg:grid-cols-12">
        <div className="relative order-2 lg:order-1 lg:col-span-6">
          <div className="reveal relative mx-auto aspect-square max-w-[560px]">
            <div aria-hidden="true" className="absolute inset-[8%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.9),rgba(255,255,255,0))]" />
            <svg
              viewBox="40 30 330 330"
              className="relative h-full w-full drop-shadow-[0_40px_40px_rgba(14,15,17,0.22)]"
              role="img"
              aria-label={`Concept close-up of a single ${site.product} earpiece: a compact titanium-tone shell with a graphite faceplate, a soft silicone ear tip and a slim fin.`}
            >
              <EarpieceDefs p="sound" />
              <Earpiece p="sound" />
            </svg>
          </div>
          <ConceptCaption className="mt-2 justify-center text-ink" />
        </div>

        <div className="order-1 lg:order-2 lg:col-span-6">
          <Eyebrow className="reveal text-mute">Sound</Eyebrow>
          <h2 id="sound-title" className="reveal display mt-5 text-[clamp(2.3rem,5vw,4.2rem)] text-balance">
            Earphones first. Uncompromisingly.
          </h2>
          <p className="reveal mt-6 max-w-xl text-lg leading-relaxed text-ink/70">
            If it isn&rsquo;t a pair you love listening to, nothing else matters. The technology has to earn its place inside a genuinely
            excellent set of earphones, never the other way round.
          </p>
          <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {soundPoints.map((p, i) => (
              <div key={p.t} className="reveal border-t border-ink/15 pt-5" style={{ ["--d" as string]: `${i * 70}ms` }}>
                <dt className="font-medium tracking-tight">{p.t}</dt>
                <dd className="mt-2 text-[0.95rem] leading-relaxed text-ink/60">{p.s}</dd>
              </div>
            ))}
          </dl>
          <p className="reveal mt-10 text-sm text-mute">Acoustic specifications will be published once the design is finalised.</p>
        </div>
      </Container>
    </section>
  );
}
