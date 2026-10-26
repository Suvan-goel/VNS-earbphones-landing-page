import { NextResponse } from "next/server";
import { site } from "@/config/site";
import { reservation } from "@/config/reservation";
import { attachReservationSession, createReservation } from "@/lib/storage";
import { CHECKOUT_INTEGRATION, DEPOSIT, PREVIEW_SESSION_PREFIX, RESERVATION_FLOW, localReservationTestMode, previewMode, reservationsOpen, stripe, stripeLiveMode } from "@/lib/stripe";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanAttribution, cleanVariant, normaliseEmail } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";

export const runtime = "nodejs";
const ATTEMPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_FILL_MS = 800;
const unavailable = () => NextResponse.json({ status: "unavailable", message: "Reservations aren't open yet. Join the waitlist and we'll tell you when they are." }, { status: 503 });
const retryAttempt = (status: string, message: string) => NextResponse.json({ status, message, resetAttempt: true }, { status: 409 });

/** One durable attempt and one idempotent Checkout session. No marketing signup is implied. */
export async function POST(req: Request) {
  if (!reservationsOpen()) return unavailable();
  if (!rateLimit(`reserve:${clientKey(req)}`)) {
    return NextResponse.json({ status: "error", message: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = await readJsonObject(req);
  if (parsed.response) return parsed.response;
  const { body } = parsed;
  const startedAt = body.startedAt;
  if ((typeof body.company === "string" && body.company.length > 0) || typeof startedAt !== "number"
    || !Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < MIN_FILL_MS) {
    return NextResponse.json({ status: "error", message: "We couldn't verify that submission. Please try again." }, { status: 400 });
  }
  const email = normaliseEmail(body.email);
  if (!email) return NextResponse.json({ status: "error", message: "Please enter a valid email address." }, { status: 422 });
  if (body.termsAccepted !== true) {
    return NextResponse.json({ status: "error", message: "Please agree to the reservation terms before continuing." }, { status: 422 });
  }
  if (body.termsVersion !== reservation.termsVersion) {
    return retryAttempt("terms_changed", "The reservation terms have changed. Refresh this page and review them before continuing.");
  }
  if (typeof body.attemptId !== "string" || !ATTEMPT_ID.test(body.attemptId)) {
    return NextResponse.json({ status: "error", message: "Please refresh this page and try again." }, { status: 422 });
  }
  const preview = previewMode();
  const stored = await createReservation({
    attemptId: body.attemptId.toLowerCase(), email, variant: cleanVariant(body.variant), attribution: cleanAttribution(body.attribution),
    amount: DEPOSIT.amount, currency: DEPOSIT.currency, termsVersion: reservation.termsVersion, livemode: !preview && stripeLiveMode(),
  });
  if (stored.status === "conflict") return retryAttempt("conflict", "Your reservation details changed. Please review them and try again.");
  if (stored.status !== "ready") {
    return NextResponse.json({ status: "error", message: "We couldn't save your reservation details. Please try again." }, { status: 503 });
  }
  const row = stored.reservation;
  const origin = localReservationTestMode() ? "http://127.0.0.1:3015"
    : process.env.NODE_ENV === "production" ? site.url.replace(/\/$/, "") : new URL(req.url).origin;
  const completeUrl = (id: string) => `/reserve/complete?session_id=${encodeURIComponent(id)}`;
  if (row.status === "failed" || row.status === "expired") {
    return retryAttempt(row.status, "This checkout is closed. You can start a new reservation when you're ready.");
  }
  if (row.stripe_session_id && row.status !== "pending") {
    return NextResponse.json({ status: "ok", url: completeUrl(row.stripe_session_id) });
  }
  // Stripe retains idempotency keys for at least 24 hours. Never recreate a lost attempt after that window.
  if (!row.stripe_session_id && Date.now() - Date.parse(row.created_at) > 23 * 60 * 60 * 1000) {
    return retryAttempt("expired", "This checkout attempt has expired. Please start a new reservation.");
  }
  if (preview) {
    const sessionId = row.stripe_session_id ?? `${PREVIEW_SESSION_PREFIX}${row.id}`;
    if (!await attachReservationSession(row.id, sessionId, Math.floor(Date.parse(row.created_at) / 1000) + 86400)) {
      return NextResponse.json({ status: "error", message: "We couldn't save the preview. Please try again." }, { status: 503 });
    }
    return NextResponse.json({ status: "ok", url: `/reserve/preview?session_id=${sessionId}` });
  }
  const s = stripe();
  if (!s) return unavailable();
  try {
    const metadata = { flow: RESERVATION_FLOW, reservation_id: row.id, attempt_id: row.attempt_id, terms_version: row.terms_version };
    const session = row.stripe_session_id
      ? await s.checkout.sessions.retrieve(row.stripe_session_id)
      : await s.checkout.sessions.create({
        mode: "payment",
        submit_type: "pay",
        branding_settings: { display_name: site.brand, background_color: "#ffffff", button_color: "#202023", border_style: "rounded" },
        integration_identifier: CHECKOUT_INTEGRATION,
        adaptive_pricing: { enabled: false },
        client_reference_id: row.id,
        customer_email: row.email,
        customer_creation: "always",
        expires_at: Math.floor(Date.parse(row.created_at) / 1000) + 86400,
        line_items: [{ quantity: 1, price_data: {
          currency: row.currency, unit_amount: row.amount,
          product_data: { name: `${site.product} reservation deposit`, description: "Refundable until shipment. Credited against the final price. No automatic balance charge." },
        } }],
        payment_intent_data: { description: `${site.product} reservation deposit`, metadata },
        metadata,
        success_url: `${origin}/reserve/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/reserve?cancelled=1`,
      }, { idempotencyKey: `reservation:${row.attempt_id}` });
    if (session.metadata?.reservation_id !== row.id || session.metadata?.flow !== RESERVATION_FLOW) {
      throw new Error("Unexpected checkout reference");
    }
    if (!await attachReservationSession(row.id, session.id, session.expires_at)) {
      // Retain the session: a retry recovers the same one through Stripe's idempotency key.
      return NextResponse.json({ status: "error", message: "We couldn't finish saving your checkout. Please try again." }, { status: 503 });
    }
    if (session.status === "expired") return retryAttempt("expired", "This checkout has expired. You can start a new reservation.");
    if (session.status === "complete") return NextResponse.json({ status: "ok", url: completeUrl(session.id) });
    if (!session.url || session.status !== "open") throw new Error("Checkout not available");
    return NextResponse.json({ status: "ok", url: session.url });
  } catch {
    // Stripe exceptions can include submitted personal data; do not log their messages.
    console.error("[reserve] checkout request failed");
    return NextResponse.json({ status: "error", message: "We couldn't open checkout. Please try again using this form." }, { status: 502 });
  }
}
