import { site, type HeroVariant } from "@/config/site";
import type { StorageMode } from "@/lib/storage";
import { WaitlistForm } from "../WaitlistForm";
import { HeroPair } from "../visuals/HeroPair";
import { Container, Eyebrow } from "../ui";

const perks = [
  { t: "Honest development updates", s: "Real progress from the lab and the workshop, including what didn’t work." },
  { t: "First to know", s: "Availability and pricing, as soon as they’re decided." },
  { t: "Help shape it", s: "Opt in to prototype testing, research studies and design decisions." },
];

export function EarlyAccess({ mode, v }: { mode: StorageMode; v: HeroVariant }) {
  return (
    <section id="early-access" aria-labelledby="ea-title" className="grain relative scroll-mt-10 overflow-hidden bg-ink py-28 text-bone sm:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_80%_40%,rgba(201,196,186,0.10),transparent_70%)]" />
      <Container className="relative grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Eyebrow className="reveal text-bone/50">Early access</Eyebrow>
          <h2 id="ea-title" className="reveal display mt-6 text-[clamp(2.6rem,6vw,5rem)] text-balance">
            Be part of what comes next.
          </h2>
          <p className="reveal mt-6 max-w-lg text-lg leading-relaxed text-bone/65">
            {site.product} is being built in the open, with the people who&rsquo;d actually use it. Join early access and follow it from
            concept to product.
          </p>
          <ul className="mt-12 space-y-6">
            {perks.map((p, i) => (
              <li key={p.t} className="reveal flex gap-4" style={{ ["--d" as string]: `${i * 80}ms` }}>
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                <div>
                  <p className="font-medium tracking-tight">{p.t}</p>
                  <p className="mt-1 text-bone/55">{p.s}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-6 lg:pt-16">
          <div className="reveal rounded-[2rem] border border-white/[0.08] bg-ink-2/80 p-5 sm:p-8">
            <WaitlistForm mode={mode} variant={v.id} cta={v.primaryCta} />
          </div>
          <div aria-hidden="true" className="reveal mx-auto mt-10 hidden max-w-sm opacity-80 lg:block">
            <HeroPair p="ea" className="h-auto w-full" />
          </div>
        </div>
      </Container>
    </section>
  );
}
