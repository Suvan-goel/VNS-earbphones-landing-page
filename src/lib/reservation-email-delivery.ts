import "server-only";
import { randomUUID } from "node:crypto";
import { reservationEmail, type ReservationEmailJob, type ReservationEmail } from "./reservation-email-template";
import { processingPaymentStillPending } from "./reservation-processing-payment";

const SUPPORT = "support@trycymba.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PROCESSING_EMAIL_DELAY_MS = 2 * 60_000;

function deliveryConfig() {
  if (process.env.RESERVATION_EMAILS_ENABLED !== "true"
    || process.env.NODE_ENV !== "production"
    || process.env.RESERVATIONS_LOCAL_TEST === "true"
    || process.env.RESERVATIONS_PREVIEW === "true") return null;
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESERVATION_EMAIL_FROM?.trim();
  const url = process.env.SUPABASE_URL?.trim();
  const dbKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  // Only the verified cymba domain is accepted; never silently use Resend's test sender.
  if (!key || /[\r\n]/.test(key) || !from || /[\r\n]/.test(from)
    || !/^(?:cymba <)?[A-Za-z0-9._%+-]+@(?:[a-z0-9-]+\.)*trycymba\.com>?$/.test(from)
    || (from.startsWith("cymba <") !== from.endsWith(">"))
    || !url || !dbKey) throw new Error("Reservation email configuration incomplete");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Invalid email storage configuration");
  return { key, from, url: url.replace(/\/$/, ""), dbKey };
}

function emailDatabase(config: NonNullable<ReturnType<typeof deliveryConfig>>) {
  return async (path: string, body?: unknown) => {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { apikey: config.dbKey, ...(!config.dbKey.startsWith("sb_secret_") ? { Authorization: `Bearer ${config.dbKey}` } : {}), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8_000), cache: "no-store", redirect: "manual",
    });
    // Workers supports manual redirects; a redirect response is rejected here.
    if (!response.ok) throw new Error("Email delivery storage unavailable");
    return response.json();
  };
}

/** Runs only after the payment transaction commits, including duplicate webhook retries. */
export async function deliverReservationEmails(reservationId: string, livemode: boolean): Promise<void> {
  if (!livemode) return;
  const config = deliveryConfig();
  if (!config) return;
  if (!UUID.test(reservationId)) throw new Error("Invalid email reservation reference");
  const database = emailDatabase(config);
  const result: unknown = await database(`reservation_email_outbox?reservation_id=eq.${reservationId}&state=in.(pending,sending)&order=created_at.asc,id.asc&limit=10`);
  if (!Array.isArray(result)) throw new Error("Invalid email queue response");
  const jobs = result as ReservationEmailJob[];
  for (const job of jobs) {
    if (!UUID.test(job.id) || job.reservation_id !== reservationId || job.snapshot.id !== reservationId
      || job.snapshot.livemode !== true || job.snapshot.status !== job.kind
      || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(job.snapshot.email)) {
      throw new Error("Invalid reservation email snapshot");
    }
    if (job.kind === "processing") {
      const created = Date.parse(job.created_at);
      if (!Number.isFinite(created)) throw new Error("Invalid processing email date");
      // Do not hold a webhook open or depend on another Stripe event to wake us.
      if (Date.now() < created + PROCESSING_EMAIL_DELAY_MS) continue;
      if (!await processingPaymentStillPending(job.snapshot)) {
        const skipped = await database("rpc/suppress_reservation_processing_email", { p_id: job.id });
        if (skipped !== true) throw new Error("Processing email suppression not committed");
        continue;
      }
    }
    const token = randomUUID();
    const payload = { from: config.from, to: [job.snapshot.email], reply_to: SUPPORT, ...reservationEmail(job) };
    const claimed = await database("rpc/claim_reservation_email", { p_id: job.id, p_payload: payload, p_token: token }) as {
      state?: string; lease_token?: string; payload?: typeof payload;
    } | null;
    if (claimed?.state === "needs_review") {
      // Acceptance may have succeeded without our final write. Do not resend after
      // the provider's deduplication window; reconcile in Resend before resolving.
      console.error("[reservation email] delivery needs review", { emailId: job.id });
      continue;
    }
    // The reservation may have advanced while Stripe was being read, or this
    // worker's clock may be ahead of the authoritative database clock.
    if (claimed?.state === "superseded" || claimed?.state === "deferred") continue;
    if (!claimed || claimed.state !== "sending" || claimed.lease_token !== token || !claimed.payload) {
      throw new Error("Email delivery is already in progress");
    }
    // A frozen retry must never redirect a receipt or send preview content.
    const frozen = claimed.payload;
    if (frozen.to?.length !== 1 || frozen.to[0] !== job.snapshot.email
      || frozen.reply_to !== SUPPORT || !/^(?:cymba <)?[A-Za-z0-9._%+-]+@trycymba\.com>?$/.test(frozen.from ?? "")
      || typeof frozen.subject !== "string" || typeof frozen.text !== "string" || typeof frozen.html !== "string"
      || /\[test\]|design preview|DEMO-|TEST EMAIL|TEST \/ PREVIEW/i.test([frozen.subject, frozen.text, frozen.html].join("\n"))) {
      throw new Error("Invalid production email payload");
    }
    const providerId = await sendReservationEmailPayload(claimed.payload, config.key, `reservation/${job.id}`);
    const committed = await database("rpc/finish_reservation_email", { p_id: job.id, p_token: token, p_provider_id: providerId });
    if (committed !== true) throw new Error("Email acknowledgement not committed");
  }
  if (jobs.length === 10) throw new Error("More reservation emails remain queued");
}

/** Called by the authenticated database scheduler, independently of visitors. */
export async function deliverDueReservationEmails(): Promise<{ checked: number; failed: number }> {
  const config = deliveryConfig();
  if (!config) return { checked: 0, failed: 0 };
  const now = new Date().toISOString();
  const before = new Date(Date.now() - PROCESSING_EMAIL_DELAY_MS).toISOString();
  const jobs: unknown = await emailDatabase(config)(`reservation_email_outbox?select=reservation_id&state=in.(pending,sending)&and=(or(kind.neq.processing,created_at.lte.${before}),or(lease_until.is.null,lease_until.lt.${now}))&order=created_at.asc,id.asc&limit=20`);
  if (!Array.isArray(jobs)) throw new Error("Invalid reservation email queue");
  const ids = [...new Set(jobs.map(job => job.reservation_id))].slice(0, 5);
  let failed = 0;
  let checked = 0;
  const started = Date.now();
  // A failed payment lookup must remain queued, without blocking other customers.
  for (const id of ids) {
    if (Date.now() - started > 30_000) break; // Remaining durable work is picked up next minute.
    checked++;
    try { await deliverReservationEmails(id, true); }
    catch { failed++; console.error("[reservation email] delayed delivery incomplete"); }
  }
  return { checked, failed };
}

/** Send the exact frozen payload using the provider idempotency key. */
export async function sendReservationEmailPayload(
  payload: ReservationEmail & { from: string; to: string[]; reply_to: string },
  key: string,
  idempotencyKey: string,
): Promise<string> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000), cache: "no-store", redirect: "manual",
  });
  // Workers supports manual redirects; neither credentials nor payload follow a redirect.
  if (!response.ok) throw new Error("Email provider unavailable");
  const sent: unknown = await response.json();
  if (!sent || typeof sent !== "object" || !("id" in sent) || typeof sent.id !== "string" || !UUID.test(sent.id)) {
    throw new Error("Email provider acknowledgement unavailable");
  }
  return sent.id;
}
