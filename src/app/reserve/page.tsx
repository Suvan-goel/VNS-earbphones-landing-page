import type { Metadata } from "next";
import Image from "next/image";
import { defaultVariant, heroVariants, launch, reservation, site } from "@/config/site";
import { formatCompactMarkets, foundersOffer } from "@/config/pricing";
import { detectMarket } from "@/lib/market";
import { MarketProvider } from "@/components/MarketProvider";
import { Price } from "@/components/Price";
import { hostedReservationUrl, inlineCheckoutEnabled, localReservationTestMode, previewMode, reservationsOpen, stripePublishableKey } from "@/lib/stripe";
import { ReserveForm } from "@/components/ReserveForm";
import { ReservationShell } from "@/components/ReservationShell";
import { ShareReservationLink } from "@/components/ShareReservationLink";
import { WaitlistForm } from "@/components/WaitlistForm";
import { storageMode } from "@/lib/storage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Reserve your pair · ${site.brand}`,
  description: `The first ${foundersOffer.limit} paid reservations get ${formatCompactMarkets("founderDiscount")} off the launch retail price, ${foundersOffer.freeMonths} months of subscription free and Founders Buds. Reserve with a refundable ${formatCompactMarkets("deposit")} deposit.`,
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
          {available && <div className={styles.cardHeader}>
            <p className={styles.shipping}>Planned shipping {launch.window}</p>
          </div>}
          <section className={styles.summary} aria-labelledby="reserve-title">
            <figure className={styles.visual}>
              <Image src="/models/cymba-earbuds-hero-poster.webp" width={1200} height={1344} priority sizes="(min-width: 1024px) 520px, 260px" alt={`A pair of ${site.product} earbuds.`} />
            </figure>
            {available ? <h1 id="reserve-title" className={styles.eyebrow}>Founders Edition · First {foundersOffer.limit} paid reservations:</h1> : <>
              <p className={styles.eyebrow}>{site.product}</p>
              <h1 id="reserve-title" className={styles.title}>Reservations open soon.</h1>
              <p className={styles.subtitle}>Join the free waitlist for product and launch updates.</p>
            </>}
            {available && <ul className={styles.offerBenefits} aria-label="First 50 reservation benefits">
              {[
                <><Price of="founderDiscount" /> off the launch retail price</>,
                <>{foundersOffer.freeMonths} months of subscription free</>,
                <>Limited-edition Founders Buds</>,
              ].map((benefit, index) => <li key={index}>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m4.5 10 3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span>{benefit}</span>
              </li>)}
            </ul>}
            {available && <section className={styles.reservationSummary} aria-label="Your reservation">
              <dl className={styles.pricing} aria-label="Founders pricing">
                <div className={styles.deposit}><dt>Refundable deposit today</dt><dd><Price of="deposit" /></dd></div>
                <div><dt>Founders price</dt><dd><span className={styles.retail}><span className="sr-only">Retail price </span><s><Price of="retail" /></s></span><Price of="founderRetail" /></dd></div>
                <div><dt>Balance at launch</dt><dd><Price of="founderBalance" /></dd></div>
                <div className={styles.subscriptionRow}><dt>Subscription</dt><dd className={styles.subscription}><span>{foundersOffer.freeMonths} months free then <Price of="subscription" suffix="/Month" /></span></dd></div>
              </dl>
            </section>}
          </section>

          <div className={styles.panelBody}>
            <div className={styles.checkout}>
              {available ? <>
                {cancelled && <p role="status" className={styles.notice}>You’ve returned from checkout. If you paid, check your confirmation before trying again.</p>}
                <ReserveForm variant={variant} open={open} preview={preview} testMode={localReservationTestMode()} hostedUrl={hostedUrl} publishableKey={publishableKey} />
                <div className={styles.referral}>
                  <p>Get a month free per friend who reserves</p>
                  <ShareReservationLink />
                </div>
                <details className={styles.nextSteps}>
                  <summary>Reservation details<svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
                  <div className={styles.nextStepsContent}>
                    <p><strong>Your reservation.</strong> Your deposit reserves one pair. The first {foundersOffer.limit} paid reservations receive <Price of="founderDiscount" /> off the launch retail price, {foundersOffer.freeMonths} months of subscription free and limited-edition Founders Buds when they buy the finished product. You’ll receive your reservation number after payment is confirmed.</p>
                    <p><strong>Your choice.</strong> We’ll confirm the edition details, final pricing, shipping costs and taxes before you decide whether to complete your purchase. Your full deposit comes off your purchase price in addition to any Founders discount.</p>
                    <p><strong>Your free months.</strong> The Founders subscription benefit starts when you activate your delivered pair. After the free period, the subscription is <Price of="subscription" suffix="/month" />; final subscription terms are confirmed before activation. Verified referral months add to your free subscription period and are available to reservation holders beyond the first {foundersOffer.limit}, too.</p>
                    <p><strong>Claiming referral rewards.</strong> Once your friend has paid, ask them to email <a href={`mailto:${site.contactEmail}?subject=${encodeURIComponent("Reservation referral")}`}>{site.contactEmail}</a> from their reservation email and include your reservation number. We’ll verify their reservation and record your extra month. <a href="/terms#referrals">Referral reward details</a>.</p>
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
