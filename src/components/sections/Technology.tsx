import { ConceptCaption, Container, Eyebrow, StatusTag } from "../ui";
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
    <section id="technology" aria-labelledby="tech-title" className="grain relative overflow-hidden bg-ink py-28 text-bone sm:py-36">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="reveal flex flex-wrap items-center gap-3">
              <Eyebrow className="text-bone/50">The technology</Eyebrow>
              <StatusTag status="core" className="text-bone/60" />
            </div>
            <h2 id="tech-title" className="reveal display mt-6 text-[clamp(2.3rem,5vw,4.2rem)] text-balance">
              A gentle signal, through the ear.
            </h2>
            <div className="mt-8 max-w-xl space-y-5 text-lg leading-relaxed text-bone/65">
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
          </div>
          <div className="relative lg:col-span-6">
            <div className="reveal mx-auto max-w-[520px] text-bone">
              <EarView className="h-auto w-full" />
            </div>
            <ConceptCaption className="mt-2 justify-center text-bone">Concept illustration. Contact geometry under investigation.</ConceptCaption>
          </div>
        </div>

        <ol className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] md:grid-cols-3">
          {stimPoints.map((p, i) => (
            <li key={p.n} className="reveal bg-ink p-7 sm:p-8" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <span className="eyebrow text-accent">{p.n}</span>
              <h3 className="mt-6 text-xl font-medium tracking-tight">{p.t}</h3>
              <p className="mt-3 leading-relaxed text-bone/55">{p.s}</p>
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
    <section aria-labelledby="sense-title" className="relative bg-ink-2 py-28 text-bone sm:py-36">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="reveal flex flex-wrap items-center gap-3">
              <Eyebrow className="text-bone/50">Sensing</Eyebrow>
              <StatusTag status="research" className="text-bone/60" />
            </div>
            <h2 id="sense-title" className="reveal display mt-6 text-[clamp(2.2rem,4.6vw,3.8rem)] text-balance">
              Designed to understand your response.
            </h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="reveal text-lg leading-relaxed text-bone/65">
              No two nervous systems are the same, and a protocol that helps one person may do little for another. So we&rsquo;re exploring
              ear-based sensing to study how individuals respond, and whether stimulation could one day adapt to you.
            </p>
            <p className="reveal mt-5 text-lg leading-relaxed text-bone/65">
              Personalised stimulation is a research ambition. We haven&rsquo;t shown that sensing can choose the right moment or the right
              settings, and we won&rsquo;t claim it until we have.
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {sensors.map((c, i) => (
            <article key={c.t} className="reveal rounded-3xl border border-white/[0.08] p-7 sm:p-9" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <h3 className="font-display text-2xl tracking-tight">{c.t}</h3>
              <p className="mt-4 leading-relaxed text-bone/65">{c.s}</p>
              <p className="mt-6 border-t border-white/[0.08] pt-5 text-sm leading-relaxed text-bone/45">{c.note}</p>
            </article>
          ))}
        </div>

        {/* Inside the concept */}
        <div className="mt-28 grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="reveal text-bone">
              <Exploded className="h-auto w-full" />
            </div>
            <ConceptCaption className="mt-2 text-bone">Exploded concept view. Not a final design.</ConceptCaption>
          </div>
          <div className="lg:col-span-5">
            <h3 className="reveal font-display text-3xl tracking-tight">Inside the concept</h3>
            <ol className="mt-8 space-y-5">
              {explodedParts.map((p) => (
                <li key={p.n} className="reveal grid grid-cols-[2rem_1fr] gap-x-3">
                  <span className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-bone font-mono text-[0.7rem] font-medium text-ink">
                    {p.n}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium tracking-tight">{p.name}</span>
                      <StatusTag status={p.status} className="!px-2 !py-0.5 !text-[0.58rem] text-bone/50" />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-bone/55">{p.body}</p>
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
    <section aria-labelledby="status-title" className="bg-bone py-24 sm:py-32">
      <Container>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 id="status-title" className="reveal display max-w-2xl text-[clamp(2rem,4vw,3.2rem)] text-balance">
            Where things stand, plainly.
          </h2>
          <p className="reveal max-w-sm text-ink/60">Ambitious about the vision. Precise about the evidence. Here&rsquo;s what is product direction and what is still a question.</p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {board.map((col, i) => (
            <div key={col.title} className="reveal rounded-3xl bg-white/70 p-7 ring-1 ring-ink/[0.06] sm:p-8" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <StatusTag status={col.status} className="text-ink/60" />
              <h3 className="mt-6 font-display text-2xl tracking-tight">{col.title}</h3>
              <ul className="mt-6 space-y-3">
                {col.items.map((it) => (
                  <li key={it} className="flex gap-3 border-t border-ink/10 pt-3 text-[0.97rem] text-ink/75">
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
