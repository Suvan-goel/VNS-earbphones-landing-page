import "server-only";

import { createHash } from "node:crypto";
import { lookupReservation, type ReservationRow, type ReservationStatus } from "@/lib/storage";
import { PREVIEW_SESSION_PREFIX, localReservationTestMode, previewMode } from "@/lib/stripe";

const RESERVATION_RECEIPT_COOKIE_PREFIX = "cymba-reservation-receipt-";
export const RESERVATION_RECEIPT_PATH = "/reserve/complete";
export const RESERVATION_RECEIPT_MAX_AGE = 30 * 24 * 60 * 60;

export type ReservationOutcome =
  | { kind: ReservationStatus; row: ReservationRow; demo: boolean }
  | { kind: "missing" | "unavailable" };

export function validReservationSession(sessionId: unknown): sessionId is string {
  return typeof sessionId === "string" && sessionId.length <= 255 && /^cs_[A-Za-z0-9_-]+$/.test(sessionId);
}

export function validReservationReceiptHandle(handle: unknown): handle is string {
  return typeof handle === "string" && /^[a-f0-9]{64}$/.test(handle);
}

/** The handle identifies a browser receipt, but cannot retrieve a reservation without its cookie. */
export function reservationReceiptHandle(sessionId: string): string {
  return createHash("sha256").update(`receipt:${sessionId}`).digest("hex");
}

export function reservationReceiptCookie(handle: string): string {
  return `${RESERVATION_RECEIPT_COOKIE_PREFIX}${handle}`;
}

export function reservationReceiptUrl(handle?: string): string {
  return handle ? `${RESERVATION_RECEIPT_PATH}?receipt=${handle}` : RESERVATION_RECEIPT_PATH;
}

/** Signed webhook events, rather than the return URL, confirm real payments. */
export async function resolveReservationReceipt(sessionId: string | undefined, handle: string | undefined): Promise<ReservationOutcome> {
  if (!validReservationReceiptHandle(handle) || !validReservationSession(sessionId)
    || reservationReceiptHandle(sessionId) !== handle) return { kind: "missing" };
  const demo = sessionId.startsWith(PREVIEW_SESSION_PREFIX);
  if (demo && !previewMode()) return { kind: "missing" };
  const result = await lookupReservation(sessionId);
  if (result.status === "unavailable") return { kind: "unavailable" };
  if (result.status === "not_found") return { kind: "missing" };
  return { kind: result.reservation.status, row: result.reservation, demo };
}

/** Only these non-personal fields may cross into the browser's conversion tracker. */
export function reservationPurchase(outcome: ReservationOutcome) {
  if (outcome.kind !== "paid" || !("row" in outcome) || outcome.demo || localReservationTestMode()) return null;
  const { row } = outcome;
  if (row.livemode !== true || row.status !== "paid" || row.amount_refunded !== 0
    || !row.id || !Number.isSafeInteger(row.amount) || row.amount <= 0 || !/^[a-z]{3}$/i.test(row.currency)) return null;
  return {
    eventId: createHash("sha256").update(`reservation:${row.id}`).digest("hex"),
    value: row.amount / 100,
    currency: row.currency.toUpperCase(),
  };
}
