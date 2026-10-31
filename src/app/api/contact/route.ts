import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/request-json";
import { normaliseEmail } from "@/lib/validation";

export const runtime = "nodejs";

const RECIPIENT = "support@trycymba.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_FILL_MS = 1200;
const WINDOW_MS = 10 * 60 * 1000;
const UNAVAILABLE = "We couldn't send your message right now. Please try again, or email support@trycymba.com.";

function error(status: number, message: string, retryAfter?: number) {
  return Response.json({ status: "error", message }, {
    status,
    headers: { "Cache-Control": "private, no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
}

function siteOrigin(): string | null {
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    return ["http:", "https:"].includes(site.protocol) && !site.username && !site.password ? site.origin : null;
  } catch {
    return null;
  }
}

function validOrigin(req: Request, configuredOrigin: string | null) {
  const origin = req.headers.get("origin");
  if (!origin || req.headers.get("sec-fetch-site") === "cross-site") return false;
  if (configuredOrigin && origin === configuredOrigin) return true;
  if (process.env.NODE_ENV === "production") return false;
  try {
    const local = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(local.hostname)
      && ["http:", "https:"].includes(local.protocol)
      && origin === local.origin
      && origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function senderAddress(): string | null {
  const sender = process.env.CONTACT_EMAIL_FROM?.trim();
  if (!sender || sender.length > 320 || /[\r\n]/.test(sender)) return null;
  const match = sender.match(/^(?:[^<>]+ <([^<>]+)>|([^<>]+))$/);
  const email = match?.[1] ?? match?.[2];
  return email && !/[,;<>]/.test(email) && normaliseEmail(email) ? sender : null;
}

async function idempotencyKey(submissionId: string, payload: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([submissionId.toLowerCase(), payload])));
  return `contact/${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function POST(req: Request) {
  const configuredOrigin = siteOrigin();
  if (!validOrigin(req, configuredOrigin)) {
    return error(403, "Please send your message using the contact form on trycymba.com.");
  }

  // Sites runs behind Cloudflare, which sets this header. Keep this local to
  // contact delivery; the shared limiter remains best-effort per server instance.
  const ip = req.headers.get("cf-connecting-ip")?.trim() || clientKey(req);
  if (!rateLimit(`contact:${ip.slice(0, 200)}`, 5, WINDOW_MS)) {
    return error(429, "Too many attempts. Please wait a few minutes and try again, or email support@trycymba.com.", WINDOW_MS / 1000);
  }

  const parsed = await readJsonObject(req, 24 * 1024);
  if (parsed.response) {
    parsed.response.headers.set("Cache-Control", "private, no-store");
    return parsed.response;
  }
  const { body } = parsed;
  // The browser measures elapsed time with its monotonic clock. Comparing a
  // browser timestamp with the server clock would reject visitors with clock skew.
  const elapsedMs = body.elapsedMs;
  if ((body.company !== undefined && body.company !== "")
    || typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < MIN_FILL_MS) {
    return error(400, "We couldn't verify that submission. Please try again.");
  }

  const email = normaliseEmail(body.email);
  if (!email || typeof body.email !== "string" || body.email.length > 254 || /[,;<>]/.test(email)) {
    return error(422, "Please enter a valid email address.");
  }
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 100 || /[\r\n\u0000]/.test(body.name))) {
    return error(422, "Please keep your name to 100 characters or fewer.");
  }
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 5000 || body.message.includes("\u0000")) {
    return error(422, "Please enter a message of 5,000 characters or fewer.");
  }
  if (typeof body.submissionId !== "string" || !UUID.test(body.submissionId)) {
    return error(400, "Please refresh the page and try again.");
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = senderAddress();
  if (!apiKey || /[\r\n]/.test(apiKey) || !from || (process.env.NODE_ENV === "production" && !configuredOrigin)) {
    return error(503, UNAVAILABLE);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const payload = JSON.stringify({
    from,
    to: [RECIPIENT],
    subject: "New cymba contact message",
    reply_to: email,
    text: `Name: ${name || "Not provided"}\nEmail: ${email}\n\n${body.message.trim()}`,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": await idempotencyKey(body.submissionId, payload),
      },
      body: payload,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
      // Workers supports manual/follow only. Keep credentials on the fixed host;
      // any redirect is a non-success response and is rejected below.
      redirect: "manual",
    });
    if (!response.ok) {
      if (response.status === 429) return error(429, "We're receiving a lot of messages. Please wait a minute and try again, or email support@trycymba.com.", 60);
      return error(response.status === 401 || response.status === 403 || response.status >= 500 ? 503 : 502, UNAVAILABLE);
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !UUID.test(result.id)) {
      return error(502, UNAVAILABLE);
    }
    return Response.json({ status: "sent" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Do not log user messages, email addresses, credentials or provider bodies.
    // Retrying the unchanged submission uses the same provider idempotency key.
    return error(502, UNAVAILABLE);
  }
}
