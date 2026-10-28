import "server-only";
import Stripe from "stripe";
import { reservationStorageMode, storageMode } from "./storage";
import { reservation } from "@/config/reservation";

/*
 * Stripe is used for one thing: the refundable reservation deposit. The
 * secret key lives in STRIPE_SECRET_KEY (server-only). Without it, or
 * without somewhere to store reservations, this runtime cannot take deposits.
 * An unconfigured development page can link to the hosted reservation flow.
 */

export const RESERVATION_FLOW = "cymba_reservation_v1";
export const CHECKOUT_INTEGRATION = "cymba_reservations_fjqnrmvp";

let client: Stripe | null | undefined;
let clientKey: string | undefined;

function stripeKeyMode(): "test" | "live" | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (/^(?:[sr]k|rkcs)_test_[A-Za-z0-9_]+$/.test(key)) return "test";
  if (/^[sr]k_live_[A-Za-z0-9_]+$/.test(key)) return "live";
  return null;
}

/** Only this public key may be passed to Stripe.js; private credentials stay on the server. */
export function stripePublishableKey(): string | null {
  const key = process.env.STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  const match = /^pk_(test|live)_[A-Za-z0-9_]+$/.exec(key);
  if (!match || match[1] !== stripeKeyMode()) return null;
  if (process.env.RESERVATIONS_LOCAL_TEST === "true" && (!localReservationTestMode() || match[1] !== "test")) return null;
  return key;
}

/** A missing public key retains hosted Checkout rather than disabling reservations. */
export function inlineCheckoutEnabled(): boolean {
  return reservationsOpen() && !previewMode() && stripePublishableKey() !== null;
}

/** An isolated, real Stripe sandbox flow backed only by this computer's database. */
export function localReservationTestMode(): boolean {
  return process.env.RESERVATIONS_LOCAL_TEST === "true" && process.env.NODE_ENV !== "production";
}

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const mode = stripeKeyMode();
  if (!mode) return null;
  // Check on every call: even an already cached client must not bypass local safeguards.
  if (process.env.RESERVATIONS_LOCAL_TEST === "true"
    && (!localReservationTestMode() || mode !== "test")) return null;
  if (client !== undefined && clientKey === key) return client;
  clientKey = key;
  client = key ? new Stripe(key, { typescript: true, maxNetworkRetries: 2, timeout: 10000 }) : null;
  return client;
}

/**
 * Local preview without Stripe: RESERVATIONS_PREVIEW=true swaps Stripe's
 * checkout for a clearly labelled stand-in page so the whole flow can be
 * walked through. Never active in production.
 */
export function previewMode(): boolean {
  return process.env.RESERVATIONS_LOCAL_TEST !== "true" && process.env.RESERVATIONS_PREVIEW === "true"
    && process.env.NODE_ENV !== "production" && storageMode() === "file";
}

/** True when a deposit can actually be taken (or previewed) and recorded. */
export function reservationsOpen(): boolean {
  if (previewMode()) return true;
  if (process.env.RESERVATIONS_LOCAL_TEST === "true") {
    return localReservationTestMode() && reservationStorageMode() === "local"
      && process.env.RESERVATIONS_ENABLED === "true"
      && stripeKeyMode() === "test"
      && Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  }
  return process.env.RESERVATIONS_ENABLED === "true"
    && stripeKeyMode() !== null
    && Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim())
    && storageMode() === "supabase";
}

/** Offer the live reservation page from an unconfigured development preview only. */
export function hostedReservationUrl(variant: string): string | null {
  if (process.env.NODE_ENV !== "development"
    || reservationsOpen()
    || process.env.RESERVATIONS_ENABLED === "false"
    || process.env.RESERVATIONS_LOCAL_TEST === "true"
    || process.env.RESERVATIONS_PREVIEW === "true"
    || process.env.STRIPE_SECRET_KEY?.trim()
    || process.env.STRIPE_WEBHOOK_SECRET?.trim()) return null;

  const destination = new URL(reservation.hostedUrl);
  destination.search = new URLSearchParams({ v: variant }).toString();
  return destination.href;
}

export function stripeLiveMode(): boolean {
  return stripeKeyMode() === "live";
}

export const PREVIEW_SESSION_PREFIX = "cs_preview_";
