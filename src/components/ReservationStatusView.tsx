import Image from "next/image";
import { reservation, site } from "@/config/site";
import { defaultMarket, formatPrice, foundersOffer, markets } from "@/config/pricing";
import { reservationBenefitSummary } from "@/lib/reservation-confirmation";
import type { ReservationOutcome } from "@/lib/reservation-receipt";
import { ShareReservationLink } from "./ShareReservationLink";
import styles from "./ReservationStatusView.module.css";
const messages = {
  pending: {
    label: "Awaiting confirmation",
    title: "We’re waiting for confirmation.",
    description: "Your checkout has been started, but we haven’t recorded a successful payment yet. If you just paid, allow a moment and check this page again. You don’t need to make another payment while we confirm the status.",
  },
  processing: {
    label: "Payment processing",
    title: "Your payment is processing.",
    description: "Your payment is still being confirmed. Your place and reservation number will be confirmed once the payment succeeds. Check this page again shortly; please don’t submit another payment while it’s processing.",
  },
  paid: {
    label: "Reservation confirmed",
    title: "Your place is reserved.",
    description: `Your deposit is recorded and fully refundable before shipping. When ${site.product} is ready to order, we’ll share the final price and shipping details. If you choose to buy, your deposit comes off the price.`,
  },
  partially_refunded: {
    label: "Partial refund recorded",
    title: "Your deposit has been partly refunded.",
    description: "A partial refund has been recorded against your deposit. Contact us to confirm the remaining deposit and your reservation, or to request a refund of the remaining amount before shipping.",
  },
  refund_review: {
    label: "Refund needs attention",
    title: "We need to check your refund.",
    description: "Your payment provider reported a problem with a refund. We can’t confirm that the money has been returned. Contact us so we can check the refund and your reservation. Please don’t make another payment while we resolve this.",
  },
  refunded: {
    label: "Refund recorded",
    title: "Your deposit has been refunded.",
    description: "A full refund has been recorded and this reservation is no longer active. Your bank or payment provider may take additional time to show the money in your account. Contact us if you need help checking its progress.",
  },
  expired: {
    label: "Checkout expired",
    title: "This checkout has expired.",
    description: "This checkout can no longer be completed. If you didn’t complete a payment, you can start again. If you believe a payment went through, contact us so we can check it before you try again.",
  },
  failed: {
    label: "Payment unsuccessful",
    title: "This payment wasn’t confirmed.",
    description: "We’ve recorded an unsuccessful payment for this checkout. If you see a charge or pending transaction, contact us before paying again. Otherwise, you can return to the reservation page to try again.",
  },
  missing: {
    label: "Reservation status",
    title: "We couldn’t find that reservation.",
    description: "The saved receipt may have expired, or this link may be open in a different browser. Try opening it in the browser where you paid. If you still cannot view it, contact us from your checkout email address with your payment reference or Stripe receipt so we can check the status before you make another payment.",
  },
  unavailable: {
    label: "Status temporarily unavailable",
    title: "We can’t check your reservation right now.",
    description: "Our reservation records are temporarily unavailable. This doesn’t tell us whether a payment succeeded or failed. Check again shortly, or contact us with your payment reference. Please don’t make another payment just to check.",
  },
} as const;


export const reservationStatusMessages = messages;

const shortDescriptions: Record<ReservationOutcome["kind"], string> = {
  paid: "Thank you for being here from the beginning.",
  pending: "We’re checking your payment. Please don’t pay again while we confirm it.",
  processing: "Your place is confirmed once payment succeeds. Please don’t submit another payment.",
  partially_refunded: "Part of your deposit has been refunded. Contact us to confirm your reservation and remaining benefits.",
  refund_review: "We couldn’t confirm your refund. Contact us for help, and please don’t pay again.",
  refunded: "Your reservation is no longer active. Your bank may take a little longer to show the refund.",
  expired: "If you haven’t paid, you can start again. If you see a charge, contact us first.",
  failed: "If you see a charge or pending transaction, contact us before trying again.",
  missing: "Open this link in the browser you used to pay, or contact us from your checkout email.",
  unavailable: "Please check again shortly. Don’t make another payment while we check your status.",
};

function Icon({ kind = "check" }: { kind?: "check" | "clock" | "refund" | "info" | "download" | "arrow" | "plus" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {kind === "check" ? <path d="m6 12 4 4 8-8" /> :
      kind === "clock" ? <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></> :
      kind === "refund" ? <><path d="M5 10a7 7 0 1 1 1 7M5 5v5h5" /></> :
      kind === "download" ? <><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></> :
      kind === "arrow" ? <path d="M5 12h14m-5-5 5 5-5 5" /> :
      kind === "plus" ? <path d="M12 5v14M5 12h14" /> :
      <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5V16M12 7.5h.01" /></>}
  </svg>;
}

type Props = {
  outcome: ReservationOutcome;
  receiptUrl: string;
  confirmationUrl?: string;
  canRefresh?: boolean;
  testMode?: boolean;
};

/** Shared by the real receipt and the development-only, sample-data preview. */
export function ReservationStatusView({ outcome, receiptUrl, confirmationUrl, canRefresh = false, testMode = false }: Props) {
  const copy = messages[outcome.kind];
  const paid = outcome.kind === "paid";
  const waiting = outcome.kind === "pending" || outcome.kind === "processing";
  const refunded = outcome.kind === "refunded" || outcome.kind === "partially_refunded";
  const row = "row" in outcome ? outcome.row : null;
  const demo = "demo" in outcome && outcome.demo;
  const founderNumber = row?.founder_number;
  const showNumber = (paid || outcome.kind === "partially_refunded") && founderNumber != null;
  const money = (value: number) => new Intl.NumberFormat("en-GB", {
    style: "currency", currency: row?.currency.toUpperCase() ?? markets[defaultMarket].code,
  }).format(value / 100);
  const depositLabel = row ? money(row.amount) : formatPrice(defaultMarket, "deposit", { explicit: true });
  const downloadable = confirmationUrl && row && ["paid", "partially_refunded", "refunded", "refund_review"].includes(outcome.kind);
  const termsUrl = confirmationUrl ? `${confirmationUrl}${confirmationUrl.includes("?") ? "&" : "?"}format=terms` : undefined;
  const refreshable = canRefresh && (waiting || outcome.kind === "unavailable");
  const retryable = outcome.kind === "expired" || outcome.kind === "failed";

  return <div className={styles.layout}>
    {demo && <p className={styles.previewNotice}><strong>Demo result.</strong> No payment was taken and no real place has been reserved.</p>}
    {testMode && <p className={styles.previewNotice}><strong>Stripe test reservation.</strong> No real money was charged. This record is stored only on this computer.</p>}
    <div className={styles.panel}>
    <section className={`${styles.hero} ${paid ? "" : styles.statusHero}`} aria-labelledby="reservation-status-title">
      <div className={styles.intro}>
        <figure className={styles.product}>
          <Image src="/models/cymba-earbuds-hero-poster.webp" width={1200} height={1344} priority sizes="(max-width: 700px) 280px, 360px" alt="cymba earbuds with a charcoal finish and champagne gold detailing." />
        </figure>
        <p className={styles.status} data-confirmed={paid || undefined}>
          <span className={styles.statusMark}><Icon kind={paid ? "check" : waiting ? "clock" : refunded ? "refund" : "info"} /></span>
          {copy.label}
        </p>
        <h1 id="reservation-status-title" className={styles.title}>{copy.title}</h1>
        <p className={styles.description}>{shortDescriptions[outcome.kind]}</p>

      </div>
      <div className={styles.record}>
        {paid ? <div className={styles.receipt}>
          <div className={styles.receiptHeading}>
            <h2>Your reservation</h2>
            {showNumber && <span className={styles.number} aria-label={`Reservation number ${founderNumber}`}>#{String(founderNumber).padStart(3, "0")}</span>}
          </div>
          <dl className={styles.details}>
            <div className={styles.deposit}><dt>{demo ? "Demo deposit" : "Deposit received"}<span>Refundable before shipping · credited toward your pair</span></dt><dd>{depositLabel}</dd></div>
          </dl>
          <details className={`${styles.disclosure} ${styles.savedBenefits}`}>
            <summary>Your reservation benefits <Icon kind="plus" /></summary>
            <p>{row ? reservationBenefitSummary(row) : "Contact us to confirm the benefits recorded for your reservation."}</p>
            <p>Any benefits confirmed by support are preserved. {downloadable && <a href={termsUrl}>Download your recorded terms</a>}</p>
          </details>
          {downloadable && <a href={confirmationUrl} className={styles.primaryButton}><Icon kind="download" /> Download confirmation PDF</a>}
        </div> : <>
          {showNumber && <p className={styles.reference}>Reservation <strong>#{String(founderNumber).padStart(3, "0")}</strong></p>}
          {row && refunded && <dl className={`${styles.details} ${styles.refundDetails}`}>
            <div><dt>Original deposit</dt><dd>{depositLabel}</dd></div>
            <div><dt>Refund recorded</dt><dd>{money(row.amount_refunded)}</dd></div>
            <div><dt>Remaining deposit</dt><dd>{money(Math.max(0, row.amount - row.amount_refunded))}</dd></div>
          </dl>}
          <details className={`${styles.disclosure} ${styles.statusDetails}`}>
            <summary>More about this status <Icon kind="plus" /></summary>
            <p>{copy.description}</p>
            {downloadable && <p><a href={termsUrl}>Download your recorded terms</a></p>}
          </details>
          <div className={styles.actions}>
            {refreshable && <a href={receiptUrl} className={styles.primaryButton}>Check status again <Icon kind="arrow" /></a>}
            {retryable && <a href={reservation.path} className={styles.primaryButton}>Return to reservations <Icon kind="arrow" /></a>}
            {downloadable && <a href={confirmationUrl} className={styles.secondaryButton}><Icon kind="download" /> Download confirmation PDF</a>}
            <a href={`mailto:${site.contactEmail}`} className={refreshable || retryable || downloadable ? styles.textLink : styles.primaryButton}>Contact support <Icon kind="arrow" /></a>
          </div>
        </>}
      </div>

    </section>

    {paid && <div className={styles.aftercare}>
      <section className={styles.nextSteps} aria-labelledby="next-steps-title">
        <h2 id="next-steps-title" className={styles.sectionTitle}>What happens next</h2>
        <p className={styles.aftercareCopy}>{testMode ? "Test emails are not sent. Save your confirmation above." : "We’ll email you before launch with final pricing and shipping details."} You choose whether to buy. No automatic charges.</p>
      </section>
      <section className={styles.referral} aria-labelledby="confirmed-referral-title">
        <h2 id="confirmed-referral-title" className={styles.sectionTitle}>Refer a friend. Get a month free.</h2>
        <div className={styles.referralActions}><ShareReservationLink />
          {founderNumber != null && <span>Your number <strong>#{String(founderNumber).padStart(3, "0")}</strong></span>}
        </div>
        <details className={styles.disclosure}>
          <summary>How to claim your free month <Icon kind="plus" /></summary>
          <p>Every friend who completes a paid reservation earns you {foundersOffer.referralMonths} extra month of subscription free. Share <a href={reservation.hostedUrl}>the reservation page</a> and your reservation number.</p>
          <p>After paying, your friend should email <a href={`mailto:${site.contactEmail}?subject=${encodeURIComponent("Reservation referral")}`}>{site.contactEmail}</a> from their reservation email and include your number. We’ll verify their reservation and record your extra month.</p>
          <p>Once earned, your reward stays earned even if your friend later cancels. There is no cap or expiry. Tell your friend you receive a free month for the referral. <a href="/terms#referrals">Referral terms</a>.</p>
        </details>
      </section>
    </div>}
    </div>
    <div className={styles.closing}>
      <p>{paid ? "Questions or refunds?" : "Need a hand?"} <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></p>
      <a href="/" className={styles.textLink}>Back to {site.brand} <Icon kind="arrow" /></a>
    </div>
  </div>;
}
