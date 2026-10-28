import type { Metadata } from "next";
import Image from "next/image";
import { defaultVariant, heroVariants, launch, reservation, site } from "@/config/site";
import { formatCompactMarkets } from "@/config/pricing";
import { detectMarket } from "@/lib/market";
import { MarketProvider } from "@/components/MarketProvider";
import { MarketToggle } from "@/components/MarketToggle";
import { Price } from "@/components/Price";
import { hostedReservationUrl, inlineCheckoutEnabled, localReservationTestMode, previewMode, reservationsOpen, stripePublishableKey } from "@/lib/stripe";
import { ReserveForm } from "@/components/ReserveForm";
import { ReservationShell } from "@/components/ReservationShell";
import { WaitlistForm } from "@/components/WaitlistForm";
import { storageMode } from "@/lib/storage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Reserve your pair · ${site.brand}`,
  description: `Reserve ${site.product} with a ${formatCompactMarkets("deposit")} deposit. Fully refundable before shipping and taken off the ${formatCompactMarkets("retail")} price. Launching ${launch.window}.`,
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
  const { market } = await detectMarket();

  return (
    <MarketProvider initial={market}>
    <ReservationShell home={home} card>
      <div className={styles.layout}>
        <div className={styles.panel}>
          <section className={styles.summary} aria-labelledby="reserve-title">
            <figure className={styles.visual}>
              <Image src="/models/cymba-earbuds-hero-poster.webp" width={1200} height={1344} priority sizes="(min-width: 1024px) 520px, 260px" alt={`A pair of ${site.product} earbuds.`} />
            </figure>
            <p className={styles.eyebrow}>{available ? "Founders Edition" : site.product}</p>
            <h1 id="reserve-title" className={styles.title}>{available ? "Reserve yours." : "Reservations open soon."}</h1>
            <p className={styles.subtitle}>{available ? <>Be one of the <strong>first 50</strong> to reserve a device and secure Limited-edition <strong>Founders Buds</strong> at no extra cost.</> : "Join the free waitlist for product and launch updates."}</p>
            {available && <section className={styles.reservationSummary} aria-label="Your reservation">
              <div className={styles.deposit}>
                <div>
                  <h2>Reservation deposit</h2>
                  <p>Due today</p>
                </div>
                <strong><Price of="deposit" /></strong>
              </div>
              <div className={styles.currency}>
                <p>Pay in</p>
                <MarketToggle compact />
              </div>
              <ul className={styles.benefits}>
                {[
                  <>Fully refundable before shipping</>,
                  <>Taken off the <Price of="retail" /> price of the earbuds</>,
                  <>Launching {launch.window}</>,
                ].map((benefit, index) => <li key={index}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{benefit}</span>
                </li>)}
              </ul>
              <dl className={styles.launchPricing} aria-label="Launch pricing">
                <div><dt>Earbuds</dt><dd><Price of="retail" /></dd></div>
                <div><dt>Software</dt><dd><Price of="subscription" suffix="/month" /></dd></div>
                <div><dt>Due at launch</dt><dd><Price of="balance" /></dd></div>
              </dl>
              <p className={styles.productStatus}>In development. Final pricing, taxes and shipping are confirmed before you buy. No automatic balance charge.</p>
            </section>}
          </section>

          <div className={styles.panelBody}>
            <div className={styles.checkout}>
              {available ? <>
                {cancelled && <p role="status" className={styles.notice}>You’ve returned from checkout. If you paid, check your confirmation before trying again.</p>}
                <ReserveForm variant={variant} open={open} preview={preview} testMode={localReservationTestMode()} hostedUrl={hostedUrl} publishableKey={publishableKey} />
                <details className={styles.nextSteps}>
                  <summary>Reservation details<svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
                  <div className={styles.nextStepsContent}>
                    <p><strong>Your reservation.</strong> Your deposit reserves one pair, with Founders Buds available to the first 50 paid reservations. You’ll receive your reservation reference after payment is confirmed.</p>
                    <p><strong>Your choice.</strong> We’ll confirm the edition details, final pricing, shipping costs and taxes before you decide whether to complete your purchase. Your deposit comes off the price of the earbuds; the software subscription is separate.</p>
                    <p><strong>Full refunds.</strong> Cancel before shipping by emailing <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> from your reservation email. We’ll refund your original payment method.</p>
                  </div>
                </details>
              </> : <>
                <h2 id="reservation-details" className={styles.formTitle}>Be first to hear.</h2>
                <div className={styles.waitlistForm}>
                  <WaitlistForm mode={storageMode()} variant={variant} cta="Join the free waitlist" placement="hero" redirectToReservation={false} />
                </div>
                <p className={styles.details}>Unsubscribe anytime. <a href="/privacy">Privacy</a></p>
              </>}
            </div>
          </div>
        </div>
        {available && <p className={styles.waitlist}><a href={`${home}#signup`}>Join the waitlist instead</a></p>}
      </div>
    </ReservationShell>
    </MarketProvider>
  );
}
