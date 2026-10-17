"use client";

/**
 * Privacy-conscious analytics.
 *
 *  - Nothing is sent until the visitor allows analytics (when consent is required).
 *  - No cookies. A random per-tab session id lives in sessionStorage only after consent.
 *  - Events go to our own /api/events endpoint, and are mirrored to Plausible or a
 *    GTM-style dataLayer if either is present on the page.
 *  - Waitlist and survey data are saved with the signup itself, independent of this.
 */

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
  | "section_view";

type Props = Record<string, string | number | boolean | null>;

const CONSENT_KEY = "analytics-consent";
const ATTR_KEY = "first-touch";
const REQUIRE_CONSENT = process.env.NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT !== "false";
const ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT ?? "/api/events";

export type Consent = "granted" | "denied" | null;

const store = {
  get(k: string, s: Storage | undefined) {
    try {
      return s?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set(k: string, v: string, s: Storage | undefined) {
    try {
      s?.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
};
const ls = () => (typeof window === "undefined" ? undefined : window.localStorage);
const ss = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

export function getConsent(): Consent {
  if (!REQUIRE_CONSENT) return "granted";
  const v = store.get(CONSENT_KEY, ls());
  return v === "granted" || v === "denied" ? v : null;
}

export function setConsent(v: "granted" | "denied") {
  store.set(CONSENT_KEY, v, ls());
  if (v === "granted") flush();
  else queue.length = 0;
}

export const consentRequired = REQUIRE_CONSENT;

/** First-touch attribution, kept for the tab session so it survives in-page navigation. */
export function getAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const saved = store.get(ATTR_KEY, ss());
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      /* fall through */
    }
  }
  const url = new URL(window.location.href);
  const out: Record<string, string> = { landing_path: url.pathname };
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = url.searchParams.get(k);
    if (v) out[k] = v;
  }
  if (document.referrer) {
    try {
      const r = new URL(document.referrer);
      if (r.host !== url.host) out.referrer = r.host; // host only, never the full URL
    } catch {
      /* ignore */
    }
  }
  store.set(ATTR_KEY, JSON.stringify(out), ss());
  return out;
}

let variant: string | null = null;
export function setVariant(v: string) {
  variant = v;
}

function sessionId(): string {
  let id = store.get("sid", ss());
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    store.set("sid", id, ss());
  }
  return id;
}

type Queued = { name: EventName; props: Props; path: string };
const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

declare global {
  interface Window {
    plausible?: (name: string, opts?: { props?: Props }) => void;
    dataLayer?: unknown[];
  }
}

export function track(name: EventName, props: Props = {}) {
  if (typeof window === "undefined") return;
  const consent = getConsent();
  if (consent === "denied") return;
  queue.push({ name, props, path: window.location.pathname });
  if (queue.length > 50) queue.shift();
  if (consent === "granted") schedule();
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 800);
}

function flush() {
  timer = null;
  if (!queue.length || getConsent() !== "granted") return;
  const batch = queue.splice(0, queue.length);
  const attribution = getAttribution();
  const sid = sessionId();

  for (const e of batch) {
    window.plausible?.(e.name, { props: { ...e.props, variant } });
    window.dataLayer?.push({ event: e.name, ...e.props, variant });
  }

  if (!ENDPOINT || ENDPOINT === "none") return;
  const payload = JSON.stringify({
    events: batch.map((e) => ({ ...e, sessionId: sid, variant, attribution })),
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    /* analytics must never break the page */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
}
