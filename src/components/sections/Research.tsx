import { Container, Eyebrow, Headline, StatusTag } from "../ui";

const principles = [
  {
    t: "Measure outcomes, not moods",
    s: "Task performance and recall, tested days later.",
  },
  {
    t: "Compare fairly",
    s: "Active against sham, blinded wherever possible.",
  },
  {
    t: "Share what we learn",
    s: "Members hear the results, including the ones we didn’t hope for.",
  },
];

const roadmap = [
  { n: "01", t: "Concept and demand", now: true },
  { n: "02", t: "Prototypes" },
  { n: "03", t: "Comfort, safety and signal testing" },
  { n: "04", t: "Controlled studies" },
  { n: "05", t: "Product" },
];

const status = [
  { status: "core" as const, title: "Building", items: ["Wired in-ear earphones", "Integrated taVNS", "Inline module"] },
  { status: "research" as const, title: "Investigating", items: ["Benefits for learning and memory", "Ear-EEG and PPG sensing", "Personalised stimulation"] },
  { status: "future" as const, title: "Later", items: ["Closed-loop control", "Wireless", "Noise cancellation"] },
];

export function Research() {
  return (
    <section id="research" aria-labelledby="research-title" className="section scroll-mt-10">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-6">
            <Eyebrow className="reveal">04 / Research</Eyebrow>
            <Headline id="research-title" lines={["Not just feeling sharper.", "Finding out whether it actually works."]} className="reveal mt-5 text-[clamp(2.25rem,4.2vw,3.6rem)]" />
            <p className="reveal mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed text-ivory-soft">
              Plenty of products promise focus. We&rsquo;d rather measure it. The published evidence on taVNS and cognition is mixed,
              and nothing has been shown for our device yet.
            </p>
          </div>
          <dl className="lg:col-span-5 lg:col-start-8 lg:pt-10">
            {principles.map((p, i) => (
              <div key={p.t} className="reveal border-t border-[var(--line)] py-6 first:border-t-0 first:pt-0 lg:first:pt-0" style={{ ["--d" as string]: `${i * 80}ms` }}>
                <dt className="text-[1.125rem] font-medium tracking-[-0.02em] text-ivory">{p.t}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{p.s}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Roadmap */}
        <div className="reveal mt-20 sm:mt-24">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
            <h3 className="text-[1.375rem] font-normal tracking-[-0.035em] text-ivory">The road from here</h3>
            <p className="text-sm text-faint">Planned. Timing will change.</p>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-5 sm:gap-4">
            {roadmap.map((r) => (
              <li key={r.n} className="relative sm:pt-8">
                <span aria-hidden="true" className={`absolute left-0 top-0 hidden h-px w-full sm:block ${r.now ? "bg-rose" : "bg-[var(--line-strong)]"}`} />
                <span
                  aria-hidden="true"
                  className={`absolute -top-[5px] left-0 hidden size-[11px] rounded-full sm:block ${r.now ? "bg-rose ring-4 ring-rose/20" : "border border-[var(--line-strong)] bg-paper"}`}
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

        {/* Where things stand */}
        <div className="mt-20 grid gap-8 border-t border-[var(--line)] pt-10 md:grid-cols-3 md:gap-6">
          {status.map((col, i) => (
            <div key={col.title} className="reveal" style={{ ["--d" as string]: `${i * 80}ms` }}>
              <div className="flex items-center gap-3">
                <span className="text-[1.0625rem] font-medium tracking-[-0.02em] text-ivory">{col.title}</span>
                <StatusTag status={col.status} className="!px-2 !py-0.5 !text-[0.58rem]" />
              </div>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{col.items.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
