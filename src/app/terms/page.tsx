import type { Metadata } from "next";
import { site } from "@/config/site";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Terms · ${site.brand}`, robots: { index: false } };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="October 2026">
      <h2>A product in development</h2>
      <p>
        {site.product} is a concept under development. Nothing on this website is an offer to sell, a pre-order or a reservation, and joining
        early access does not create any obligation for you or for us. Features, design, timing and pricing may change or may never be
        offered.
      </p>
      <h2>No medical or performance claims</h2>
      <p>
        {site.product} has not been shown to improve learning, memory, concentration or any other outcome, is not intended to diagnose or treat
        any condition, and has not been evaluated by any regulator. Information on this site is for general interest only and is not medical
        advice.
      </p>
      <h2>Images</h2>
      <p>Product images are concept illustrations, not photographs of a manufactured product.</p>
      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
