import { NextResponse } from "next/server";
import { storeEvents, storageMode, storageUnavailable, type EventRow } from "@/lib/storage";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanAttribution, cleanVariant } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";

export const runtime = "nodejs";

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
  if (!rateLimit(`events:${clientKey(req)}`, 120, 60 * 1000)) return new NextResponse(null, { status: 429 });
  const parsed = await readJsonObject(req, 64 * 1024);
  if (parsed.response) return parsed.response;
  const { body } = parsed;
  if (!Array.isArray(body.events) || body.events.some((event) => !event || typeof event !== "object" || Array.isArray(event))) {
    return NextResponse.json({ status: "error", message: "Invalid events." }, { status: 400 });
  }
  const rows: EventRow[] = (body.events as Incoming[])
    .slice(0, 25)
    .filter((e) => typeof e.name === "string" && EVENTS.has(e.name))
    .map((e) => ({
      name: e.name as string,
      session_id: typeof e.sessionId === "string" ? e.sessionId.slice(0, 64) : null,
      variant: cleanVariant(e.variant),
      path: typeof e.path === "string" ? e.path.slice(0, 200) : null,
      props: cleanProps(e.props),
      attribution: cleanAttribution(e.attribution),
    }));
  if (storageUnavailable()) {
    return NextResponse.json({ stored: false, count: 0 }, { status: 503 });
  }
  const stored = await storeEvents(rows);
  if (rows.length > 0 && !stored && storageMode() !== "demo") {
    return NextResponse.json({ stored: false, count: 0 }, { status: 502 });
  }
  return NextResponse.json({ stored, count: rows.length });
}
