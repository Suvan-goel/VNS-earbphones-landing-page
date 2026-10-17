import { Container, Eyebrow } from "../ui";

const principles = [
  {
    t: "Measure outcomes, not moods",
    s: "Task performance and delayed recall, tested days later. Not just whether a session felt productive.",
  },
  {
    t: "Compare fairly",
    s: "Active stimulation against sham and standard protocols, with blinding wherever it’s possible.",
  },
  {
    t: "Share what we learn",
    s: "Early-access members hear how the research is going, including the results we didn’t hope for.",
  },
];

const roadmap = [
  { n: "01", t: "Concept and demand", now: true },
  { n: "02", t: "Prototypes on an established acoustic platform" },
  { n: "03", t: "Comfort, safety and signal-quality testing" },
  { n: "04", t: "Controlled studies of cognitive outcomes" },
  { n: "05", t: "Product" },
];

export function Research() {
  return (
    <section id="research" aria-labelledby="research-title" className="bg-bone py-28 sm:py-36 lg:py-44">
      <Container>
        <Eyebrow className="reveal text-mute">The research question</Eyebrow>
        <h2 id="research-title" className="reveal display mt-6 max-w-5xl text-[clamp(2.5rem,6.4vw,5.4rem)] text-balance">
          Not just feeling sharper. <span className="text-ink/35">Finding out whether it actually works.</span>
        </h2>
        <p className="reveal mt-10 max-w-2xl text-lg leading-relaxed text-ink/70">
          Plenty of products promise focus. We&rsquo;d rather measure it. Published research on taVNS and cognition is intriguing but mixed,
          and nobody has yet shown what our device can do. Rigorous testing is how we&rsquo;ll find out.
        </p>

        <div className="mt-16 grid gap-10 border-t border-ink/15 pt-10 md:grid-cols-3">
          {principles.map((p, i) => (
            <div key={p.t} className="reveal" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <h3 className="font-display text-2xl tracking-tight">{p.t}</h3>
              <p className="mt-3 leading-relaxed text-ink/60">{p.s}</p>
            </div>
          ))}
        </div>

        <div className="reveal mt-24 rounded-[2rem] bg-ink p-7 text-bone sm:p-10">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
            <h3 className="font-display text-2xl tracking-tight">The road from here</h3>
            <p className="text-sm text-bone/45">Planned path. Sequence and timing will change as we learn.</p>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-5 sm:gap-4">
            {roadmap.map((r) => (
              <li key={r.n} className="relative sm:pt-8">
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0 hidden h-px w-full sm:block ${r.now ? "bg-accent" : "bg-white/15"}`}
                />
                <span
                  aria-hidden="true"
                  className={`absolute -top-[5px] left-0 hidden size-[11px] rounded-full sm:block ${r.now ? "bg-accent ring-4 ring-accent/20" : "border border-white/25 bg-ink"}`}
                />
                <div className="flex gap-4 sm:block">
                  <span className={`font-mono text-sm ${r.now ? "text-accent" : "text-bone/40"}`}>{r.n}</span>
                  <div className="sm:mt-3">
                    <p className={`text-[0.97rem] leading-snug ${r.now ? "text-bone" : "text-bone/60"}`}>{r.t}</p>
                    {r.now && <p className="eyebrow mt-2 !text-[0.6rem] text-accent">We are here</p>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
