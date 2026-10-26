import { NextResponse } from "next/server";
import { updatePreviewReservation } from "@/lib/storage";
import { PREVIEW_SESSION_PREFIX, previewMode } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!previewMode()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  // Next can normalize req.url to localhost while the browser uses 127.0.0.1.
  // Host describes the incoming request; internal redirects stay relative.
  const requestOrigin = req.headers.get("origin");
  const opaqueSameOrigin = requestOrigin === "null" && req.headers.get("sec-fetch-site") === "same-origin";
  // Referrer-Policy: no-referrer can make a native form POST's Origin opaque.
  // Accept that only with the browser's same-origin Fetch Metadata signal.
  if (requestOrigin && !opaqueSameOrigin) {
    try {
      const origin = new URL(requestOrigin);
      const host = req.headers.get("host") ?? new URL(req.url).host;
      if (!/^https?:$/.test(origin.protocol) || origin.host !== host) throw new Error("Cross-origin preview");
    } catch { return NextResponse.json({ error: "Invalid origin." }, { status: 403 }); }
  }
  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: "Invalid form." }, { status: 400 }); }
  const sessionId = String(form.get("session_id") ?? "");
  const action = form.get("action");
  if (!sessionId.startsWith(PREVIEW_SESSION_PREFIX) || (action !== "pay" && action !== "cancel")) {
    return NextResponse.json({ error: "Invalid preview." }, { status: 400 });
  }
  if (!await updatePreviewReservation(sessionId, action)) {
    return NextResponse.json({ error: "Preview reservation unavailable." }, { status: 503 });
  }
  return new NextResponse(null, { status: 303, headers: { Location: action === "cancel"
    ? "/reserve?cancelled=1"
    : `/reserve/complete?session_id=${encodeURIComponent(sessionId)}` } });
}
