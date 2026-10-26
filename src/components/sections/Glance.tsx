import { site } from "@/config/site";
import { Container, Eyebrow } from "../ui";

/*
 * The facts, in six cells and no prose. Values marked TBC are PLACEHOLDERS
 * until engineering confirms them; edit this list only.
 */
const facts: { label: string; value: string; note: string }[] = [
  { label: "Connection", value: "Wired, USB-C", note: "Nothing to pair, nothing to charge." },
  { label: "Sensing", value: "EEG and PPG", note: "Brain activity and pulse, read at the ear." },
  { label: "Stimulation", value: "Vagus nerve, at the ear", note: "Gentle pulses through two contacts on the inner housing." },
  { label: "Session", value: "20 minutes", note: "One press to start, one to stop." },
  { label: "Control", value: "Inline, three buttons", note: "Volume, playback and stimulation, with an indicator light." },
  { label: "In the box", value: `${site.product}, three tip sizes`, note: "Carry pouch TBC." },
];

export function Glance() {
  return (
    <section id="glance" aria-labelledby="glance-title" className="section scroll-mt-14 !pt-0">
      <Container>
        <Eyebrow className="reveal">At a glance</Eyebrow>
        <h2 id="glance-title" className="sr-only">
          {site.product} at a glance
        </h2>
        <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          {facts.map((f, i) => (
            <div key={f.label} className="reveal panel px-4 py-4 sm:px-6 sm:py-6" style={{ ["--d" as string]: `${i * 50}ms` }}>
              <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-faint sm:text-xs">{f.label}</dt>
              <dd className="mt-2 sm:mt-3">
                <p className="text-[1.0625rem] font-semibold leading-tight tracking-[-0.02em] text-ivory sm:text-[1.25rem]">{f.value}</p>
                <p className="mt-1.5 text-[0.8125rem] leading-snug text-muted sm:mt-2 sm:text-sm sm:leading-relaxed">{f.note}</p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="reveal mt-4 text-xs text-faint">Price and final specifications to be confirmed before launch.</p>
      </Container>
    </section>
  );
}
