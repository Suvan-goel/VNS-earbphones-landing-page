import type { Metadata } from "next";
import Image from "next/image";
import { defaultVariant, heroVariants, reservation, site } from "@/config/site";
import { localReservationTestMode, previewMode, reservationsOpen } from "@/lib/stripe";
import { ReserveForm } from "@/components/ReserveForm";
import { ReservationShell } from "@/components/ReservationShell";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Reserve ${site.product} · ${site.brand}`,
  description: `Reserve ${site.product} with a ${reservation.depositLabel} deposit. Fully refundable before shipping and credited toward the final price.`,
  alternates: { canonical: reservation.path },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Check() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5 10 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default async function ReservePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedVariant = first(params.v);
  const variant = requestedVariant && Object.hasOwn(heroVariants, requestedVariant) ? requestedVariant : defaultVariant;
  const cancelled = first(params.cancelled) === "1";
  const open = reservationsOpen();
  const preview = previewMode();
  const home = `/?v=${variant}`;
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency", currency: reservation.currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 0,
  }).format(reservation.amount / 100);

  return (
    <ReservationShell home={home}>
      <div className={styles.layout}>
        <div className={styles.panel}>
          <section className={styles.summary} aria-labelledby="reserve-title">
            <p className={styles.eyebrow}>Early access</p>
            <h1 id="reserve-title" className={styles.title}>Reserve yours.</h1>
            <p className={styles.subtitle}>Your place in line for {site.product}.</p>

            <figure className={styles.visual}>
              <Image src="/models/cymba-earbuds-hero-poster.webp" width={1200} height={1344} priority sizes="320px" alt={`A pair of ${site.product} earbuds.`} />
            </figure>

            <div className={styles.deposit}>
              <div>
                <h2 className={styles.depositLabel}>Reservation deposit</h2>
                <p className={styles.refundable}>Fully refundable before shipping</p>
              </div>
              <p className={styles.amount} aria-label={reservation.depositLabel}>{amount}<span>{reservation.currency.toUpperCase()}</span></p>
            </div>
            <ul className={styles.benefits}>
              <li><Check /> Applied to your final purchase</li>
              <li><Check /> No automatic charge for the balance</li>
            </ul>
            <p className={styles.details}>Final price and shipping details will be confirmed before you decide to complete your purchase.</p>
          </section>

          <section className={styles.checkout} aria-labelledby="reservation-details">
            <div className={styles.checkoutInner}>
              <h2 id="reservation-details" className={styles.formTitle}>{open ? "Your details" : "Reservations open soon"}</h2>
              <p className={styles.formIntro}>{open ? "We’ll keep you updated on your reservation." : "Join the free waitlist for product and launch updates."}</p>
              {cancelled && <p role="status" className={styles.notice}>You’ve returned from checkout. If you paid, check your confirmation before trying again.</p>}
              <ReserveForm variant={variant} open={open} preview={preview} testMode={localReservationTestMode()} />
            </div>
          </section>
        </div>
        {open && <p className={styles.waitlist}>Not ready to reserve? <a href={`${home}#signup`}>Join the free waitlist <span aria-hidden="true">↗</span></a></p>}
      </div>
    </ReservationShell>
  );
}
