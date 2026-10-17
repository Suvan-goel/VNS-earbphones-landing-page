import { NextResponse } from "next/server";
import { storeEvents, type EventRow } from "@/lib/storage";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { cleanAttribution, cleanVariant } from "@/lib/validation";

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
  let body: { events?: Incoming[] };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const rows: EventRow[] = (Array.isArray(body.events) ? body.events : [])
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
  const stored = await storeEvents(rows);
  return NextResponse.json({ stored, count: rows.length });
}
