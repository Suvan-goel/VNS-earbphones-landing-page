import { site } from "@/config/site";
import { Container, Eyebrow, Headline } from "../ui";

const P = site.product;

export const faqs: { id: string; q: string; a: string }[] = [
  {
    id: "what",
    q: `What exactly is ${P}?`,
    a: `Premium wired earphones with built-in, non-invasive ear stimulation (taVNS), plus research-stage EEG and pulse sensing. In development, not yet for sale.`,
  },
  {
    id: "how",
    q: "How does the stimulation work?",
    a: "Small, controlled pulses at the skin of the outer ear engage a sensory branch of the vagus nerve, which connects to brain regions involved in arousal and attention. Effects vary between people and protocols.",
  },
  {
    id: "normal",
    q: "Can I use them as normal earphones?",
    a: "Yes. Stimulation is optional. Off, they’re a premium pair of wired earphones.",
  },
  {
    id: "efficacy",
    q: "Will they improve memory or concentration?",
    a: "We don’t know yet, and we won’t claim it until we do. The published evidence is mixed. Testing this properly is the point of the programme.",
  },
  {
    id: "safety",
    q: "Are they safe?",
    a: "Safety is a requirement, not a marketing line. taVNS is widely studied in research settings, but our device hasn’t been tested yet. Materials, parameters and who shouldn’t use it will be evaluated with appropriate oversight before anything ships.",
  },
  {
    id: "medical",
    q: "Is this a medical device?",
    a: `No. ${P} isn’t intended to diagnose, treat or prevent any condition, and hasn’t been evaluated by the FDA, the MHRA or any other regulator.`,
  },
  {
    id: "when",
    q: "When, and how much?",
    a: "No timeline and no price yet. Early-access members hear first, and the optional survey after you join feeds the pricing decision.",
  },
  {
    id: "join",
    q: "What happens when I join?",
    a: "Occasional updates and first news of availability. Opt in and we may invite you to prototype testing or studies. No payment. Unsubscribe any time.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="section scroll-mt-10">
      <Container className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Eyebrow className="reveal">06 / Questions</Eyebrow>
          <Headline id="faq-title" lines={["Questions,", "answered straight."]} className="reveal mt-5 text-[clamp(2.25rem,4vw,3.25rem)]" />
          <p className="reveal mt-6 text-muted">
            Something else?{" "}
            <a href={`mailto:${site.contactEmail}`} className="text-ivory underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-ivory">
              Ask us
            </a>
            .
          </p>
        </div>
        <div className="space-y-3 lg:col-span-8">
          {faqs.map((f) => (
            <details key={f.id} data-faq={f.id} className="group panel !rounded-[22px] px-6 transition-colors open:bg-surface sm:px-7">
              <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 text-left text-[1.0625rem] font-normal tracking-[-0.02em] text-ivory transition-colors hover:text-ivory-soft sm:text-lg">
                {f.q}
                <span className="faq-icon relative size-4 shrink-0 text-rose transition-transform duration-500 ease-out-expo" aria-hidden="true">
                  <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                  <span className="absolute left-1/2 top-0 h-4 w-px bg-current" />
                </span>
              </summary>
              <div className="faq-body">
                <div className="overflow-hidden">
                  <p className="max-w-2xl pb-6 leading-relaxed text-muted">{f.a}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
