import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { defaultVariant, heroVariants, reservation, type HeroVariant } from "@/config/site";
import { storageMode } from "@/lib/storage";
import { reservationsOpen } from "@/lib/stripe";
import { Nav } from "@/components/Nav";
import { ProductStage } from "@/components/ProductStage";
import { RevealObserver } from "@/components/RevealObserver";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Tracker } from "@/components/Tracker";
import { EarlyAccess } from "@/components/sections/EarlyAccess";
import { Faq } from "@/components/sections/Faq";
import { getFaqGroups } from "@/config/faq";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { ProductReveal } from "@/components/sections/ProductReveal";
import { Research } from "@/components/sections/Research";
import { Glance } from "@/components/sections/Glance";
import { Worn } from "@/components/sections/Worn";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Evidence } from "@/components/sections/Evidence";
import { AppPreview } from "@/components/sections/AppPreview";
import heroPoster from "../../public/models/cymba-earbuds-hero-poster.webp";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Hero variant comes from `?v=learn|focus|audio`, falling back to the configured default. */
function pickVariant(raw: string | string[] | undefined): HeroVariant {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v in heroVariants ? heroVariants[v as HeroVariant["id"]] : heroVariants[defaultVariant];
}

/**
 * Serve the web export, keeping the editable Blender source out of the page.
 * The matching poster covers loading and browsers without WebGL.
 */
function findProductModel(): { modelUrl: string | null; posterUrl: string | null } {
  const dir = join(process.cwd(), "public/models");
  const modelUrl = existsSync(join(dir, "cymba-earbuds-hero.glb")) ? "/models/cymba-earbuds-hero.glb" : null;
  // A content-hashed URL invalidates both browser and Next image caches
  // whenever the live-rendered loading still changes.
  const posterUrl = heroPoster.src;
  return { modelUrl, posterUrl };
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const v = pickVariant((await searchParams).v);
  const mode = storageMode();
  const reservations = reservationsOpen();
  const { modelUrl, posterUrl } = findProductModel();

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: getFaqGroups(reservations).flatMap((group) => group.items).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ivory focus:px-4 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <Nav cta={reservations ? reservation.navCta : v.primaryCta} ctaHref={reservations ? reservation.path : "#signup"} />
      <main id="main">
        {/* The pinned product story has a stacked alternative for shorter screens and reduced motion. */}
        <ProductStage
          mode={mode}
          v={v}
          modelUrl={modelUrl}
          posterUrl={posterUrl}
          reservations={reservations}
          fallback={
            <>
              <Hero mode={mode} v={v} modelUrl={modelUrl} posterUrl={posterUrl} reservations={reservations} />
              <ProductReveal modelUrl={modelUrl} posterUrl={posterUrl} variant={v.id} />
              <HowItWorks modelUrl={modelUrl} posterUrl={posterUrl} variant={v.id} />
              <Evidence modelUrl={modelUrl} posterUrl={posterUrl} variant={v.id} />
              <AppPreview />
              <Worn variant={v.id} />
            </>
          }
        />
        {/* Everything after the stage scrolls over the room, so these sections take the dark treatment. */}
        <div className="on-scene">
          <Research />
          <Glance />
          <EarlyAccess mode={mode} v={v} reservations={reservations} />
          <Faq reservations={reservations} />
        </div>
      </main>
      <div className="on-scene">
        <Footer />
      </div>
      <RevealObserver />
      <SmoothScroll />
      <Tracker variant={v.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  );
}
