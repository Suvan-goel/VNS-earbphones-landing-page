import { NextResponse } from "next/server";
import { createSignup } from "@/lib/storage";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanVariant, normaliseEmail } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";

export const runtime = "nodejs";

/** Minimum time between the form rendering and submission (bot trap). */
const MIN_FILL_MS = 1200;

export async function POST(req: Request) {
  if (!rateLimit(`waitlist:${clientKey(req)}`)) {
    return NextResponse.json({ status: "error", message: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  }

  const parsed = await readJsonObject(req);
  if (parsed.response) return parsed.response;
  const { body } = parsed;

  // Honeypot and timing checks. Bots get an honest failure, never a fake success.
  const startedAt = body.startedAt;
  if ((typeof body.company === "string" && body.company.length > 0) || typeof startedAt !== "number" || !Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < MIN_FILL_MS) {
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
    // Campaign measurement stays in the separately consented analytics system.
    // Do not attach browser tracking information to an email-address record.
    attribution: {},
  });

  switch (result.status) {
    case "created":
      return NextResponse.json({ status: "created", surveyToken: result.surveyToken }, { status: 201 });
    case "duplicate":
      return NextResponse.json({ status: "duplicate" }, { status: 200 });
    case "demo":
      return NextResponse.json({ status: "demo" }, { status: 200 });
    case "unavailable":
      return NextResponse.json({ status: "error", message: result.message }, { status: 503 });
    default:
      return NextResponse.json({ status: "error", message: result.message }, { status: 502 });
  }
}
