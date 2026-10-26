import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { reservation, site } from "@/config/site";
import { getReservation } from "@/lib/storage";
import { PREVIEW_SESSION_PREFIX, previewMode } from "@/lib/stripe";
import { ReservationShell } from "@/components/ReservationShell";
import styles from "../complete/status.module.css";

export const metadata: Metadata = { title: "Demo checkout", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Deliberately separate from real payment UI: available only in local preview mode. */
export default async function PreviewCheckout({ searchParams }: { searchParams: SearchParams }) {
  if (!previewMode()) notFound();
  const raw = (await searchParams).session_id;
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  if (!sessionId?.startsWith(PREVIEW_SESSION_PREFIX) || sessionId.length > 255 || !/^cs_[A-Za-z0-9_-]+$/.test(sessionId)) notFound();
  const row = await getReservation(sessionId);
  if (!row) notFound();
  const pending = row.status === "pending";

  return (
    <ReservationShell>
      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="demo-checkout-title">
          <p className={styles.previewNotice}><strong>Demo checkout</strong> No payment is taken and no real reservation will be created.</p>
          <span className={styles.statusMark} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg>
          </span>
          <p className={styles.eyebrow}>Reservation preview</p>
          <h1 id="demo-checkout-title" className={styles.title}>One step closer to {site.product}.</h1>
          <p className={styles.description}>Your deposit is fully refundable before shipping and credited toward the final price. Final price and shipping details are still to be confirmed.</p>
          <div className={styles.summary}>
            <dl className={styles.details}>
              <div><dt>Demo reservation deposit</dt><dd>{reservation.depositLabel}</dd></div>
              <div><dt>Payment details</dt><dd>Not required</dd></div>
            </dl>
          </div>
          {pending ? <form method="post" action="/api/reserve/preview" className={styles.previewForm}>
            <input type="hidden" name="session_id" value={sessionId} />
            <h2 className={styles.sectionTitle}>Preview the confirmation</h2>
            <p className={styles.smallDescription}>Record a demo reservation to see the next step. No card details are needed, and you won’t be charged.</p>
            <div className={styles.actions}>
              <button type="submit" name="action" value="pay" className={styles.primaryButton}>Simulate a successful reservation</button>
              <button type="submit" name="action" value="cancel" className={styles.secondaryButton}>Cancel demo and go back</button>
            </div>
          </form> : <div className={styles.previewForm}>
            <h2 className={styles.sectionTitle}>Demo status: {row.status.replaceAll("_", " ")}</h2>
            <p className={styles.smallDescription}>View the recorded demo result. No payment was taken and no real place has been reserved.</p>
            <div className={styles.actions}>
              <a href={`/reserve/complete?session_id=${encodeURIComponent(sessionId)}`} className={styles.primaryButton}>View demo status</a>
              <a href={reservation.path} className={styles.secondaryButton}>Back to reservations</a>
            </div>
          </div>}
        </section>
      </div>
    </ReservationShell>
  );
}
