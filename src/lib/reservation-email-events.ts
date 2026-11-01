import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.complained", "email.failed", "email.suppressed"]);

/** Svix's documented signature protocol; verify the unchanged body before JSON parsing. */
export function verifyEmailEvent(body: string, headers: Headers, secret: string, now = Date.now()): unknown {
  const id = headers.get("svix-id") ?? "";
  const timestamp = headers.get("svix-timestamp") ?? "";
  const signatures = headers.get("svix-signature") ?? "";
  if (!/^whsec_[A-Za-z0-9+/=]+$/.test(secret) || !id || id.length > 256
    || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300
    || signatures.length > 1024) throw new Error("Invalid email event signature");
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(id + "." + timestamp + "." + body).digest();
  const verified = signatures.split(" ").some(part => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const received = Buffer.from(value, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
  if (!verified) throw new Error("Invalid email event signature");
  return JSON.parse(body);
}

export async function emailEventBody(req: Request): Promise<string> {
  const limit = 64 * 1024;
  if (!req.body || Number(req.headers.get("content-length")) > limit) throw new Error("Invalid email event body");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Email event too large"); }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } finally { reader.releaseLock(); }
}

export async function recordEmailEvent(id: string, value: unknown): Promise<void> {
  const event = value as { type?: string; created_at?: string; data?: { email_id?: string } } | null;
  if (!event || typeof event.type !== "string") throw new Error("Invalid email event");
  if (!EVENTS.has(event.type)) return;
  if (!event.data?.email_id || !UUID.test(event.data.email_id)
    || !event.created_at || !Number.isFinite(Date.parse(event.created_at))) throw new Error("Invalid email event");
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || new URL(url).protocol !== "https:") throw new Error("Email event storage not configured");
  const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/rpc/record_reservation_email_event", {
    method: "POST", headers: { apikey: key, ...(!key.startsWith("sb_secret_") ? { Authorization: "Bearer " + key } : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ p_event_id: id, p_provider_id: event.data.email_id, p_event_type: event.type, p_occurred_at: event.created_at }),
    signal: AbortSignal.timeout(8_000), cache: "no-store", redirect: "manual",
  });
  if (!response.ok || await response.json() !== true) throw new Error("Email event not recorded");
  if (["email.bounced", "email.complained", "email.failed", "email.suppressed"].includes(event.type)) {
    console.error("[reservation email] delivery needs attention", { providerId: event.data.email_id, type: event.type });
  }
}
