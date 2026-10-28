"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  getMarketingConsent,
  isMetaLeadTrackingEnabled,
  isMetaPixelConfigured,
  isMetaPurchaseTrackingEnabled,
  setMarketingConsent,
  subscribeMarketingConsent,
  trackMetaPageView,
} from "@/lib/meta-pixel";
import styles from "./MarketingConsent.module.css";

const consentRoutes = new Set(["/", "/reserve", "/reserve/complete", "/privacy"]);
const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const serverConsent = () => null;

function measuredConversions(concise = false) {
  const lead = isMetaLeadTrackingEnabled();
  const purchase = isMetaPurchaseTrackingEnabled();
  const signups = concise ? "waitlist signups" : "successful new waitlist signups";
  const reservations = concise ? "paid reservations" : "confirmed paid reservations";
  if (lead && purchase) return `, ${signups} and ${reservations}`;
  if (lead) return ` and ${signups}`;
  if (purchase) return ` and ${reservations}`;
  return "";
}

/** Keep the notice aligned with the advertising measurements currently enabled. */
export function MetaMeasurementDescription() {
  const lead = isMetaLeadTrackingEnabled();
  const purchase = isMetaPurchaseTrackingEnabled();

  return (
    <p>
      With your separate permission for advertising cookies, we use Meta Pixel on our home and reservation pages to measure
      visits from Facebook and Instagram ads{measuredConversions()}. This helps us understand the performance of our ads.
      {purchase && <> A paid-reservation event includes the deposit amount and currency.</>}
      {!lead && !purchase && <> We do not currently send waitlist-signup or paid-reservation conversion events.</>}
      {" "}Declining does not prevent you from using the website, joining the waitlist or reserving a device.
    </p>
  );
}

/** Advertising permission is independent of analytics and email subscriptions. */
export function MarketingConsent() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeMarketingConsent, getMarketingConsent, serverConsent);
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const configured = isMetaPixelConfigured();
  const visible = hydrated && configured && consentRoutes.has(pathname);
  const panelOpen = visible && (consent === null || settingsOpen);

  useEffect(() => {
    // The library checks the production origin, route and current permission,
    // and deduplicates repeated effects before loading or sending anything.
    trackMetaPageView();
  }, [pathname, consent]);

  // Tell the page how tall the open panel is, so the pinned hero form can sit above it on phones.
  useEffect(() => {
    const root = document.documentElement;
    const panel = panelRef.current;
    // The panel mounts one render after it opens, so measure once it exists.
    if (!panelOpen || !shown || !panel) {
      root.style.removeProperty("--consent-height");
      root.style.removeProperty("--consent-lift");
      return;
    }
    const update = () => {
      const height = Math.ceil(panel.getBoundingClientRect().height);
      root.style.setProperty("--consent-height", `${height}px`);
      // The same number without a unit, so the model band can scale by it.
      root.style.setProperty("--consent-lift", `${height}`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--consent-height");
      root.style.removeProperty("--consent-lift");
    };
  }, [panelOpen, shown]);

  // Keep the panel mounted for a short fade-out instead of removing it in one frame.
  useEffect(() => {
    if (panelOpen) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [panelOpen, shown]);

  useEffect(() => {
    if (settingsOpen && panelOpen && shown) panelRef.current?.focus({ preventScroll: true });
    if (!panelOpen && !shown && restoreFocus.current) {
      restoreFocus.current = false;
      settingsRef.current?.focus({ preventScroll: true });
    }
  }, [settingsOpen, panelOpen, shown]);

  function closeSettings() {
    restoreFocus.current = true;
    setSettingsOpen(false);
  }

  function choose(choice: "granted" | "denied") {
    restoreFocus.current = true;
    setMarketingConsent(choice);
    setSettingsOpen(false);
  }

  if (!visible) return null;

  return (
    <>
      {shown ? (
        <section
          ref={panelRef}
          id="marketing-cookie-settings"
          className={styles.panel}
          data-closing={closing || undefined}
          aria-hidden={closing || undefined}
          aria-labelledby="marketing-cookie-title"
          aria-describedby="marketing-cookie-description"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape" && consent !== null) closeSettings();
          }}
        >
          <div className={styles.heading}>
            <h2 id="marketing-cookie-title">Advertising cookies</h2>
            {consent !== null && (
              <span className={styles.current}>{consent === "granted" ? "Allowed" : "Declined"}</span>
            )}
            {consent !== null && (
              <button type="button" className={styles.close} onClick={closeSettings} aria-label="Close cookie settings">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <p id="marketing-cookie-description" className={styles.description}>
            Allow Meta cookies to measure ad visits{measuredConversions(true)}?
          </p>
          <div className={styles.footer}>
            <a className={styles.privacy} href="/privacy#advertising-cookies">Privacy</a>
            <div className={styles.actions}>
              <button type="button" onClick={() => choose("denied")}>Decline</button>
              <button type="button" onClick={() => choose("granted")}>Accept</button>
            </div>
          </div>
        </section>
      ) : (
        <button
          ref={settingsRef}
          type="button"
          className={styles.settings}
          aria-label="Cookie settings"
          title="Cookie settings"
          aria-controls="marketing-cookie-settings"
          aria-expanded={false}
          onClick={() => setSettingsOpen(true)}
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" focusable="false">
              <path d="M12 3a9 9 0 1 0 9 9 4.5 4.5 0 0 1-4.5-4.5A4.5 4.5 0 0 1 12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="8" r="1" fill="currentColor" />
              <circle cx="7" cy="14" r="1" fill="currentColor" />
              <circle cx="14" cy="13" r="1" fill="currentColor" />
              <circle cx="12" cy="18" r="1" fill="currentColor" />
            </svg>
          </span>
        </button>
      )}
    </>
  );
}
