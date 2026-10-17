import { ConceptCaption, Container, SectionHead, StatusTag } from "../ui";
import { EarView } from "../visuals/EarView";
import { Exploded, explodedParts } from "../visuals/Exploded";

const stimPoints = [
  {
    n: "01",
    t: "Built in, not clipped on",
    s: "A soft fin rests in the cymba conchae, carrying two small contacts. No clip, no electrode pads, nothing to stick on.",
  },
  {
    n: "02",
    t: "Driven from the cable",
    s: "A slim inline module houses the stimulation electronics, keeping each earpiece as compact as a conventional IEM.",
  },
  {
    n: "03",
    t: "Comfort and safety first",
    s: "Low-intensity pulses you control. Comfort, safety and appropriate testing are requirements, not afterthoughts.",
  },
];

export function Stimulation() {
  return (
    <section id="technology" aria-labelledby="tech-title" className="section relative overflow-hidden scroll-mt-10">
      <Container>
        <SectionHead eyebrow="03 / Technology" id="tech-title" lines={["A gentle signal,", "through the ear."]} aside={<StatusTag status="core" />} />
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
              Research suggests it can influence brain systems involved in arousal and attention. We&rsquo;re investigating whether,
              built into everyday earphones and paired with the right tasks, it can deliver measurable benefits for learning.
            </p>
          </div>
          <div className="relative lg:col-span-5 lg:col-start-7">
            <div className="reveal mx-auto max-w-[500px] text-ivory">
              <EarView className="h-auto w-full" />
            </div>
            <ConceptCaption className="mt-2 text-center">Concept illustration. Contact geometry under investigation.</ConceptCaption>
          </div>
        </div>

        <ol className="mt-20 grid gap-4 md:grid-cols-3">
          {stimPoints.map((p, i) => (
            <li key={p.n} className="reveal panel p-7 sm:p-8" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <span className="eyebrow">{p.n}</span>
              <h3 className="mt-6 text-xl font-medium tracking-[-0.025em] text-ivory">{p.t}</h3>
              <p className="mt-3 leading-relaxed text-muted">{p.s}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

const sensors = [
  {
    t: "Ear-EEG",
    s: "Electrodes in the ear tip and fin may capture coarse signals of brain activity, to study states such as attention and how they shift with stimulation.",
    note: "Ear-EEG is far more limited than lab EEG. It can’t read thoughts or measure learning directly; we’re testing what can be measured reliably.",
  },
  {
    t: "Optical pulse sensing",
    s: "A compact PPG sensor may track pulse-related signals, so we can study how the body responds alongside the brain.",
    note: "Signal quality depends on fit, placement and movement. Derived measures will only ship once validated.",
  },
];

export function Sensing() {
  return (
    <section aria-labelledby="sense-title" className="section relative">
      <Container>
        <SectionHead eyebrow="04 / Sensing" id="sense-title" lines={["Designed to understand", "your response."]} aside={<StatusTag status="research" />}>
          <p>
            No two nervous systems are the same, and a protocol that helps one person may do little for another. So we&rsquo;re exploring
            ear-based sensing to study how individuals respond, and whether stimulation could one day adapt to you.
          </p>
          <p>
            Personalised stimulation is a research ambition. We haven&rsquo;t shown that sensing can choose the right moment or the right
            settings, and we won&rsquo;t claim it until we have.
          </p>
        </SectionHead>

        <div className="mx-auto mt-16 grid max-w-[64rem] gap-4 md:grid-cols-2">
          {sensors.map((c, i) => (
            <article key={c.t} className="reveal panel p-7 sm:p-9" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <h3 className="text-2xl font-normal tracking-[-0.035em] text-ivory">{c.t}</h3>
              <p className="mt-4 leading-relaxed text-muted">{c.s}</p>
              <p className="mt-6 text-sm leading-relaxed text-faint">{c.note}</p>
            </article>
          ))}
        </div>

        {/* Inside the concept */}
        <div className="mt-28 grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="reveal text-ivory">
              <Exploded className="h-auto w-full" />
            </div>
            <ConceptCaption className="mt-2">Exploded concept view. Not a final design.</ConceptCaption>
          </div>
          <div className="lg:col-span-5">
            <h3 className="reveal headline text-[clamp(1.9rem,3vw,2.5rem)]">
              <span className="block">Inside</span>
              <span className="soft block">the concept.</span>
            </h3>
            <ol className="mt-8 space-y-5">
              {explodedParts.map((p) => (
                <li key={p.n} className="reveal grid grid-cols-[2rem_1fr] gap-x-3">
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
          </div>
        </div>
      </Container>
    </section>
  );
}

const board = [
  {
    status: "core" as const,
    title: "What we’re building",
    items: ["Premium wired in-ear earphones", "Integrated, non-invasive taVNS", "Inline control module"],
  },
  {
    status: "research" as const,
    title: "What we’re investigating",
    items: ["Measurable benefits for learning and memory", "Ear-EEG and optical pulse sensing", "Personalised stimulation"],
  },
  {
    status: "future" as const,
    title: "What could come later",
    items: ["Closed-loop, sensing-informed control", "A wireless version", "Active noise cancellation"],
  },
];

export function StatusBoard() {
  return (
    <section aria-labelledby="status-title" className="section">
      <Container>
        <SectionHead eyebrow="05 / Status" id="status-title" lines={["Where things stand,", "plainly."]}>
          <p>Ambitious about the vision. Precise about the evidence. Here&rsquo;s what is product direction and what is still a question.</p>
        </SectionHead>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {board.map((col, i) => (
            <div key={col.title} className="reveal panel p-7 sm:p-8" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <StatusTag status={col.status} />
              <h3 className="mt-6 text-2xl font-normal tracking-[-0.035em] text-ivory">{col.title}</h3>
              <ul className="mt-6 space-y-3">
                {col.items.map((it) => (
                  <li key={it} className="flex gap-3 text-[0.97rem] text-ivory-soft">
                    <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-faint" aria-hidden="true" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
