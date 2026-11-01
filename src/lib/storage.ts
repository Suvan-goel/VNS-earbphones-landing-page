import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Attribution, SurveyAnswers } from "./validation";

/**
 * Storage drivers for waitlist signups, survey answers and analytics events.
 *
 *  - "supabase": production. Needs SUPABASE_URL + SUPABASE_SECRET_KEY
 *    (server-only; never exposed to the browser). Schema: supabase/schema.sql.
 *  - "file":     local development only. Set WAITLIST_STORAGE=file to write
 *    JSON files under .data/ (it takes precedence over Supabase in development,
 *    so previews never touch real data). Not for production or serverless.
 *  - "demo":     nothing configured. Nothing is stored and the UI says so.
 */
export type StorageMode = "supabase" | "file" | "demo";

function supabaseConfig() {
  return {
    url: process.env.SUPABASE_URL?.trim(),
    key: process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  };
}

export function storageMode(): StorageMode {
  // Local payment testing also keeps free signups and analytics away from live data.
  if (process.env.RESERVATIONS_LOCAL_TEST === "true") return process.env.NODE_ENV === "production" ? "demo" : "file";
  // An explicit local-file choice wins in development, so a preview never writes to the real database.
  if (process.env.WAITLIST_STORAGE === "file" && process.env.NODE_ENV !== "production") return "file";
  const { url, key } = supabaseConfig();
  if (url && key) return "supabase";
  return "demo";
}

/** Demo is deliberate local development only, never a production fallback. */
export function storageUnavailable(): boolean {
  if (process.env.RESERVATIONS_LOCAL_TEST === "true") return process.env.NODE_ENV === "production";
  const { url, key } = supabaseConfig();
  return !(url && key) && (process.env.NODE_ENV === "production" || Boolean(url || key));
}

const UNAVAILABLE_MESSAGE = "Signups are temporarily unavailable. Please try again later.";

export type SignupInput = {
  email: string;
  researchOptIn: boolean;
  variant: string | null;
  attribution: Attribution;
};

export type SignupResult =
  | { status: "created"; surveyToken: string }
  | { status: "duplicate" }
  | { status: "demo" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export type SurveyResult = { status: "saved" } | { status: "not_found" } | { status: "demo" } | { status: "unavailable"; message: string } | { status: "error"; message: string };

/* ------------------------------- Supabase -------------------------------- */

function sb(pathname: string, init: RequestInit & { prefer?: string } = {}) {
  const config = supabaseConfig();
  const base = config.url!.replace(/\/$/, "");
  const key = config.key!;
  return fetch(`${base}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: key,
      // Modern secret keys are not JWTs; only legacy keys use Bearer auth.
      ...(!key.startsWith("sb_secret_") ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
}

async function databaseError(res: Response): Promise<{ code?: string; message?: string }> {
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const { code, message } = body as Record<string, unknown>;
  return {
    code: typeof code === "string" && /^[A-Z0-9]{5,10}$/.test(code) ? code : undefined,
    message: typeof message === "string" ? message : undefined,
  };
}

/* --------------------------------- File ---------------------------------- */

const DATA_DIR = path.join(process.cwd(), ".data");
type FileRow = Record<string, unknown> & { email: string; survey_token: string | null };

async function readFile<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}
async function writeFile(name: string, data: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

/* -------------------------------- Public --------------------------------- */

export async function createSignup(input: SignupInput): Promise<SignupResult> {
  if (storageUnavailable()) return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
  const mode = storageMode();
  if (mode === "demo") return { status: "demo" };

  const surveyToken = randomUUID();
  const row = {
    email: input.email,
    research_opt_in: input.researchOptIn,
    variant: input.variant,
    utm_source: input.attribution.utm_source ?? null,
    utm_medium: input.attribution.utm_medium ?? null,
    utm_campaign: input.attribution.utm_campaign ?? null,
    utm_term: input.attribution.utm_term ?? null,
    utm_content: input.attribution.utm_content ?? null,
    referrer: input.attribution.referrer ?? null,
    landing_path: input.attribution.landing_path ?? null,
    survey_token: surveyToken,
  };

  if (mode === "file") {
    const rows = await readFile<FileRow[]>("waitlist.json", []);
    if (rows.some((r) => r.email === input.email)) return { status: "duplicate" };
    rows.push({ ...row, id: randomUUID(), created_at: new Date().toISOString() });
    await writeFile("waitlist.json", rows);
    return { status: "created", surveyToken };
  }

  try {
    const res = await sb("waitlist", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
    if (res.status === 201 || res.status === 204) return { status: "created", surveyToken };
    const error = await databaseError(res);
    if (error.code === "23505" && error.message?.includes('unique constraint "waitlist_email_key"')) {
      return { status: "duplicate" };
    }
    console.error("[waitlist] supabase insert failed", { status: res.status, code: error.code });
    return { status: "error", message: "We couldn't save your signup. Please try again." };
  } catch {
    console.error("[waitlist] supabase request failed or timed out");
    return { status: "error", message: "We couldn't reach our server. Please try again." };
  }
}

export async function saveSurvey(token: string, answers: SurveyAnswers): Promise<SurveyResult> {
  if (storageUnavailable()) return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
  const mode = storageMode();
  if (mode === "demo") return { status: "demo" };

  const patch = {
    survey_interest: answers.interest,
    survey_intent: answers.intent,
    survey_price: answers.price,
    survey_role: answers.role,
    survey_concern: answers.concern,
    survey_completed_at: new Date().toISOString(),
    survey_token: null, // one submission per signup
  };

  if (mode === "file") {
    const rows = await readFile<FileRow[]>("waitlist.json", []);
    const row = rows.find((r) => r.survey_token === token);
    if (!row) return { status: "not_found" };
    Object.assign(row, patch);
    await writeFile("waitlist.json", rows);
    return { status: "saved" };
  }

  try {
    const res = await sb(`waitlist?survey_token=eq.${encodeURIComponent(token)}&select=id`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      prefer: "return=representation",
    });
    if (!res.ok) {
      const error = await databaseError(res);
      console.error("[survey] supabase update failed", { status: res.status, code: error.code });
      return { status: "error", message: "We couldn't save your answers. Please try again." };
    }
    const rows = (await res.json()) as unknown[];
    return rows.length ? { status: "saved" } : { status: "not_found" };
  } catch {
    console.error("[survey] supabase request failed or timed out");
    return { status: "error", message: "We couldn't reach our server. Please try again." };
  }
}

export type EventRow = {
  name: string;
  session_id: string | null;
  variant: string | null;
  path: string | null;
  props: Record<string, string | number | boolean | null>;
  attribution: Attribution;
};

const ANALYTICS_WITHDRAWN = "analytics_withdrawn";
let eventFileQueue: Promise<unknown> = Promise.resolve();

/** Local file storage is development-only and single-process. Every analytics
 * mutation shares this queue so a stale write cannot restore erased records. */
function withEventFileLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = eventFileQueue.then(operation);
  eventFileQueue = result.catch(() => {});
  return result;
}

export async function withdrawAnalyticsSession(sessionHash: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(sessionHash) || storageUnavailable()) return false;
  const mode = storageMode();
  if (mode === "demo") return true;
  if (mode === "file") return withEventFileLock(async () => {
    const rows = await readFile<EventRow[]>("events.json", []);
    const remaining = rows.filter((row) => row.session_id !== sessionHash || row.name === ANALYTICS_WITHDRAWN);
    if (!remaining.some((row) => row.session_id === sessionHash && row.name === ANALYTICS_WITHDRAWN)) {
      remaining.push({ name: ANALYTICS_WITHDRAWN, session_id: sessionHash, variant: null, path: null, props: {}, attribution: {} });
    }
    await writeFile("events.json", remaining);
    return true;
  }).catch(() => false);
  try {
    const response = await sb("rpc/withdraw_analytics_session", {
      method: "POST", body: JSON.stringify({ p_session_hash: sessionHash }),
    });
    return response.ok && await response.json() === true;
  } catch { return false; }
}

/** Ingest and withdrawal use the same database transaction lock. A missing RPC
 * fails closed; there is deliberately no direct-insert or best-effort fallback. */
export async function storeConsentedEvents(sessionHash: string, events: EventRow[]): Promise<"stored" | "withdrawn" | "failed" | "demo"> {
  if (!/^[a-f0-9]{64}$/.test(sessionHash) || storageUnavailable()) return "failed";
  const mode = storageMode();
  if (mode === "demo") return "demo";
  if (mode === "file") return withEventFileLock(async () => {
    const rows = await readFile<(EventRow & { created_at?: string })[]>("events.json", []);
    if (rows.some((row) => row.session_id === sessionHash && row.name === ANALYTICS_WITHDRAWN)) return "withdrawn" as const;
    rows.push(...events.map((event) => ({ ...event, session_id: sessionHash, created_at: new Date().toISOString() })));
    await writeFile("events.json", rows);
    return "stored" as const;
  }).catch(() => "failed" as const);
  try {
    const response = await sb("rpc/ingest_consented_analytics", {
      method: "POST", body: JSON.stringify({ p_session_hash: sessionHash, p_events: events }),
    });
    if (!response.ok) return "failed";
    const result: unknown = await response.json();
    return result === "stored" || result === "withdrawn" ? result : "failed";
  } catch { return "failed"; }
}

/* ----------------------------- Reservations ------------------------------ */

export function reservationStorageMode(): StorageMode | "local" {
  if (process.env.RESERVATIONS_LOCAL_TEST === "true") {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    // Never fall through to Supabase for a misconfigured local test environment.
    return process.env.NODE_ENV !== "production" && (!key || /^(?:[sr]k|rkcs)_test_/.test(key)) ? "local" : "demo";
  }
  return storageMode();
}

export type ReservationStatus = "pending" | "processing" | "paid" | "partially_refunded" | "refunded" | "refund_review" | "expired" | "failed";

export type ReservationInput = {
  attemptId: string;
  email: string;
  variant: string | null;
  attribution: Attribution;
  amount: number;
  currency: string;
  termsVersion: string;
  livemode: boolean;
};

export type ReservationRow = {
  id: string;
  attempt_id: string;
  created_at: string;
  email: string;
  variant: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  stripe_customer: string | null;
  checkout_expires_at: string | null;
  amount: number;
  currency: string;
  amount_refunded: number;
  status: ReservationStatus;
  founder_number: number | null;
  /** Qualification order is separate from the public reservation reference. */
  founder_position?: number | null;
  paid_at: string | null;
  refunded_at: string | null;
  terms_version: string;
  terms_accepted_at: string;
  livemode: boolean;
};

export type ReservationLookup =
  | { status: "found"; reservation: ReservationRow }
  | { status: "not_found" }
  | { status: "unavailable" };

export type ReservationWrite =
  | { status: "ready"; reservation: ReservationRow }
  | { status: "conflict" }
  | { status: "unavailable" };

// File storage is only a local preview. Serialize its mutations within this process.
let reservationFileQueue: Promise<unknown> = Promise.resolve();
function withReservationFile<T>(run: () => Promise<T>): Promise<T> {
  const next = reservationFileQueue.then(run, run);
  reservationFileQueue = next.catch(() => undefined);
  return next;
}

async function writeReservations(rows: ReservationRow[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temp = path.join(DATA_DIR, `reservations-${randomUUID()}.tmp`);
  await fs.writeFile(temp, JSON.stringify(rows, null, 2));
  await fs.rename(temp, path.join(DATA_DIR, "reservations.json"));
}

async function lookupReservationWhere(field: "stripe_session_id" | "id" | "attempt_id", value: string): Promise<ReservationLookup> {
  const mode = reservationStorageMode();
  if (mode === "demo" || storageUnavailable()) return { status: "unavailable" };
  if (mode === "local") {
    try {
      const { lookupLocalReservation } = await import("./local-reservations");
      const row = await lookupLocalReservation(field, value);
      return row ? { status: "found", reservation: row } : { status: "not_found" };
    } catch {
      console.error("[reserve] local database unavailable");
      return { status: "unavailable" };
    }
  }
  if (mode === "file") {
    const rows = await readFile<ReservationRow[]>("reservations.json", []);
    const row = rows.find((r) => r[field] === value);
    return row ? { status: "found", reservation: row } : { status: "not_found" };
  }
  try {
    const res = await sb(`reservations?${field}=eq.${encodeURIComponent(value)}&select=*&limit=1`);
    if (!res.ok) return { status: "unavailable" };
    const row = ((await res.json()) as ReservationRow[])[0];
    return row ? { status: "found", reservation: row } : { status: "not_found" };
  } catch {
    return { status: "unavailable" };
  }
}

export const lookupReservation = (sessionId: string) => lookupReservationWhere("stripe_session_id", sessionId);
export const lookupReservationById = (id: string) => lookupReservationWhere("id", id);

/** Compatibility helper for the local preview; real confirmations use the explicit lookup result. */
export async function getReservation(sessionId: string): Promise<ReservationRow | null> {
  const result = await lookupReservation(sessionId);
  return result.status === "found" ? result.reservation : null;
}

/** Persist consent and a stable attempt before any payment session can exist. */
export async function createReservation(input: ReservationInput): Promise<ReservationWrite> {
  const mode = reservationStorageMode();
  if (mode === "demo" || storageUnavailable()) return { status: "unavailable" };
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    attempt_id: input.attemptId,
    created_at: now,
    email: input.email,
    variant: input.variant,
    stripe_session_id: null,
    stripe_payment_intent: null,
    stripe_customer: null,
    checkout_expires_at: null,
    amount: input.amount,
    currency: input.currency,
    amount_refunded: 0,
    status: "pending" as const,
    founder_number: null,
    paid_at: null,
    refunded_at: null,
    terms_version: input.termsVersion,
    terms_accepted_at: now,
    livemode: input.livemode,
    utm_source: input.attribution.utm_source ?? null,
    utm_medium: input.attribution.utm_medium ?? null,
    utm_campaign: input.attribution.utm_campaign ?? null,
    utm_term: input.attribution.utm_term ?? null,
    utm_content: input.attribution.utm_content ?? null,
    referrer: input.attribution.referrer ?? null,
    landing_path: input.attribution.landing_path ?? null,
  };
  const ready = (saved: ReservationRow): ReservationWrite => {
    // An attempt cannot silently be reused for a different buyer or offer.
    if (saved.email !== input.email || saved.amount !== input.amount || saved.currency !== input.currency
      || saved.terms_version !== input.termsVersion || saved.livemode !== input.livemode) return { status: "conflict" };
    return { status: "ready", reservation: saved };
  };
  if (mode === "local") {
    try {
      const { createLocalReservation } = await import("./local-reservations");
      return ready(await createLocalReservation(row));
    } catch {
      console.error("[reserve] local attempt storage unavailable");
      return { status: "unavailable" };
    }
  }
  if (mode === "file") {
    return withReservationFile(async () => {
      const rows = await readFile<ReservationRow[]>("reservations.json", []);
      const existing = rows.find((r) => r.attempt_id === input.attemptId);
      if (existing) return ready(existing);
      rows.push(row);
      await writeReservations(rows);
      return ready(row);
    });
  }
  try {
    const res = await sb("reservations?on_conflict=attempt_id", {
      method: "POST", body: JSON.stringify(row), prefer: "resolution=ignore-duplicates,return=representation",
    });
    if (!res.ok) {
      const error = await databaseError(res);
      console.error("[reserve] attempt insert failed", { status: res.status, code: error.code });
      return { status: "unavailable" };
    }
    const inserted = ((await res.json()) as ReservationRow[])[0];
    if (inserted) return ready(inserted);
    const existing = await lookupReservationWhere("attempt_id", input.attemptId);
    return existing.status === "found" ? ready(existing.reservation) : { status: "unavailable" };
  } catch {
    console.error("[reserve] attempt storage unavailable");
    return { status: "unavailable" };
  }
}

/** Attach the idempotently-created session without replacing an existing session. */
export async function attachReservationSession(id: string, sessionId: string, expiresAt: number): Promise<boolean> {
  const mode = reservationStorageMode();
  if (mode === "demo" || storageUnavailable()) return false;
  if (mode === "local") {
    try {
      const { attachLocalReservationSession } = await import("./local-reservations");
      return await attachLocalReservationSession(id, sessionId, expiresAt);
    } catch {
      console.error("[reserve] local checkout storage unavailable");
      return false;
    }
  }
  const patch = { stripe_session_id: sessionId, checkout_expires_at: new Date(expiresAt * 1000).toISOString() };
  if (mode === "file") {
    return withReservationFile(async () => {
      const rows = await readFile<ReservationRow[]>("reservations.json", []);
      const row = rows.find((r) => r.id === id);
      if (!row || (row.stripe_session_id && row.stripe_session_id !== sessionId)) return false;
      Object.assign(row, patch);
      await writeReservations(rows);
      return true;
    });
  }
  try {
    const res = await sb(`reservations?id=eq.${encodeURIComponent(id)}&stripe_session_id=is.null&select=id`, {
      method: "PATCH", body: JSON.stringify(patch), prefer: "return=representation",
    });
    if (!res.ok) return false;
    if (((await res.json()) as unknown[]).length) return true;
    const found = await lookupReservationById(id);
    return found.status === "found" && found.reservation.stripe_session_id === sessionId;
  } catch {
    return false;
  }
}

export type ReservationEvent = {
  eventId: string;
  eventType: string;
  reservationId: string;
  attemptId: string;
  termsVersion: string;
  sessionId: string | null;
  paymentIntent: string | null;
  customer: string | null;
  status: ReservationStatus;
  amount: number;
  currency: string;
  amountRefunded: number;
  livemode: boolean;
  occurredAt: string;
};
export type ReservationEventResult = "applied" | "duplicate" | "not_found" | "mismatch" | "unavailable";

/** The RPC commits the state change and event receipt in one database transaction. */
export async function applyReservationEvent(event: ReservationEvent): Promise<ReservationEventResult> {
  const mode = reservationStorageMode();
  if (mode === "local") {
    try {
      const { applyLocalReservationEvent } = await import("./local-reservations");
      return await applyLocalReservationEvent(event);
    } catch {
      console.error("[reserve] local event transaction unavailable");
      return "unavailable";
    }
  }
  if (mode !== "supabase" || storageUnavailable()) return "unavailable";
  try {
    const res = await sb("rpc/apply_reservation_event", {
      method: "POST",
      body: JSON.stringify({
        p_event_id: event.eventId, p_event_type: event.eventType,
        p_reservation_id: event.reservationId, p_attempt_id: event.attemptId,
        p_terms_version: event.termsVersion, p_session_id: event.sessionId,
        p_payment_intent: event.paymentIntent, p_customer: event.customer,
        p_status: event.status, p_amount: event.amount, p_currency: event.currency,
        p_amount_refunded: event.amountRefunded, p_livemode: event.livemode,
        p_occurred_at: event.occurredAt,
      }),
    });
    if (!res.ok) {
      console.error("[reserve] event transaction failed", { status: res.status });
      return "unavailable";
    }
    const result: unknown = await res.json();
    return result === "applied" || result === "duplicate" || result === "not_found" || result === "mismatch" ? result : "unavailable";
  } catch {
    console.error("[reserve] event storage unavailable");
    return "unavailable";
  }
}

/** Fake payments are deliberately restricted to the local file preview. */
export async function updatePreviewReservation(sessionId: string, action: "pay" | "cancel"): Promise<boolean> {
  if (process.env.RESERVATIONS_LOCAL_TEST === "true" || storageMode() !== "file" || process.env.NODE_ENV === "production" || process.env.RESERVATIONS_PREVIEW !== "true"
    || !sessionId.startsWith("cs_preview_")) return false;
  return withReservationFile(async () => {
    const rows = await readFile<ReservationRow[]>("reservations.json", []);
    const row = rows.find((r) => r.stripe_session_id === sessionId);
    if (!row) return false;
    if (row.status !== "pending") return true;
    if (action === "cancel") row.status = "expired";
    else {
      row.status = "paid";
      const position = rows.reduce((last, r) => Math.max(last, r.founder_position ?? r.founder_number ?? 0), 0) + 1;
      row.founder_number = rows.reduce((last, r) => Math.max(last, r.founder_number ?? 0), 15) + 1;
      row.founder_position = position;
      row.paid_at = new Date().toISOString();
      row.stripe_payment_intent = `pi_preview_${row.id}`;
    }
    await writeReservations(rows);
    return true;
  });
}
