import { site } from "@/config/site";
import { Container, Eyebrow } from "../ui";

const P = site.product;

export const faqs: { id: string; q: string; a: string }[] = [
  {
    id: "what",
    q: "What exactly are these earphones?",
    a: `${P} is a concept for premium wired in-ear earphones that combine high-quality audio with integrated, non-invasive stimulation of the outer ear (taVNS), plus research-stage EEG and pulse sensing. It’s in development and not yet available.`,
  },
  {
    id: "how",
    q: "How does vagus nerve stimulation work?",
    a: "Part of the outer ear, the cymba conchae, receives sensory fibres from the auricular branch of the vagus nerve. taVNS delivers small, controlled electrical pulses through the skin there to activate those sensory pathways, which connect to brainstem regions involved in arousal and attention. It doesn’t give direct or selective control over particular brain areas or neurotransmitters, and effects vary between people and protocols.",
  },
  {
    id: "normal",
    q: "Can I use them as normal earphones?",
    a: "Yes, and that’s the point. Stimulation is designed to be entirely optional. With it switched off, they’re simply a premium pair of wired earphones.",
  },
  {
    id: "comfort",
    q: "Will they be comfortable for long study sessions?",
    a: "Long-session comfort is our second design priority, right after sound. The concept uses a compact anatomical shell, replaceable tips and a soft fin designed to sit gently in the ear. We’ll validate comfort with real people through prototype testing.",
  },
  {
    id: "sensing",
    q: "Do they use EEG or PPG?",
    a: "We’re exploring both. Ear-EEG and optical pulse (PPG) sensors could help us study how individuals respond to stimulation. They’re research-stage, and we won’t present any derived measurement as a feature until it’s validated. This website doesn’t collect any health or physiological data.",
  },
  {
    id: "efficacy",
    q: "Can they really improve memory or concentration?",
    a: "We don’t know yet, and we won’t claim it until we do. Published research on taVNS and cognition is promising in places but mixed overall, and depends heavily on how stimulation is delivered. Finding out whether our device produces measurable benefits, against appropriate controls, is the heart of our development programme.",
  },
  {
    id: "safety",
    q: "Are they safe?",
    a: "Safety is a fundamental requirement, not a marketing line. taVNS has been studied widely in research settings, but no form of electrical stimulation is right for everyone, and our specific device has not yet been tested. Stimulation parameters, materials, comfort and suitability, including who shouldn’t use it, will be evaluated carefully and with appropriate oversight before anything is offered to customers.",
  },
  {
    id: "medical",
    q: "Is this a medical device?",
    a: `No. ${P} is not intended to diagnose, treat or prevent any medical condition, and it has not been evaluated or approved by the FDA, the MHRA or any other regulator.`,
  },
  {
    id: "when",
    q: "When will they be available?",
    a: "We haven’t announced a timeline. We’re validating demand and engineering feasibility first. Early-access members will hear first.",
  },
  {
    id: "price",
    q: "How much will they cost?",
    a: "Pricing hasn’t been set. The optional survey after you join asks what you’d consider, and your answer genuinely informs that decision.",
  },
  {
    id: "join",
    q: "What happens when I join the waitlist?",
    a: "You’ll get occasional development updates and first news of availability. If you opt in, we may invite you to prototype testing or research studies. No payment, no commitment, and you can unsubscribe any time.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-bone py-28 sm:py-36">
      <Container className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Eyebrow className="reveal text-mute">FAQ</Eyebrow>
          <h2 id="faq-title" className="reveal display mt-6 text-[clamp(2.2rem,4.4vw,3.6rem)]">
            Questions, answered straight.
          </h2>
          <p className="reveal mt-6 text-ink/60">
            Something else on your mind?{" "}
            <a href={`mailto:${site.contactEmail}`} className="text-ink underline underline-offset-4">
              Ask us
            </a>
            .
          </p>
        </div>
        <div className="lg:col-span-8">
          {faqs.map((f) => (
            <details key={f.id} data-faq={f.id} className="group border-t border-ink/15 last:border-b">
              <summary className="flex cursor-pointer items-center justify-between gap-6 py-6 text-left text-lg font-medium tracking-tight transition-colors hover:text-ink/70 sm:text-xl">
                {f.q}
                <span className="faq-icon relative size-4 shrink-0 transition-transform duration-500 ease-out-expo" aria-hidden="true">
                  <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                  <span className="absolute left-1/2 top-0 h-4 w-px bg-current" />
                </span>
              </summary>
              <div className="faq-body">
                <div className="overflow-hidden">
                  <p className="max-w-2xl pb-7 leading-relaxed text-ink/65">{f.a}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
