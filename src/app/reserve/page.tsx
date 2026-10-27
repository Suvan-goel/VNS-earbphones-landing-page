import type { Metadata } from "next";
import Image from "next/image";
import { defaultVariant, heroVariants, reservation, site } from "@/config/site";
import { hostedReservationUrl, inlineCheckoutEnabled, localReservationTestMode, previewMode, reservationsOpen, stripePublishableKey } from "@/lib/stripe";
import { ReserveForm } from "@/components/ReserveForm";
import { ReservationShell } from "@/components/ReservationShell";
import { WaitlistForm } from "@/components/WaitlistForm";
import { storageMode } from "@/lib/storage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Reserve ${site.product} · ${site.brand}`,
  description: `Reserve ${site.product} with a ${reservation.depositLabel} deposit. Fully refundable before shipping and credited toward the final price.`,
  alternates: { canonical: reservation.path },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReservePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedVariant = first(params.v);
  const variant = requestedVariant && Object.hasOwn(heroVariants, requestedVariant) ? requestedVariant : defaultVariant;
  const cancelled = first(params.cancelled) === "1";
  const open = reservationsOpen();
  const hostedUrl = hostedReservationUrl(variant);
  const available = open || Boolean(hostedUrl);
  const preview = previewMode();
  const publishableKey = inlineCheckoutEnabled() ? stripePublishableKey() : null;
  const home = `/?v=${variant}`;

  return (
    <ReservationShell home={home} card>
      <div className={styles.layout}>
        <div className={styles.panel}>
          <section className={styles.summary} aria-labelledby="reserve-title">
            <figure className={styles.visual}>
              <Image src="/models/cymba-earbuds-hero-poster.webp" width={1200} height={1344} priority sizes="220px" alt={`A pair of ${site.product} earbuds.`} />
            </figure>
            <h1 id="reserve-title" className={styles.title}>{available ? "Reserve yours." : "Reservations open soon."}</h1>
            <p className={styles.subtitle}>{available ? <><strong>{reservation.depositLabel} deposit</strong><span>Fully refundable before shipping.</span></> : "Join the free waitlist for product and launch updates."}</p>
          </section>

          <div className={styles.checkout}>
            {available ? <>
              {cancelled && <p role="status" className={styles.notice}>You’ve returned from checkout. If you paid, check your confirmation before trying again.</p>}
              <ReserveForm variant={variant} open={open} preview={preview} testMode={localReservationTestMode()} hostedUrl={hostedUrl} publishableKey={publishableKey} />
              <p className={styles.details}>Your deposit comes off the final price. We’ll confirm pricing and shipping before you decide to buy. No automatic balance charge.</p>
            </> : <>
              <h2 id="reservation-details" className={styles.formTitle}>Be first to hear.</h2>
              <div className={styles.waitlistForm}>
                <WaitlistForm mode={storageMode()} variant={variant} cta="Join the free waitlist" placement="hero" />
              </div>
              <p className={styles.details}>Unsubscribe anytime. <a href="/privacy">Privacy</a></p>
            </>}
          </div>
        </div>
        {available && <p className={styles.waitlist}><a href={`${home}#signup`}>Join the waitlist instead</a></p>}
      </div>
    </ReservationShell>
  );
}
