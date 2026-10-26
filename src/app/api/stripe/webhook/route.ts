import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyReservationEvent, lookupReservationById, type ReservationRow, type ReservationStatus } from "@/lib/storage";
import { RESERVATION_FLOW, stripe, stripeLiveMode } from "@/lib/stripe";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOf = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id ?? null;

/** Keep the original body intact for signature verification, with a bounded allocation. */
async function rawBody(req: Request): Promise<string> {
  const limit = 1024 * 1024;
  if (!req.body || Number(req.headers.get("content-length")) > limit) throw new Error("Invalid body");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Body too large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } finally { reader.releaseLock(); }
}

async function reservationFor(metadata: Stripe.Metadata | null, livemode: boolean): Promise<ReservationRow | null> {
  if (metadata?.flow !== RESERVATION_FLOW) return null;
  if (!metadata.reservation_id || !UUID.test(metadata.reservation_id)) throw new Error("Invalid reservation reference");
  const found = await lookupReservationById(metadata.reservation_id);
  // Our own attempts always exist before Checkout. Missing rows or outages must be retried.
  if (found.status !== "found") throw new Error("Reservation unavailable");
  const row = found.reservation;
  if (metadata.attempt_id !== row.attempt_id || metadata.terms_version !== row.terms_version || row.livemode !== livemode) {
    throw new Error("Reservation metadata mismatch");
  }
  return row;
}

function checkPayment(pi: Stripe.PaymentIntent, row: ReservationRow) {
  if (pi.metadata.flow !== RESERVATION_FLOW || pi.metadata.reservation_id !== row.id
    || pi.metadata.attempt_id !== row.attempt_id || pi.metadata.terms_version !== row.terms_version
    || pi.amount !== row.amount || pi.currency !== row.currency || pi.livemode !== row.livemode
    || (row.stripe_payment_intent && row.stripe_payment_intent !== pi.id)) {
    throw new Error("Reservation payment mismatch");
  }
}

async function refundsFor(s: Stripe, pi: Stripe.PaymentIntent, row: ReservationRow): Promise<{ total: number; review: boolean }> {
  let total = 0;
  let review = false;
  // A bank can return even a previously successful refund. Preserve a review state
  // until an operator resolves it, rather than promising the customer a full refund.
  for await (const refund of s.refunds.list({ payment_intent: pi.id, limit: 100 })) {
    if (refund.currency !== row.currency || idOf(refund.payment_intent) !== pi.id) throw new Error("Refund mismatch");
    if (refund.status === "failed" || refund.status === "requires_action" || refund.status === "canceled") review = true;
    if (refund.status === "succeeded") total += refund.amount;
  }
  if (!Number.isSafeInteger(total) || total < 0 || total > row.amount) throw new Error("Invalid refund total");
  return { total, review: review || total < row.amount_refunded };
}

async function saveEvent(event: Stripe.Event, row: ReservationRow, sessionId: string | null, pi: Stripe.PaymentIntent | null,
  status: ReservationStatus, amountRefunded = 0, customer: string | null = null) {
  const result = await applyReservationEvent({
    eventId: event.id, eventType: event.type, reservationId: row.id,
    attemptId: row.attempt_id, termsVersion: row.terms_version,
    sessionId, paymentIntent: pi?.id ?? null, customer: customer ?? (pi ? idOf(pi.customer) : null),
    status, amount: row.amount, currency: row.currency, amountRefunded,
    livemode: event.livemode, occurredAt: new Date(event.created * 1000).toISOString(),
  });
  if (result !== "applied" && result !== "duplicate") throw new Error("Event not committed");
}

async function handleSession(s: Stripe, event: Stripe.Event, sessionId: string) {
  // A fresh read makes delayed or reordered notifications describe the current payment.
  const cs = await s.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  const row = await reservationFor(cs.metadata, event.livemode);
  if (!row) return;
  if (cs.mode !== "payment" || cs.amount_total !== row.amount || cs.currency !== row.currency || cs.livemode !== row.livemode
    || cs.client_reference_id !== row.id || (row.stripe_session_id && row.stripe_session_id !== cs.id)) {
    throw new Error("Reservation checkout mismatch");
  }
  const pi = typeof cs.payment_intent === "string"
    ? await s.paymentIntents.retrieve(cs.payment_intent)
    : cs.payment_intent;
  if (pi) checkPayment(pi, row);
  if (cs.payment_status === "paid") {
    if (!pi || pi.status !== "succeeded" || pi.amount_received !== row.amount) throw new Error("Payment not settled");
    const refunded = await refundsFor(s, pi, row);
    await saveEvent(event, row, cs.id, pi, refunded.review ? "refund_review" : refunded.total === row.amount ? "refunded" : refunded.total > 0 ? "partially_refunded" : "paid", refunded.total, idOf(cs.customer));
    return;
  }
  const status: ReservationStatus = cs.status === "expired" ? "expired"
    : cs.status === "complete" && (event.type === "checkout.session.async_payment_failed" || pi?.status === "canceled" || pi?.status === "requires_payment_method") ? "failed"
    : cs.status === "complete" ? "processing" : "pending";
  await saveEvent(event, row, cs.id, pi, status, 0, idOf(cs.customer));
}

async function handleRefund(s: Stripe, event: Stripe.Event, paymentIntentId: string | null) {
  if (!paymentIntentId) return;
  const pi = await s.paymentIntents.retrieve(paymentIntentId);
  const row = await reservationFor(pi.metadata, event.livemode);
  if (!row) return;
  checkPayment(pi, row);
  if (pi.status !== "succeeded" || pi.amount_received !== row.amount) throw new Error("Refund payment not settled");
  const refunded = await refundsFor(s, pi, row);
  // Metadata connects this refund even when it arrives before checkout.session.completed.
  await saveEvent(event, row, null, pi, event.type === "refund.failed" || refunded.review ? "refund_review" : refunded.total === row.amount ? "refunded" : refunded.total > 0 ? "partially_refunded" : "paid", refunded.total);
}

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  // Keep processing existing deposits even when new reservations have been disabled.
  if (!s || !secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  let event: Stripe.Event;
  try { event = await s.webhooks.constructEventAsync(await rawBody(req), signature, secret); }
  catch { return NextResponse.json({ error: "Invalid signature or body." }, { status: 400 }); }
  if (event.livemode !== stripeLiveMode()) return NextResponse.json({ error: "Stripe mode mismatch." }, { status: 400 });
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        // Unrelated account checkouts must not be fulfilled by this application.
        if (event.data.object.metadata?.flow === RESERVATION_FLOW) await handleSession(s, event, event.data.object.id);
        break;
      case "charge.refunded":
        await handleRefund(s, event, idOf(event.data.object.payment_intent));
        break;
      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        await handleRefund(s, event, idOf(event.data.object.payment_intent));
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch {
    console.error("[stripe webhook] event not committed", { eventId: event.id, type: event.type });
    return NextResponse.json({ error: "Event processing failed. Please retry." }, { status: 500 });
  }
}
