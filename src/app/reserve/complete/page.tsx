import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { site } from "@/config/site";
import { localReservationTestMode } from "@/lib/stripe";
import {
  reservationReceiptCookie,
  reservationReceiptUrl,
  reservationPurchase,
  resolveReservationReceipt,
  validReservationReceiptHandle,
} from "@/lib/reservation-receipt";
import { ReservationConversion } from "@/components/ReservationConversion";
import { ReservationShell } from "@/components/ReservationShell";
import { ReservationStatusView, reservationStatusMessages } from "@/components/ReservationStatusView";
import { ReservationStatusRefresh } from "@/components/ReservationStatusRefresh";
import { ReservationStatusAnnouncement } from "@/components/ReservationStatusAnnouncement";

export const metadata: Metadata = {
  title: `Reservation status · ${site.brand}`,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  const copy = reservationStatusMessages[outcome.kind];

  return (
    <ReservationShell card>
      <ReservationStatusAnnouncement key={receiptHandle} message={copy.title} />
      {purchase && <ReservationConversion {...purchase} />}
      {(outcome.kind === "pending" || outcome.kind === "processing") && <ReservationStatusRefresh key={receiptHandle} />}
      <ReservationStatusView
        outcome={outcome}
        receiptUrl={receiptUrl}
        canRefresh={Boolean(sessionId)}
        testMode={localReservationTestMode()}
        confirmationUrl={receiptHandle ? `/reserve/complete/confirmation?receipt=${receiptHandle}` : undefined}
      />
    </ReservationShell>
  );
}
