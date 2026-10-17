import { Container, SectionHead } from "../ui";

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
    <section id="research" aria-labelledby="research-title" className="section scroll-mt-10">
      <Container>
        <SectionHead eyebrow="07 / Research" id="research-title" lines={["Not just feeling sharper.", "Finding out whether it actually works."]} className="!max-w-[60rem]">
          <p>
            Plenty of products promise focus. We&rsquo;d rather measure it. Published research on taVNS and cognition is intriguing but
            mixed, and nobody has yet shown what our device can do. Rigorous testing is how we&rsquo;ll find out.
          </p>
        </SectionHead>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {principles.map((p, i) => (
            <div key={p.t} className="reveal panel p-7 sm:p-8" style={{ ["--d" as string]: `${i * 90}ms` }}>
              <h3 className="text-[1.375rem] font-normal tracking-[-0.035em] text-ivory">{p.t}</h3>
              <p className="mt-3 leading-relaxed text-muted">{p.s}</p>
            </div>
          ))}
        </div>

        <div className="reveal panel mt-6 p-7 sm:p-10">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
            <h3 className="text-[1.375rem] font-normal tracking-[-0.035em] text-ivory">The road from here</h3>
            <p className="text-sm text-faint">Planned path. Sequence and timing will change as we learn.</p>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-5 sm:gap-4">
            {roadmap.map((r) => (
              <li key={r.n} className="relative sm:pt-8">
                <span aria-hidden="true" className={`absolute left-0 top-0 hidden h-px w-full sm:block ${r.now ? "bg-rose" : "bg-[var(--line-strong)]"}`} />
                <span
                  aria-hidden="true"
                  className={`absolute -top-[5px] left-0 hidden size-[11px] rounded-full sm:block ${r.now ? "bg-rose ring-4 ring-rose/20" : "border border-[var(--line-strong)] bg-surface"}`}
                />
                <div className="flex gap-4 sm:block">
                  <span className={`text-sm tabular-nums ${r.now ? "text-rose" : "text-faint"}`}>{r.n}</span>
                  <div className="sm:mt-3">
                    <p className={`text-[0.97rem] leading-snug ${r.now ? "text-ivory" : "text-muted"}`}>{r.t}</p>
                    {r.now && <p className="eyebrow mt-2 !text-[0.625rem]">We are here</p>}
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
