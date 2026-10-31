import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverDueReservationEmails } from "@/lib/reservation-email-delivery";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.RESERVATION_EMAIL_CRON_SECRET?.trim();
  const timestamp = req.headers.get("x-cymba-timestamp") ?? "";
  const signature = req.headers.get("x-cymba-signature") ?? "";
  const seconds = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!secret || secret.length < 32 || !/^\d{10}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)
    || seconds < now - 60 || seconds > now + 30) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const expected = createHmac("sha256", secret).update(`reservation-emails:${timestamp}`).digest("hex");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // No caller-supplied recipients, reservation IDs, payment changes or message content.
  try {
    const result = await deliverDueReservationEmails();
    return NextResponse.json(result, { status: result.failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Email delivery check incomplete" }, { status: 503 });
  }
}
