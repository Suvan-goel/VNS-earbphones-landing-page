import "server-only";
import { RESERVATION_FLOW, stripe } from "./stripe";
import type { ReservationRow } from "./storage";

/** Re-read Stripe just before a delayed notice; webhook arrival order is irrelevant. */
export async function processingPaymentStillPending(row: ReservationRow): Promise<boolean> {
  const s = stripe();
  if (!s || !row.livemode || !row.stripe_session_id) throw new Error("Processing payment unavailable");
  const requestOptions = { timeout: 8_000, maxNetworkRetries: 0 };
  const cs = await s.checkout.sessions.retrieve(row.stripe_session_id, { expand: ["payment_intent"] }, requestOptions);
  const metadataMatches = (metadata: Record<string, string> | null) => metadata?.flow === RESERVATION_FLOW
    && metadata.reservation_id === row.id && metadata.attempt_id === row.attempt_id
    && metadata.terms_version === row.terms_version;
  if (cs.id !== row.stripe_session_id || cs.livemode !== row.livemode || cs.mode !== "payment"
    || cs.client_reference_id !== row.id || cs.amount_total !== row.amount || cs.currency !== row.currency
    || !metadataMatches(cs.metadata)) throw new Error("Processing checkout mismatch");
  const pi = typeof cs.payment_intent === "string"
    ? await s.paymentIntents.retrieve(cs.payment_intent, {}, requestOptions) : cs.payment_intent;
  if (!pi || (row.stripe_payment_intent && pi.id !== row.stripe_payment_intent)
    || pi.livemode !== row.livemode || pi.amount !== row.amount || pi.currency !== row.currency
    || !metadataMatches(pi.metadata)) throw new Error("Processing payment mismatch");
  return cs.status === "complete" && cs.payment_status === "unpaid"
    && pi.status !== "succeeded" && pi.status !== "canceled" && pi.status !== "requires_payment_method";
}
