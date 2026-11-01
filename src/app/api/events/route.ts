import { NextResponse } from "next/server";
import { storeConsentedEvents, storageUnavailable, type EventRow } from "@/lib/storage";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanAttribution, cleanVariant } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";
import { analyticsSessionHash, sameOriginAnalyticsRequest } from "@/lib/analytics-session";
import { ANALYTICS_CONSENT_VERSION, consentChoice, type ConsentRecord } from "@/lib/consent-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** Allow-list of event names the client may send. */
const EVENTS = new Set([
  "page_view",
  "cta_click",
  "waitlist_submit_attempt",
  "waitlist_signup_success",
  "waitlist_signup_duplicate",
  "waitlist_signup_error",
  "survey_completed",
  "survey_skipped",
  "faq_open",
  "section_view",
  "reserve_click",
  "reserve_checkout_started",
  "reserve_error",
]);

type Incoming = { name?: unknown; props?: unknown; sessionId?: unknown; variant?: unknown; path?: unknown; attribution?: unknown };

function cleanProps(raw: unknown): EventRow["props"] {
  const out: EventRow["props"] = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 12)) {
    if (!/^[a-z_]{1,32}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 120);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

export async function POST(req: Request) {
  if (!sameOriginAnalyticsRequest(req)) return json({ stored: false, count: 0 }, 403);
  if (!rateLimit(`events:${clientKey(req)}`, 120, 60 * 1000)) return json({ stored: false, count: 0 }, 429);
  const parsed = await readJsonObject(req, 64 * 1024);
  if (parsed.response) {
    parsed.response.headers.set("Cache-Control", "private, no-store");
    return parsed.response;
  }
  const { body } = parsed;
  if (!Array.isArray(body.events) || body.events.some((event) => !event || typeof event !== "object" || Array.isArray(event))) {
    return json({ status: "error", message: "Invalid events." }, 400);
  }
  const sessionHash = analyticsSessionHash(body.token);
  if (!sessionHash || consentChoice(JSON.stringify(body.consent), ANALYTICS_CONSENT_VERSION) !== "granted") {
    return json({ stored: false, count: 0 }, 401);
  }
  const consent = body.consent as ConsentRecord;
  const rows: EventRow[] = (body.events as Incoming[])
    .slice(0, 25)
    .filter((e) => typeof e.name === "string" && EVENTS.has(e.name))
    .map((e) => ({
      name: e.name as string,
      session_id: sessionHash,
      variant: cleanVariant(e.variant),
      path: typeof e.path === "string" ? e.path.slice(0, 200) : null,
      props: { ...cleanProps(e.props), consent_version: consent.version, consent_recorded_at: consent.recordedAt },
      attribution: cleanAttribution(e.attribution),
    }));
  if (storageUnavailable()) {
    return json({ stored: false, count: 0 }, 503);
  }
  if (!rows.length) return json({ stored: false, count: 0 });
  const result = await storeConsentedEvents(sessionHash, rows);
  if (result === "failed") return json({ stored: false, count: 0 }, 502);
  if (result === "withdrawn") return json({ stored: false, count: 0, withdrawn: true }, 409);
  return json({ stored: result === "stored", count: rows.length });
}
