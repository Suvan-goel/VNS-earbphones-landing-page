import { defaultVariant, heroVariants, type HeroVariant } from "@/config/site";
import { storageMode } from "@/lib/storage";
import { ConsentBanner } from "@/components/ConsentBanner";
import { Nav } from "@/components/Nav";
import { RevealObserver } from "@/components/RevealObserver";
import { Tracker } from "@/components/Tracker";
import { EarlyAccess } from "@/components/sections/EarlyAccess";
import { Faq, faqs } from "@/components/sections/Faq";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { Research } from "@/components/sections/Research";
import { Opportunity, Sound } from "@/components/sections/Story";
import { Technology } from "@/components/sections/Technology";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Hero variant comes from `?v=learn|focus|audio`, falling back to the configured default. */
function pickVariant(raw: string | string[] | undefined): HeroVariant {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v in heroVariants ? heroVariants[v as HeroVariant["id"]] : heroVariants[defaultVariant];
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const v = pickVariant((await searchParams).v);
  const mode = storageMode();

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ivory focus:px-4 focus:py-2 focus:text-[#141414]">
        Skip to content
      </a>
      <Nav cta={v.primaryCta} />
      <main id="main">
        <Hero v={v} />
        <Opportunity />
        <Sound />
        <Technology />
        <Research />
        <EarlyAccess mode={mode} v={v} />
        <Faq />
      </main>
      <Footer />
      <ConsentBanner />
      <RevealObserver />
      <Tracker variant={v.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  );
}
