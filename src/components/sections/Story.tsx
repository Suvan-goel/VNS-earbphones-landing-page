import { site } from "@/config/site";
import { ConceptCaption, Container, SectionHead } from "../ui";
import { Earpiece, EarpieceDefs } from "../visuals/Earpiece";

export function Opportunity() {
  return (
    <section aria-labelledby="idea-title" className="section">
      <Container>
        <SectionHead eyebrow="01 / The idea" id="idea-title" lines={["You already put them in", "to think."]} />
        <div className="mx-auto mt-14 grid max-w-[60rem] gap-8 text-[1.0625rem] leading-relaxed text-muted sm:grid-cols-2 sm:gap-12">
          <p className="reveal" style={{ ["--d" as string]: "80ms" }}>
            Before the exam. Before the hard problem. Before the chapter you&rsquo;ve read three times. Earphones are the first thing we
            reach for when we need our minds at their best. Until now, all they could change was what you hear.
          </p>
          <p className="reveal" style={{ ["--d" as string]: "160ms" }}>
            We&rsquo;re building a pair that could do more: a quiet, everyday interface to the body&rsquo;s own pathways for attention and
            learning. No headband. No new routine. Just the earphones you&rsquo;d want to wear anyway.
          </p>
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
    <section id="sound" aria-labelledby="sound-title" className="section relative overflow-hidden">
      <Container>
        <SectionHead eyebrow="02 / Sound" id="sound-title" lines={["Earphones first.", "Uncompromisingly."]}>
          <p>
            If it isn&rsquo;t a pair you love listening to, nothing else matters. The technology has to earn its place inside a genuinely
            excellent set of earphones, never the other way round.
          </p>
        </SectionHead>

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-12">
          <div className="relative lg:col-span-6">
            <div className="reveal relative mx-auto aspect-square max-w-[520px]">
              <div aria-hidden="true" className="absolute inset-[10%] rounded-full bg-[radial-gradient(closest-side,rgba(238,234,225,0.10),rgba(238,234,225,0))]" />
              <svg
                viewBox="40 30 330 330"
                className="relative h-full w-full drop-shadow-[0_40px_50px_rgba(0,0,0,0.55)]"
                role="img"
                aria-label={`Concept close-up of a single ${site.product} earpiece: a compact titanium-tone shell with a graphite faceplate, a soft silicone ear tip and a slim fin.`}
              >
                <EarpieceDefs p="sound" />
                <Earpiece p="sound" />
              </svg>
            </div>
            <ConceptCaption className="mt-2 text-center" />
          </div>

          <div className="lg:col-span-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              {soundPoints.map((p, i) => (
                <div key={p.t} className="reveal panel p-6 sm:p-7" style={{ ["--d" as string]: `${i * 70}ms` }}>
                  <dt className="text-[1.0625rem] font-medium tracking-[-0.02em] text-ivory">{p.t}</dt>
                  <dd className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{p.s}</dd>
                </div>
              ))}
            </dl>
            <p className="reveal mt-6 text-sm text-faint">Acoustic specifications will be published once the design is finalised.</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
