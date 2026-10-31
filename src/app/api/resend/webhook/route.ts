import { NextResponse } from "next/server";
import { emailEventBody, verifyEmailEvent, recordEmailEvent } from "@/lib/reservation-email-events";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Email events not configured" }, { status: 503 });
  let event: unknown;
  try { event = verifyEmailEvent(await emailEventBody(req), req.headers, secret); }
  catch { return NextResponse.json({ error: "Invalid signature or body" }, { status: 400 }); }
  try {
    await recordEmailEvent(req.headers.get("svix-id")!, event);
    return NextResponse.json({ received: true });
  } catch {
    console.error("[reservation email] delivery event not committed");
    return NextResponse.json({ error: "Email event processing incomplete" }, { status: 500 });
  }
}
