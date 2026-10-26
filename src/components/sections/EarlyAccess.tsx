import { reservation, site, type HeroVariant } from "@/config/site";
import type { StorageMode } from "@/lib/storage";
import { WaitlistForm } from "../WaitlistForm";
import { Container, Headline } from "../ui";

/* Centred and spare: a statement, one line, the form. Nothing else to read. */
export function EarlyAccess({ mode, v, reservations = false }: { mode: StorageMode; v: HeroVariant; reservations?: boolean }) {
  return (
    <section id="early-access" aria-labelledby="ea-title" className="section scroll-mt-14">
      <Container>
        <div className="mx-auto flex max-w-[36rem] flex-col items-center text-center">
          <Headline id="ea-title" lines={["Be first to", `experience ${site.brand}.`]} className="reveal text-[clamp(2rem,3.6vw,3.25rem)]" />
          <p className="reveal mt-4 text-[1.0625rem] leading-relaxed text-muted sm:text-lg">
            {reservations
              ? `Get launch dates and first access, free. Or hold a pair now for ${reservation.depositLabel}, fully refundable until it ships.`
              : "Get launch dates, pricing and first-access details. Free to join. No preorder."}
          </p>
          <div id="signup" tabIndex={-1} aria-label="Launch updates signup" className="reveal mt-8 w-full max-w-[30rem] scroll-mt-28 text-left">
            <WaitlistForm mode={mode} variant={v.id} cta={v.primaryCta} reservations={reservations} />
          </div>
          {reservations && (
            <a href={reservation.path} data-cta="early_access_reserve" className="reveal btn-secondary mt-5">
              {reservation.cta}
            </a>
          )}
        </div>
      </Container>
    </section>
  );
}
