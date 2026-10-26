"use client";

// Marketing permission is separate from first-party analytics permission.
export const MARKETING_CONSENT_KEY = "cymba-marketing-consent-v1";
export type MarketingConsent = "granted" | "denied" | null;

const configuredId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
const PIXEL_ID = /^[1-9]\d*$/.test(configuredId) ? configuredId : "";
const LEAD_ENABLED = process.env.NEXT_PUBLIC_META_LEAD_TRACKING_ENABLED === "true";
// Only the canonical production origin may contact Meta, even if a preview
// inherits the public Pixel ID. Never derive this permission from query strings.
const ALLOWED_ORIGIN = "https://trycymba.com";

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

type EventName = "PageView" | "Lead";
let memoryConsent: MarketingConsent | undefined;
let library: "idle" | "loading" | "ready" | "failed" = "idle";
let initialized = false;
let pageViewSent = false;
let pending: EventName[] = [];
const observedLeadResponses = new WeakSet<object>();
const listeners = new Set<() => void>();

export function isMetaPixelConfigured() {
  return Boolean(PIXEL_ID);
}

// Keep off until the dataset's category restrictions and permitted events are reviewed.
export function isMetaLeadTrackingEnabled() {
  return isMetaPixelConfigured() && LEAD_ENABLED;
}

function parseConsent(value: string | null): MarketingConsent {
  return value === "granted" || value === "denied" ? value : null;
}

export function getMarketingConsent(): MarketingConsent {
  if (typeof window === "undefined") return null;
  if (memoryConsent !== undefined) return memoryConsent;
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
}

function revoke() {
  pending = [];
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
  memoryConsent = choice;
  try {
    window.localStorage.setItem(MARKETING_CONSENT_KEY, choice);
  } catch {
    // The visitor's choice still applies for this page when storage is unavailable.
  }
  if (choice === "denied") revoke();
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== MARKETING_CONSENT_KEY && event.key !== null) return;
  memoryConsent = parseConsent(event.newValue);
  if (memoryConsent !== "granted") revoke();
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
  return typeof window !== "undefined" && isMetaPixelConfigured() &&
    window.location.origin === ALLOWED_ORIGIN &&
    window.location.pathname === "/" && getMarketingConsent() === "granted";
}

function flush() {
  if (library !== "ready" || !permitted()) {
    pending = [];
    return;
  }
  try {
    const pixel = window.fbq;
    if (!pixel?.callMethod) return;
    pixel("consent", "grant");
    if (!initialized) {
      pixel("set", "autoConfig", false, PIXEL_ID);
      // No advanced-matching/customer fields. Meta-side automatic matching/events
      // must also remain off before this integration is enabled.
      pixel("init", PIXEL_ID);
      initialized = true;
    }
    const events = pending;
    pending = [];
    for (const name of events) {
      if (!permitted()) break;
      if (name === "PageView" && pageViewSent) continue;
      // No custom parameters, email, survey data, token or other form contents.
      pixel("trackSingle", PIXEL_ID, name);
      if (name === "PageView") pageViewSent = true;
    }
  } catch {
    pending = [];
  }
}

function loadLibrary() {
  if (library === "ready") return flush();
  if (library !== "idle" || !permitted()) return;
  library = "loading";
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
    // We dispatch homepage PageView explicitly; SDK history listeners must not
    // emit automatic events when navigation moves to privacy or other pages.
    window.fbq.disablePushState = true;
    // The SDK starts revoked. Initialization waits for its load and a fresh
    // permission check; our own queue only contains events observed after consent.
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
      pending = [];
    };
    document.head.appendChild(script);
  } catch {
    library = "failed";
    pending = [];
  }
}

export function trackMetaPageView() {
  if (library === "failed" || !permitted() || pageViewSent || pending.includes("PageView")) return;
  pending.push("PageView");
  loadLibrary();
}

/** Only a confirmed, new signup is eligible; observing one without consent drops it. */
export function trackMetaLead(httpStatus: number, result: unknown) {
  if (httpStatus !== 201 || !result || typeof result !== "object") return;
  const response = result as { status?: unknown; surveyToken?: unknown };
  if (response.status !== "created" || typeof response.surveyToken !== "string" || !response.surveyToken.trim()) return;
  if (observedLeadResponses.has(result)) return;
  observedLeadResponses.add(result);
  if (library === "failed" || !isMetaLeadTrackingEnabled() || !permitted()) return;
  pending.push("Lead");
  loadLibrary();
}
