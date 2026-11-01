import { reservation } from "@/config/reservation";
import type { ReservationOutcome } from "@/lib/reservation-receipt";
import type { ReservationRow } from "@/lib/storage";

export const previewStates = ["paid", "processing", "pending", "partially_refunded", "refunded", "refund_review", "failed", "expired", "missing", "unavailable"] as const;

/** Fictional data only; this preview never reads or writes reservation storage. */
export function previewOutcome(state: string | undefined, market: string | undefined, benefits?: string): ReservationOutcome {
  const kind = previewStates.find((value) => value === state) ?? "paid";
  if (kind === "missing" || kind === "unavailable") return { kind };
  const amount = market === "us" ? 5000 : 3500;
  const row: ReservationRow = {
    id: "local-design-preview", attempt_id: "local-design-preview", created_at: "2026-10-30T12:00:00Z",
    email: "preview@example.invalid", variant: null, stripe_session_id: null,
    stripe_payment_intent: null, stripe_customer: null, checkout_expires_at: null,
    amount, currency: market === "us" ? "usd" : "gbp",
    amount_refunded: kind === "refunded" ? amount : kind === "partially_refunded" ? 1000 : 0,
    status: kind, founder_number: benefits === "later" ? 64 : 16, founder_position: benefits === "later" ? 51 : 3,
    paid_at: "2026-10-30T12:00:00Z", refunded_at: null,
    terms_version: benefits === "historical" ? "2026-10-28" : reservation.termsVersion,
    terms_accepted_at: "2026-10-30T11:59:00Z", livemode: false,
  };
  return { kind, row, demo: false };
}
