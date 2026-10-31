"use client";

import { ANALYTICS_CONSENT_VERSION, consentChoice, newConsentRecord, type ConsentChoice } from "./consent-record";

/** Optional first-party analytics. No pre-consent storage or retrospective events. */
export type EventName =
  | "page_view"
  | "cta_click"
  | "waitlist_submit_attempt"
  | "waitlist_signup_success"
  | "waitlist_signup_duplicate"
  | "waitlist_signup_error"
  | "survey_completed"
  | "survey_skipped"
  | "faq_open"
  | "section_view"
  | "reserve_click"
  | "reserve_checkout_started"
  | "reserve_error";

type Props = Record<string, string | number | boolean | null>;
export const ANALYTICS_CONSENT_KEY = "analytics-consent";
const ATTR_KEY = "first-touch";
const SESSION_KEY = "cymba-analytics-session-v2";
const ERASURE_PREFIX = "cymba-analytics-withdrawal-v2:";
const LEGACY_KEY = "cymba-analytics-legacy-reference-v1";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ENDPOINT = "/api/events";
export const consentRequired = true;
export type Consent = ConsentChoice;
export type AnalyticsWithdrawalStatus = "idle" | "pending" | "complete" | "unavailable";
let memoryConsent: string | undefined;
let memorySession: string | null = null;
const consentListeners = new Set<() => void>();
const withdrawalListeners = new Set<() => void>();
const pendingErasures = new Set<string>();
const sendingErasures = new Set<string>();
let withdrawalStatus: AnalyticsWithdrawalStatus = "idle";
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let legacyUnverifiable = false;
let durableRetryUnavailable = false;

function browserStorage(name: "localStorage" | "sessionStorage") {
  try { return typeof window === "undefined" ? undefined : window[name]; }
  catch { return undefined; }
}
const ls = () => browserStorage("localStorage");
const ss = () => browserStorage("sessionStorage");
const store = {
  get(key: string, storage: Storage | undefined) {
    try { return storage?.getItem(key) ?? null; } catch { return null; }
  },
  set(key: string, value: string, storage: Storage | undefined): boolean {
    try { if (!storage) return false; storage.setItem(key, value); return true; } catch { return false; }
  },
  remove(key: string, storage: Storage | undefined) {
    try { storage?.removeItem(key); } catch { /* denied storage */ }
  },
};

export function getConsent(): Consent {
  return consentChoice(memoryConsent ?? store.get(ANALYTICS_CONSENT_KEY, ls()), ANALYTICS_CONSENT_VERSION);
}

function publishWithdrawalStatus(status: AnalyticsWithdrawalStatus) {
  if (withdrawalStatus === status) return;
  withdrawalStatus = status;
  for (const listener of withdrawalListeners) listener();
}
export function getAnalyticsWithdrawalStatus(): AnalyticsWithdrawalStatus { return withdrawalStatus; }
export function subscribeAnalyticsWithdrawal(listener: () => void) {
  withdrawalListeners.add(listener);
  return () => { withdrawalListeners.delete(listener); };
}

function readPendingErasures() {
  const storage = ls();
  try {
    if (storage) for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(ERASURE_PREFIX)) {
        const token = key.slice(ERASURE_PREFIX.length);
        if (/^\d{13}\.[a-f0-9]{64}$/.test(token)) pendingErasures.add(token);
      }
    }
  } catch { /* in-memory retry remains available */ }
  legacyUnverifiable ||= Boolean(store.get(LEGACY_KEY, storage));
}

function queueErasure(token: string) {
  pendingErasures.add(token);
  if (!store.set(`${ERASURE_PREFIX}${token}`, "pending", ls())) durableRetryUnavailable = true;
  publishWithdrawalStatus(durableRetryUnavailable ? "unavailable" : "pending");
}

/** Minimal refusal records survive navigation only while erasure is pending. */
export async function retryAnalyticsWithdrawal(): Promise<void> {
  readPendingErasures();
  if (pendingErasures.size) publishWithdrawalStatus(durableRetryUnavailable || legacyUnverifiable ? "unavailable" : "pending");
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  await Promise.all([...pendingErasures].map(async (token) => {
    if (sendingErasures.has(token)) return;
    sendingErasures.add(token);
    try {
      const response = await fetch(`${ENDPOINT}/withdraw`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }), keepalive: true, credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const result: unknown = response.ok ? await response.json() : null;
      if (result && typeof result === "object" && (result as { erased?: unknown }).erased === true) {
        pendingErasures.delete(token);
        store.remove(`${ERASURE_PREFIX}${token}`, ls());
      }
    } catch { /* preserve the capability for an online/next-visit retry */ }
    finally { sendingErasures.delete(token); }
  }));
  if (pendingErasures.size) {
    publishWithdrawalStatus(durableRetryUnavailable || legacyUnverifiable ? "unavailable" : "pending");
    retryTimer = setTimeout(() => { void retryAnalyticsWithdrawal(); }, 30_000);
  } else {
    durableRetryUnavailable = false;
    publishWithdrawalStatus(legacyUnverifiable ? "unavailable" : "complete");
  }
}

function clearPending() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  queue.length = 0;
  const token = memorySession ?? store.get(SESSION_KEY, ss());
  if (token) queueErasure(token);
  memorySession = null;
  store.remove(SESSION_KEY, ss());
  store.remove(ATTR_KEY, ss());
  const legacyId = store.get("sid", ss());
  if (legacyId) {
    // Old low-entropy IDs are not accepted as deletion credentials. Preserve a
    // local reference for support instead of claiming historical erasure.
    legacyUnverifiable = true;
    store.set(LEGACY_KEY, legacyId.slice(0, 64), ls());
    store.remove("sid", ss());
  }
  readPendingErasures();
  if (legacyUnverifiable) publishWithdrawalStatus("unavailable");
  if (pendingErasures.size) void retryAnalyticsWithdrawal();
}

export function setConsent(choice: "granted" | "denied") {
  memoryConsent = newConsentRecord(choice, ANALYTICS_CONSENT_VERSION);
  store.set(ANALYTICS_CONSENT_KEY, memoryConsent, ls());
  if (choice === "denied") clearPending();
  for (const listener of consentListeners) listener();
}

function onConsentStorage(event: StorageEvent) {
  if (event.key === ANALYTICS_CONSENT_KEY || event.key === null) {
    memoryConsent = event.newValue ?? undefined;
    if (getConsent() !== "granted") clearPending();
    for (const listener of consentListeners) listener();
  }
  if (event.key?.startsWith(ERASURE_PREFIX) && event.newValue !== null) {
    readPendingErasures();
    publishWithdrawalStatus(legacyUnverifiable ? "unavailable" : "pending");
  }
}
export function subscribeConsent(listener: () => void) {
  consentListeners.add(listener);
  return () => { consentListeners.delete(listener); };
}

/** Campaign attribution is optional analytics and is never read before consent. */
export function getAttribution(): Record<string, string> {
  if (typeof window === "undefined" || getConsent() !== "granted") return {};
  const saved = store.get(ATTR_KEY, ss());
  if (saved) {
    try { return JSON.parse(saved); } catch { /* recapture the current visit */ }
  }
  const url = new URL(window.location.href);
  const out: Record<string, string> = { landing_path: url.pathname };
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const value = url.searchParams.get(key);
    if (value) out[key] = value;
  }
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.host !== url.host) out.referrer = referrer.host;
    } catch { /* invalid referrer */ }
  }
  store.set(ATTR_KEY, JSON.stringify(out), ss());
  return out;
}

let variant: string | null = null;
export function setVariant(value: string) { variant = value; }
function sessionToken(): string | null {
  let token = memorySession ?? store.get(SESSION_KEY, ss());
  if (token && (!/^\d{13}\.[a-f0-9]{64}$/.test(token) || Date.now() - Number(token.slice(0, 13)) > SESSION_MAX_AGE_MS)) {
    if (/^\d{13}\.[a-f0-9]{64}$/.test(token)) { queueErasure(token); void retryAnalyticsWithdrawal(); }
    token = null;
  }
  if (!token) {
    try {
      const bytes = window.crypto.getRandomValues(new Uint8Array(32));
      token = `${Date.now()}.${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      store.set(SESSION_KEY, token, ss());
    } catch { return null; } // No weak random fallback or anonymous unerasable writes.
  }
  memorySession = token;
  return token;
}

type Queued = { name: EventName; props: Props; path: string };
const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
export function track(name: EventName, props: Props = {}) {
  if (typeof window === "undefined" || getConsent() !== "granted") return;
  queue.push({ name, props, path: window.location.pathname });
  if (queue.length > 50) queue.shift();
  if (timer === null) timer = setTimeout(flush, 800);
}
function flush() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (!queue.length || getConsent() !== "granted") { queue.length = 0; return; }
  const token = sessionToken();
  const batch = queue.splice(0, queue.length);
  if (!token) return;
  const attribution = getAttribution();
  const consent = JSON.parse(memoryConsent ?? store.get(ANALYTICS_CONSENT_KEY, ls()) ?? "null");
  for (let offset = 0; offset < batch.length; offset += 25) {
    const payload = JSON.stringify({ token, consent,
      events: batch.slice(offset, offset + 25).map((event) => ({ ...event, variant, attribution })) });
    let sent = false;
    try { sent = navigator.sendBeacon?.(ENDPOINT, new Blob([payload], { type: "application/json" })) ?? false; }
    catch { /* use fetch */ }
    if (sent) continue;
    try {
      void fetch(ENDPOINT, { method: "POST", body: payload, headers: { "Content-Type": "application/json" },
        keepalive: true, credentials: "same-origin", cache: "no-store" }).catch(() => {});
    } catch { /* analytics never interrupts the requested service */ }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", onConsentStorage);
  window.addEventListener("online", () => { if (pendingErasures.size) void retryAnalyticsWithdrawal(); });
  window.addEventListener("pagehide", () => { flush(); if (pendingErasures.size) void retryAnalyticsWithdrawal(); });
  // Reconcile a previous withdrawal before any new events can be sent. Old
  // unversioned grants need a fresh choice and never silently resume tracking.
  readPendingErasures();
  if (getConsent() !== "granted") clearPending();
  else if (pendingErasures.size) void retryAnalyticsWithdrawal();
}
