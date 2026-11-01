"use client";

import { ADVERTISING_CONSENT_VERSION, consentChoice, newConsentRecord } from "./consent-record";

// Marketing permission is separate from first-party analytics permission.
export const MARKETING_CONSENT_KEY = "cymba-marketing-consent-v1";
export type MarketingConsent = "granted" | "denied" | null;

const configuredId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
const PIXEL_ID = /^[1-9]\d*$/.test(configuredId) ? configuredId : "";
const LEAD_ENABLED = process.env.NEXT_PUBLIC_META_LEAD_TRACKING_ENABLED === "true";
const PURCHASE_ENABLED = process.env.NEXT_PUBLIC_META_PURCHASE_TRACKING_ENABLED === "true";
const ALLOWED_ORIGINS = new Set(["https://trycymba.com", "https://www.trycymba.com"]);
const ALLOWED_PATHS = new Set(["/", "/reserve", "/reserve/complete"]);
const PRIVATE_QUERY_KEYS = /^(?:session_id|checkout_session_id|client_secret|payment_intent_client_secret|token|survey_token|surveyToken|email)$/i;
const PURCHASE_HISTORY_KEY = `cymba-meta-purchases-v1:${PIXEL_ID}`;
const NAVIGATION_WAIT_MS = 800;
const LEAD_PENDING_MS = 10_000;
const DISPATCH_GRACE_MS = 150;

type PixelCommand = unknown[];
type Pixel = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: PixelCommand[];
  push?: Pixel;
  loaded?: boolean;
  version?: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Pixel;
    _fbq?: Pixel;
  }
}

export type MetaPurchase = { eventId: string; value: number; currency: string };
export type MetaLeadOptions = { continuationPath?: "/reserve" };
type PendingEvent = {
  name: "PageView" | "Lead" | "Purchase";
  path: string;
  origin?: string;
  continuationPath?: "/reserve";
  purchase?: MetaPurchase;
  finish?: (dispatched: boolean) => void;
};
let memoryConsent: string | undefined;
let library: "idle" | "loading" | "ready" | "failed" = "idle";
let initialized = false;
let pending: PendingEvent[] = [];
const pageViewsSent = new Set<string>();
const observedLeadResponses = new WeakSet<object>();
const observedPurchases = new Set<string>();
const listeners = new Set<() => void>();

export function isMetaPixelConfigured() {
  return Boolean(PIXEL_ID);
}

// Conversions are explicitly enabled per deployment; Meta applies dataset restrictions.
export function isMetaLeadTrackingEnabled() {
  return isMetaPixelConfigured() && LEAD_ENABLED;
}

export function isMetaPurchaseTrackingEnabled() {
  return isMetaPixelConfigured() && PURCHASE_ENABLED;
}

function parseConsent(value: string | null): MarketingConsent {
  return consentChoice(value, ADVERTISING_CONSENT_VERSION);
}

export function getMarketingConsent(): MarketingConsent {
  if (typeof window === "undefined") return null;
  if (memoryConsent !== undefined) return parseConsent(memoryConsent);
  try {
    return parseConsent(window.localStorage.getItem(MARKETING_CONSENT_KEY));
  } catch {
    return null;
  }
}

function removeMarketingCookies() {
  if (typeof document === "undefined") return;
  const domains = [""];
  const parts = window.location.hostname.split(".");
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; Domain=${parts.slice(i).join(".")}`);
  for (const name of ["_fbp", "_fbc"]) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${domain}; SameSite=Lax`;
    }
  }
  try { window.localStorage.removeItem(PURCHASE_HISTORY_KEY); }
  catch { /* unavailable browser storage */ }
}

function dropPending() {
  const dropped = pending;
  pending = [];
  for (const event of dropped) event.finish?.(false);
}

function revoke() {
  dropPending();
  try {
    const pixel = window.fbq;
    // No pending initialization or event may survive withdrawal during SDK loading.
    if (pixel && !pixel.callMethod) pixel.queue = [];
    pixel?.("consent", "revoke");
    removeMarketingCookies();
  } catch {
    // Tracking controls must never interrupt the site or its signup flow.
  }
}

export function setMarketingConsent(choice: "granted" | "denied") {
  memoryConsent = newConsentRecord(choice, ADVERTISING_CONSENT_VERSION);
  try {
    window.localStorage.setItem(MARKETING_CONSENT_KEY, memoryConsent);
  } catch {
    // The visitor's choice still applies for this page when storage is unavailable.
  }
  if (choice === "denied") revoke();
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== MARKETING_CONSENT_KEY && event.key !== null) return;
  memoryConsent = event.newValue ?? undefined;
  if (getMarketingConsent() !== "granted") revoke();
  for (const listener of listeners) listener();
}

export function subscribeMarketingConsent(listener: () => void) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

function permitted() {
  if (typeof window === "undefined" || !isMetaPixelConfigured() || getMarketingConsent() !== "granted") return false;
  const location = window.location;
  if (!ALLOWED_ORIGINS.has(location.origin) || !ALLOWED_PATHS.has(location.pathname)) return false;
  // The SDK includes the page URL itself. Never initialize it on a receipt URL
  // containing a Stripe session reference or another form/access credential.
  return !Array.from(new URLSearchParams(location.search).keys()).some((key) => PRIVATE_QUERY_KEYS.test(key));
}

/** Only carry the current consented ad click ID into the public signup continuation. */
export function getMetaClickIdForReservation(): string | null {
  if (!permitted() || window.location.pathname !== "/") return null;
  const values = new URLSearchParams(window.location.search).getAll("fbclid");
  return values.length === 1 && /^[A-Za-z0-9_-]{1,512}$/.test(values[0]) ? values[0] : null;
}

function matchesCurrentLocation(event: PendingEvent) {
  if (event.origin && event.origin !== window.location.origin) return false;
  return event.path === window.location.pathname
    || (event.name === "Lead" && event.continuationPath === "/reserve" && window.location.pathname === "/reserve");
}

function discardEventsOutsideCurrentLocation() {
  const previous = pending;
  pending = previous.filter(matchesCurrentLocation);
  for (const event of previous) {
    if (!pending.includes(event)) event.finish?.(false);
  }
}

function purchaseHistory(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PURCHASE_HISTORY_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{64}$/.test(id)).slice(-100) : [];
  } catch {
    return [];
  }
}

function rememberPurchase(eventId: string) {
  try {
    const previous = purchaseHistory().filter((id) => id !== eventId);
    window.localStorage.setItem(PURCHASE_HISTORY_KEY, JSON.stringify([...previous, eventId].slice(-100)));
  } catch {
    // The in-memory guard and stable Meta event ID still prevent ordinary repeats.
  }
}

function flush() {
  if (library !== "ready" || !permitted()) {
    dropPending();
    return;
  }
  const events = pending;
  pending = [];
  try {
    const pixel = window.fbq;
    if (!pixel?.callMethod) {
      for (const event of events) event.finish?.(false);
      return;
    }
    pixel("consent", "grant");
    if (!initialized) {
      pixel("set", "autoConfig", false, PIXEL_ID);
      // No advanced-matching/customer fields. Meta-side automatic matching/events
      // must also remain off before this integration is enabled.
      pixel("init", PIXEL_ID);
      initialized = true;
    }
    for (const event of events) {
      if (!permitted() || !matchesCurrentLocation(event)) {
        event.finish?.(false);
        continue;
      }
      if (event.name === "PageView") {
        if (pageViewsSent.has(event.path)) continue;
        pixel("trackSingle", PIXEL_ID, "PageView");
        pageViewsSent.add(event.path);
      } else if (event.name === "Purchase" && event.purchase) {
        const { eventId, value, currency } = event.purchase;
        if (purchaseHistory().includes(eventId)) continue;
        pixel("trackSingle", PIXEL_ID, "Purchase", { value, currency }, { eventID: eventId });
        rememberPurchase(eventId);
      } else if (event.name === "Lead") {
        // Never send email, survey answers, survey tokens or checkout references.
        pixel("trackSingle", PIXEL_ID, "Lead");
      }
      event.finish?.(true);
    }
  } catch {
    for (const event of events) event.finish?.(false);
    dropPending();
  }
}

function loadLibrary() {
  if (library === "ready") return flush();
  if (library !== "idle" || !permitted()) return;
  library = "loading";
  // A restored document must never replay conversions from before it was left.
  window.addEventListener("pagehide", dropPending);
  try {
    if (!window.fbq) {
      const pixel: Pixel = Object.assign(function (...args: unknown[]) {
        if (pixel.callMethod) pixel.callMethod(...args);
        else pixel.queue.push(args);
      }, { queue: [] as PixelCommand[], loaded: true, version: "2.0" });
      pixel.push = pixel;
      window.fbq = pixel;
      window._fbq = pixel;
    }
    // Route changes are measured explicitly; never let SDK history listeners
    // expose the completion page's private query string or untracked pages.
    window.fbq.disablePushState = true;
    window.fbq("consent", "revoke");
    const script = document.createElement("script");
    script.id = "cymba-meta-pixel";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.onload = () => {
      library = "ready";
      flush();
    };
    script.onerror = () => {
      library = "failed";
      dropPending();
    };
    document.head.appendChild(script);
  } catch {
    library = "failed";
    dropPending();
  }
}

export function trackMetaPageView() {
  if (!permitted()) {
    dropPending();
    return;
  }
  discardEventsOutsideCurrentLocation();
  const path = window.location.pathname;
  if (library === "failed") return;
  if (pageViewsSent.has(path)) {
    // Consent may have been revoked since this page was measured. Resume the
    // loaded SDK after a new grant without counting the same view again.
    if (library === "ready") flush();
    return;
  }
  if (pending.some((event) => event.name === "PageView" && event.path === path)) return;
  pending.push({ name: "PageView", path });
  loadLibrary();
}

/** Only a confirmed, new signup is eligible; observing one without consent drops it. */
export function trackMetaLead(httpStatus: number, result: unknown, options: MetaLeadOptions = {}): Promise<void> {
  if (httpStatus !== 201 || !result || typeof result !== "object") return Promise.resolve();
  const response = result as { status?: unknown; surveyToken?: unknown };
  if (response.status !== "created" || typeof response.surveyToken !== "string" || !response.surveyToken.trim()) return Promise.resolve();
  if (observedLeadResponses.has(result)) return Promise.resolve();
  observedLeadResponses.add(result);
  if (library === "failed" || !isMetaLeadTrackingEnabled() || !permitted() || window.location.pathname !== "/") return Promise.resolve();

  // Signup waits at most 800 ms. A slow SDK may finish in this same document
  // for up to 10 seconds, including the explicitly authorised public continuation.
  // No form data or conversion marker is persisted for replay after navigation.
  return new Promise((resolve) => {
    let released = false;
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const event: PendingEvent = {
      name: "Lead", path: "/", origin: window.location.origin,
      continuationPath: options.continuationPath === "/reserve" ? "/reserve" : undefined,
    };
    const releaseNavigation = () => {
      if (released) return;
      released = true;
      clearTimeout(navigationTimeout);
      clearTimeout(grace);
      resolve();
    };
    const navigationTimeout = setTimeout(releaseNavigation, NAVIGATION_WAIT_MS);
    const expiry = setTimeout(() => event.finish?.(false), LEAD_PENDING_MS);
    event.finish = (dispatched) => {
      if (settled) return;
      settled = true;
      clearTimeout(expiry);
      pending = pending.filter((item) => item !== event);
      if (dispatched && !released) grace = setTimeout(releaseNavigation, DISPATCH_GRACE_MS);
      else releaseNavigation();
    };
    pending.push(event);
    loadLibrary();
  });
}

/** The caller supplies only a server-confirmed live paid reservation's opaque identity and deposit. */
export function trackMetaPurchase(input: MetaPurchase) {
  if (!input || typeof input.eventId !== "string" || !/^[a-f0-9]{64}$/.test(input.eventId)
    || typeof input.value !== "number" || !Number.isFinite(input.value) || input.value <= 0
    || typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency)) return;
  if (observedPurchases.has(input.eventId)) return;
  observedPurchases.add(input.eventId);
  if (library === "failed" || !isMetaPurchaseTrackingEnabled() || !permitted()
    || window.location.pathname !== "/reserve/complete" || purchaseHistory().includes(input.eventId)) return;
  pending.push({ name: "Purchase", path: window.location.pathname,
    purchase: { eventId: input.eventId, value: input.value, currency: input.currency } });
  loadLibrary();
}
