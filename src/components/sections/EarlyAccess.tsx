import type { HeroVariant } from "@/config/site";
import type { StorageMode } from "@/lib/storage";
import { WaitlistForm } from "../WaitlistForm";
import { Container, Headline, Eyebrow } from "../ui";

const perks = [
  { t: "Honest updates", s: "Progress from the lab, including what didn’t work." },
  { t: "First to know", s: "Availability and pricing." },
  { t: "Help shape it", s: "Prototype testing, studies and design calls." },
];

export function EarlyAccess({ mode, v }: { mode: StorageMode; v: HeroVariant }) {
  return (
    <section id="early-access" aria-labelledby="ea-title" className="section relative scroll-mt-10 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_55%_at_75%_45%,rgba(207,162,142,0.07),transparent_70%)]" />
      <Container className="relative grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Eyebrow className="reveal">05 / Early access</Eyebrow>
          <Headline id="ea-title" lines={["Be part of", "what comes next."]} className="reveal mt-5 text-[clamp(2.5rem,5vw,4.25rem)]" />
          <p className="reveal mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-ivory-soft">
            Built in the open, with the people who&rsquo;ll use it.
          </p>
          <ul className="mt-12 space-y-6">
            {perks.map((p, i) => (
              <li key={p.t} className="reveal flex gap-4" style={{ ["--d" as string]: `${i * 80}ms` }}>
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-rose" aria-hidden="true" />
                <div>
                  <p className="font-medium tracking-[-0.02em] text-ivory">{p.t}</p>
                  <p className="mt-1 text-muted">{p.s}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-6 lg:self-center">
          <div className="reveal panel p-5 sm:p-8">
            <WaitlistForm mode={mode} variant={v.id} cta={v.primaryCta} />
          </div>
        </div>
      </Container>
    </section>
  );
}
