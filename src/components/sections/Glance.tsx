import { site } from "@/config/site";
import { Container, Eyebrow } from "../ui";

// Keep each fact brief; pending details belong in the shared launch note.
const facts: { label: string; value: string; note: string }[] = [
  { label: "Connection", value: "Wired, USB‑C", note: "Nothing to pair, nothing to charge." },
  { label: "Sensing", value: "Brain and pulse", note: "EEG and PPG at the ear." },
  { label: "Stimulation", value: "Vagus nerve", note: "Gentle pulses at the ear." },
  { label: "Session", value: "Start and stop", note: "One press to start, one to stop." },
  { label: "Control", value: "Three-button control", note: "Volume, playback and stimulation." },
  { label: "In the box", value: `${site.product} earbuds`, note: "Three sizes of ear tips." },
];

export function Glance() {
  return (
    <section id="glance" aria-labelledby="glance-title" className="section scroll-mt-14 !pt-10 sm:!pt-12">
      <Container>
        <Eyebrow className="reveal">At a glance</Eyebrow>
        <h2 id="glance-title" className="sr-only">
          {site.product} at a glance
        </h2>
        <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          {facts.map((f, i) => (
            <div key={f.label} className="reveal panel px-3.5 py-3.5 sm:px-6 sm:py-5" style={{ ["--d" as string]: `${i * 50}ms` }}>
              <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ivory-soft sm:text-xs">{f.label}</dt>
              <dd className="mt-2 sm:mt-3">
                <p className="text-[1.0625rem] font-semibold leading-tight tracking-[-0.02em] text-ivory sm:text-[1.25rem]">{f.value}</p>
                <p className="mt-1.5 text-[0.8125rem] leading-snug text-muted sm:mt-2 sm:text-sm sm:leading-relaxed">{f.note}</p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="reveal mt-4 text-xs text-muted">Final specifications to be confirmed before launch.</p>
      </Container>
    </section>
  );
}
