import { ConceptCaption, Container, SectionHead, StatusTag } from "../ui";
import { EarView } from "../visuals/EarView";
import { Exploded, explodedParts } from "../visuals/Exploded";

export function Technology() {
  return (
    <section id="technology" aria-labelledby="tech-title" className="section relative overflow-hidden scroll-mt-10">
      <Container>
        <SectionHead eyebrow="03 / Technology" id="tech-title" lines={["A gentle signal,", "through the ear."]} aside={<StatusTag status="core" />} />

        {/* How it works */}
        <div className="mt-16 grid items-center gap-12 lg:grid-cols-12">
          <div className="space-y-5 text-[1.0625rem] leading-relaxed text-muted lg:col-span-5 lg:col-start-2">
            <p className="reveal">
              Part of your outer ear, the cymba conchae, is wired to the vagus nerve: a main line between brain and body.
            </p>
            <p className="reveal">taVNS sends tiny, controlled pulses through the skin there. No needles. No implants.</p>
            <p className="reveal">
              Studies link it to the brain&rsquo;s arousal and attention systems. Aurel One puts it in your earphones. Whether it helps
              you learn is what our research exists to answer.
            </p>
          </div>
          <div className="relative lg:col-span-5 lg:col-start-7">
            <div className="reveal mx-auto max-w-[500px] text-ivory">
              <EarView className="h-auto w-full" />
            </div>
            <ConceptCaption className="mt-2 text-center">Concept illustration. Contact position not final.</ConceptCaption>
          </div>
        </div>

        {/* Inside the earpiece */}
        <div className="mt-24 sm:mt-32">
          <div className="reveal mx-auto max-w-[900px] text-ivory">
            <Exploded className="h-auto w-full" />
          </div>
          <ConceptCaption className="mt-2 text-center">Exploded concept view. Not final.</ConceptCaption>

          <ol className="mt-12 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {explodedParts.map((p, i) => (
              <li key={p.n} className="reveal grid grid-cols-[1.75rem_1fr] gap-x-3" style={{ ["--d" as string]: `${i * 60}ms` }}>
                <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-ivory text-[0.7rem] font-medium text-[#141414]">
                  {p.n}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium tracking-[-0.02em] text-ivory">{p.name}</span>
                    <StatusTag status={p.status} className="!px-2 !py-0.5 !text-[0.58rem]" />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="reveal mx-auto mt-14 flex max-w-[48rem] flex-col items-center gap-3 text-center">
            <StatusTag status="research" />
            <p className="text-[0.9375rem] leading-relaxed text-muted">
              Sensing is for studying how each person responds. Nothing derived from it ships until validated.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
