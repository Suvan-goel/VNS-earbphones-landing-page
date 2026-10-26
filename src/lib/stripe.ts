import "server-only";
import Stripe from "stripe";
import { reservationStorageMode, storageMode } from "./storage";
import { reservation } from "@/config/reservation";

/*
 * Stripe is used for one thing: the refundable reservation deposit. The
 * secret key lives in STRIPE_SECRET_KEY (server-only). Without it, or
 * without somewhere to store reservations, reservations are simply closed
 * and the site falls back to the free waitlist.
 */

/** The deposit, in the smallest currency unit. */
export const DEPOSIT = { amount: reservation.amount, currency: reservation.currency, label: reservation.depositLabel } as const;
export const RESERVATION_FLOW = "cymba_reservation_v1";
export const CHECKOUT_INTEGRATION = "cymba_reservations_fjqnrmvp";

let client: Stripe | null | undefined;
let clientKey: string | undefined;

/** An isolated, real Stripe sandbox flow backed only by this computer's database. */
export function localReservationTestMode(): boolean {
  return process.env.RESERVATIONS_LOCAL_TEST === "true" && process.env.NODE_ENV !== "production";
}

export function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  // Check on every call: even an already cached client must not bypass local safeguards.
  if (process.env.RESERVATIONS_LOCAL_TEST === "true"
    && (!localReservationTestMode() || !/^(?:[sr]k|rkcs)_test_/.test(key ?? ""))) return null;
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
      && /^(?:[sr]k|rkcs)_test_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "")
      && Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  }
  return process.env.RESERVATIONS_ENABLED === "true"
    && Boolean(process.env.STRIPE_SECRET_KEY?.trim())
    && Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim())
    && storageMode() === "supabase";
}

export function stripeLiveMode(): boolean {
  return /^[sr]k_live_/.test(process.env.STRIPE_SECRET_KEY?.trim() ?? "");
}

export const PREVIEW_SESSION_PREFIX = "cs_preview_";
