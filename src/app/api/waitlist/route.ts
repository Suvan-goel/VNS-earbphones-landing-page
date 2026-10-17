import { NextResponse } from "next/server";
import { createSignup } from "@/lib/storage";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanAttribution, cleanVariant, normaliseEmail } from "@/lib/validation";

export const runtime = "nodejs";

/** Minimum time between the form rendering and submission (bot trap). */
const MIN_FILL_MS = 1200;

export async function POST(req: Request) {
  if (!rateLimit(`waitlist:${clientKey(req)}`)) {
    return NextResponse.json({ status: "error", message: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  // Honeypot and timing checks. Bots get an honest failure, never a fake success.
  const startedAt = Number(body.startedAt);
  if ((typeof body.company === "string" && body.company.length > 0) || !startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return NextResponse.json({ status: "error", message: "We couldn't verify that submission. Please try again." }, { status: 400 });
  }

  const email = normaliseEmail(body.email);
  if (!email) {
    return NextResponse.json({ status: "error", message: "Please enter a valid email address." }, { status: 422 });
  }

  const result = await createSignup({
    email,
    researchOptIn: body.researchOptIn === true,
    variant: cleanVariant(body.variant),
    attribution: cleanAttribution(body.attribution),
  });

  switch (result.status) {
    case "created":
      return NextResponse.json({ status: "created", surveyToken: result.surveyToken }, { status: 201 });
    case "duplicate":
      return NextResponse.json({ status: "duplicate" }, { status: 200 });
    case "demo":
      return NextResponse.json({ status: "demo" }, { status: 200 });
    default:
      return NextResponse.json({ status: "error", message: result.message }, { status: 502 });
  }
}
