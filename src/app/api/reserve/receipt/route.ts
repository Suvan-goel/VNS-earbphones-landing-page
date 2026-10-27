import { NextResponse } from "next/server";
import {
  RESERVATION_RECEIPT_MAX_AGE,
  RESERVATION_RECEIPT_PATH,
  reservationReceiptCookie,
  reservationReceiptHandle,
  reservationReceiptUrl,
  validReservationSession,
} from "@/lib/reservation-receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exchange the checkout return credential for an essential, server-readable receipt cookie. */
export async function GET(request: Request) {
  const sessions = new URL(request.url).searchParams.getAll("session_id");
  const sessionId = sessions.length === 1 && validReservationSession(sessions[0]) ? sessions[0] : null;
  const handle = sessionId ? reservationReceiptHandle(sessionId) : undefined;
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: reservationReceiptUrl(handle),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  // Separate cookies let two reservation tabs refresh their own status without
  // replacing each other's receipt. Invalid links do not disturb either tab.
  if (sessionId && handle) response.cookies.set(reservationReceiptCookie(handle), sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: RESERVATION_RECEIPT_PATH,
    maxAge: RESERVATION_RECEIPT_MAX_AGE,
  });
  return response;
}
