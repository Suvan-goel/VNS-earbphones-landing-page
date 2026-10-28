import type { Metadata } from "next";
import { site } from "@/config/site";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/sections/Footer";
import { Container, Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: `Page not found · ${site.brand}`, robots: { index: false } };

/* A missing page keeps the site's header, voice and a way home. */
export default function NotFound() {
  return (
    <>
      <Nav cta="Back to site" ctaHref="/" ctaVariant="link" />
      <main id="main" className="pt-28 sm:pt-36">
        <Container className="pb-24 sm:pb-32">
          <div className="mx-auto max-w-[36rem] text-center">
            <Eyebrow>404</Eyebrow>
            <h1 className="headline mt-5 text-[clamp(2.25rem,4.4vw,4rem)]">
              <span className="block">That page isn’t here.</span>
            </h1>
            <p className="mt-6 text-[1.0625rem] leading-relaxed text-muted sm:text-lg">
              The link may be old, or the address mistyped. Everything about {site.product} is on the home page.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a href="/" className="btn-primary">
                Back to {site.brand}
              </a>
              <a href="/#faq" className="btn-secondary">
                Read the FAQ
              </a>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
