import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { reservation, site } from "@/config/site";
import { defaultMarket, formatPrice, markets } from "@/config/pricing";
import { localReservationTestMode } from "@/lib/stripe";
import {
  reservationReceiptCookie,
  reservationReceiptUrl,
  reservationPurchase,
  resolveReservationReceipt,
  validReservationReceiptHandle,
  type ReservationOutcome,
} from "@/lib/reservation-receipt";
import { ReservationConversion } from "@/components/ReservationConversion";
import { ReservationShell } from "@/components/ReservationShell";
import { ReservationStatusRefresh } from "@/components/ReservationStatusRefresh";
import styles from "./status.module.css";

export const metadata: Metadata = {
  title: `Reservation status · ${site.brand}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const messages = {
  pending: {
    label: "Awaiting confirmation",
    title: "We’re waiting for confirmation.",
    description: "Your checkout has been started, but we haven’t recorded a successful payment yet. If you just paid, allow a moment and check this page again. You don’t need to make another payment while we confirm the status.",
  },
  processing: {
    label: "Payment processing",
    title: "Your payment is processing.",
    description: "Your payment is still being confirmed. Your place and founder number will be confirmed once the payment succeeds. Check this page again shortly; please don’t submit another payment while it’s processing.",
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
    description: "The saved receipt may have expired, or this link may be open in a different browser. Reopen your original checkout confirmation link, or contact us with your payment reference so we can check the status before you make another payment.",
  },
  unavailable: {
    label: "Status temporarily unavailable",
    title: "We can’t check your reservation right now.",
    description: "Our reservation records are temporarily unavailable. This doesn’t tell us whether a payment succeeded or failed. Check again shortly, or contact us with your payment reference. Please don’t make another payment just to check.",
  },
} as const;

function StatusMark({ kind }: { kind: ReservationOutcome["kind"] }) {
  const confirmed = kind === "paid";
  const waiting = kind === "pending" || kind === "processing";
  const refunded = kind === "refunded" || kind === "partially_refunded";

  return (
    <span className={styles.statusMark} data-confirmed={confirmed || undefined} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {confirmed ? <><circle cx="12" cy="12" r="8.5" /><path d="m8 12 2.5 2.5 5.5-5.5" /></> :
          waiting ? <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></> :
            refunded ? <><path d="M5 10a7 7 0 1 1 1 7M5 5v5h5" /></> :
              <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5V16M12 7.5h.01" /></>}
      </svg>
    </span>
  );
}

export default async function ReserveComplete({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Old checkout links remain valid, but no page with marketing scripts renders
  // the receipt credential in its URL. The exchange route also drops its referrer.
  if ("session_id" in params) {
    const sessions = Array.isArray(params.session_id) ? params.session_id : [params.session_id ?? ""];
    const query = new URLSearchParams();
    for (const session of sessions) query.append("session_id", session);
    redirect(`/api/reserve/receipt?${query.toString()}`);
  }
  const receiptHandle = validReservationReceiptHandle(params.receipt) ? params.receipt : undefined;
  const receiptUrl = reservationReceiptUrl(receiptHandle);
  if (Object.keys(params).some((key) => key !== "receipt") || ("receipt" in params && !receiptHandle)) redirect(receiptUrl);
  const sessionId = receiptHandle ? (await cookies()).get(reservationReceiptCookie(receiptHandle))?.value : undefined;
  const outcome = await resolveReservationReceipt(sessionId, receiptHandle);
  const purchase = reservationPurchase(outcome);
  const copy = messages[outcome.kind];
  const row = "row" in outcome ? outcome.row : null;
  const demo = "demo" in outcome && outcome.demo;
  const testMode = localReservationTestMode();
  const canRefresh = ["pending", "processing", "unavailable"].includes(outcome.kind) && Boolean(sessionId);
  const canRetry = outcome.kind === "expired" || outcome.kind === "failed";
  const founderNumber = row?.founder_number;
  // The recorded currency names the amount (US$50.00 or £35.00); a missing row falls back to the default market.
  const money = (value: number) => new Intl.NumberFormat("en-GB", {
    style: "currency", currency: row?.currency.toUpperCase() ?? markets[defaultMarket].code,
  }).format(value / 100);
  const depositLabel = row ? money(row.amount) : formatPrice(defaultMarket, "deposit", { explicit: true });
  const showFounder = (outcome.kind === "paid" || outcome.kind === "partially_refunded") && founderNumber != null;

  return (
    <ReservationShell>
      {purchase && <ReservationConversion {...purchase} />}
      {(outcome.kind === "pending" || outcome.kind === "processing") && <ReservationStatusRefresh key={receiptHandle} />}
      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="reservation-status-title">
          {demo && <p className={styles.previewNotice}><strong>Demo result</strong> No payment was taken and no real place has been reserved.</p>}
          {testMode && <p className={styles.previewNotice}><strong>Stripe test reservation</strong> No real money was charged. This record is stored only on this computer.</p>}
          <StatusMark kind={outcome.kind} />
          <p className={styles.eyebrow}>{copy.label}</p>
          <h1 id="reservation-status-title" className={styles.title}>{copy.title}</h1>
          {showFounder && <p className={styles.founder}>{demo ? "Demo founder" : "Founder"} <span>#{String(founderNumber).padStart(3, "0")}</span></p>}
          <p className={styles.description}>{outcome.kind === "paid" ? `Your ${depositLabel} deposit is recorded and fully refundable before shipping. When ${site.product} is ready to order, we’ll share the final price and shipping details. If you choose to buy, your deposit comes off the price.` : copy.description}</p>

          {outcome.kind === "paid" && <div className={styles.summary}>
            <dl className={styles.details}>
              <div><dt>{demo ? "Demo deposit" : "Deposit recorded"}</dt><dd>{depositLabel}</dd></div>
              <div><dt>Credited toward your pair</dt><dd>{depositLabel}</dd></div>
              <div><dt>Final price and shipping</dt><dd>To be confirmed</dd></div>
            </dl>
            <p className={styles.note}>{testMode ? "Test emails are not sent. " : "We’ll send reservation updates to your checkout email. "}Your founder number was assigned when payment confirmation was recorded. The remaining balance won’t be charged automatically.</p>
          </div>}

          {row && (outcome.kind === "refunded" || outcome.kind === "partially_refunded") && <div className={styles.summary}>
            <dl className={styles.details}>
              <div><dt>Original deposit</dt><dd>{depositLabel}</dd></div>
              <div><dt>Refund recorded</dt><dd>{money(row.amount_refunded)}</dd></div>
              <div><dt>Remaining deposit</dt><dd>{money(Math.max(0, row.amount - row.amount_refunded))}</dd></div>
            </dl>
          </div>}

          <div className={styles.actions}>
            {canRefresh && <a href={receiptUrl} className={styles.primaryButton}>Check status again</a>}
            {canRetry && <a href={reservation.path} className={styles.primaryButton}>Return to reservations</a>}
            <a href="/" className={canRefresh || canRetry ? styles.secondaryButton : styles.primaryButton}>Back to {site.brand}</a>
          </div>
          <p className={styles.support}>
            {outcome.kind === "paid" ? "For a full refund before shipping, contact " : "Need help? Contact "}
            <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
          </p>
        </section>
      </div>
    </ReservationShell>
  );
}
