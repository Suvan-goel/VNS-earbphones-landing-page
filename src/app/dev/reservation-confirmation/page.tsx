import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservationShell } from "@/components/ReservationShell";
import { ReservationStatusView, reservationStatusMessages } from "@/components/ReservationStatusView";
import { previewOutcome, previewStates } from "./fixtures";
import styles from "./preview.module.css";

export const metadata: Metadata = { title: "Confirmation design preview · cymba", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function ConfirmationDesignPreview({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const state = typeof params.state === "string" ? params.state : "paid";
  const market = params.market === "us" ? "us" : "uk";
  const benefits = typeof params.benefits === "string" ? params.benefits : "current";
  const outcome = previewOutcome(state, market, benefits);
  const query = new URLSearchParams({ state: outcome.kind, market, benefits }).toString();
  return <ReservationShell card>
    <details className={styles.toolbar}>
      <summary><span><strong>Local preview</strong> · sample reservation</span><span>Preview options +</span></summary>
      <form action="/dev/reservation-confirmation">
      <label>Page<select name="state" defaultValue={outcome.kind}>{previewStates.map((value) => <option key={value} value={value}>{reservationStatusMessages[value].label}</option>)}</select></label>
      <label>Currency<select name="market" defaultValue={market}><option value="uk">GBP</option><option value="us">USD</option></select></label>
      <label>Benefits<select name="benefits" defaultValue={benefits}><option value="current">Founding 50</option><option value="later">Later reservation</option><option value="historical">Earlier terms</option></select></label>
      <button type="submit">View</button>
      </form>
    </details>
    <ReservationStatusView outcome={outcome} receiptUrl={`/dev/reservation-confirmation?${query}`} confirmationUrl={`/dev/reservation-confirmation/confirmation?${query}`} canRefresh />
  </ReservationShell>;
}
