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
              A small hollow in your outer ear, the cymba conchae, is supplied by a branch of the vagus nerve: one of the main
              communication lines between your brain and body.
            </p>
            <p className="reveal">
              Transcutaneous auricular vagus nerve stimulation (taVNS) uses tiny, precisely controlled electrical pulses at the skin to
              engage these sensory pathways. No needles, no implants.
            </p>
            <p className="reveal">
              Research suggests it can influence brain systems involved in arousal and attention. Aurel One is designed to put that
              pathway to work while you study. Whether it measurably helps is the question our research programme exists to answer.
            </p>
          </div>
          <div className="relative lg:col-span-5 lg:col-start-7">
            <div className="reveal mx-auto max-w-[500px] text-ivory">
              <EarView className="h-auto w-full" />
            </div>
            <ConceptCaption className="mt-2 text-center">Concept illustration. Contact geometry under investigation.</ConceptCaption>
          </div>
        </div>

        {/* Inside the earpiece */}
        <div className="mt-24 sm:mt-32">
          <div className="reveal mx-auto max-w-[900px] text-ivory">
            <Exploded className="h-auto w-full" />
          </div>
          <ConceptCaption className="mt-2 text-center">Exploded concept view. Not a final design.</ConceptCaption>

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
              Electrodes in the tip and fin, and the optical sensor on the inner face, are being developed to study how each person
              responds to stimulation. Nothing derived from them ships until it has been validated.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
