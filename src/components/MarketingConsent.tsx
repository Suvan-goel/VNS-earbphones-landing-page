"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { consentRequired, getAnalyticsWithdrawalStatus, getConsent, retryAnalyticsWithdrawal, setConsent, subscribeAnalyticsWithdrawal, subscribeConsent } from "@/lib/analytics";
import { site } from "@/config/site";
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
import { OPEN_COOKIE_SETTINGS_EVENT } from "./CookieSettingsLink";

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const serverConsent = () => null;
const serverWithdrawalStatus = () => "idle" as const;

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
  const analyticsConsent = useSyncExternalStore(subscribeConsent, getConsent, serverConsent);
  const withdrawalStatus = useSyncExternalStore(subscribeAnalyticsWithdrawal, getAnalyticsWithdrawalStatus, serverWithdrawalStatus);
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);
  const [marketingChoice, setMarketingChoice] = useState(false);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [retryingWithdrawal, setRetryingWithdrawal] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const returnFocusTarget = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  const configured = isMetaPixelConfigured();
  const internalRoute = pathname === "/reserve/preview" || pathname === "/dev" || pathname.startsWith("/dev/") || pathname === "/api" || pathname.startsWith("/api/");
  const visible = hydrated && (configured || consentRequired) && !internalRoute;
  // Open only after a visitor requests settings, including on their first visit.
  const panelOpen = visible && settingsOpen;
  const showWithdrawal = analyticsConsent !== "granted" && withdrawalStatus !== "idle";

  useEffect(() => {
    const openSettings = (event: Event) => {
      if (!visible) return;
      const trigger = event instanceof CustomEvent ? event.detail?.trigger : null;
      returnFocusTarget.current = trigger instanceof HTMLElement ? trigger : null;
      setSettingsOpen(true);
      panelRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, [visible]);

  useEffect(() => {
    // Existing marketing permission never implies analytics permission (or vice versa).
    setAnalyticsChoice(analyticsConsent === "granted");
    setMarketingChoice(consent === "granted");
  }, [panelOpen, analyticsConsent, consent]);

  useEffect(() => {
    // The library checks the production origin, route and current permission,
    // and deduplicates repeated effects before loading or sending anything.
    trackMetaPageView();
  }, [pathname, consent]);

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
      const target = returnFocusTarget.current;
      (target?.isConnected ? target : settingsRef.current)?.focus({ preventScroll: true });
      returnFocusTarget.current = null;
    }
  }, [settingsOpen, panelOpen, shown]);

  function closeSettings() {
    restoreFocus.current = true;
    setSettingsOpen(false);
  }

  function saveChoices(declineAll = false) {
    restoreFocus.current = true;
    if (consentRequired) setConsent(!declineAll && analyticsChoice ? "granted" : "denied");
    if (configured) setMarketingConsent(!declineAll && marketingChoice ? "granted" : "denied");
    const withdrawal = getAnalyticsWithdrawalStatus();
    setSettingsOpen(consentRequired && (declineAll || !analyticsChoice) && (withdrawal === "pending" || withdrawal === "unavailable"));
  }

  async function retryWithdrawal() {
    setRetryingWithdrawal(true);
    try { await retryAnalyticsWithdrawal(); }
    catch { /* The withdrawal status retains any unresolved deletion. */ }
    finally { setRetryingWithdrawal(false); }
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
            if (event.key === "Escape") closeSettings();
          }}
        >
          <div className={styles.heading}>
            <h2 id="marketing-cookie-title">Cookie settings</h2>
            <button type="button" className={styles.close} onClick={closeSettings} aria-label="Close cookie settings">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p id="marketing-cookie-description" className={styles.description}>
            Choose what to allow. Both are optional.
          </p>
          <div className={styles.choices}>
            {consentRequired && (
              <label className={styles.choice}>
                <input type="checkbox" checked={analyticsChoice} onChange={(event) => setAnalyticsChoice(event.target.checked)} />
                <span><strong>Website analytics</strong><small>Help us understand visits, signups and checkout steps.</small></span>
              </label>
            )}
            {configured && (
              <label className={styles.choice}>
                <input type="checkbox" checked={marketingChoice} onChange={(event) => setMarketingChoice(event.target.checked)} />
                <span><strong>Advertising cookies</strong><small>Allow Meta to measure ad visits{measuredConversions(true)}.</small></span>
              </label>
            )}
          </div>
          <div className={styles.withdrawal} data-active={showWithdrawal || undefined}>
            <p role="status" aria-live="polite" aria-atomic="true">
              {showWithdrawal ? withdrawalStatus === "complete"
                ? "Analytics is off. Records for this analytics session have been deleted."
                : withdrawalStatus === "pending"
                  ? "Analytics is off. Deletion of records for this analytics session is pending."
                  : <>Analytics is off. We could not confirm automatic deletion. <a href={`mailto:${site.contactEmail}`}>Contact us</a> for help with a deletion request.</> : null}
            </p>
            {showWithdrawal && (withdrawalStatus === "pending" || withdrawalStatus === "unavailable") && <button type="button" disabled={retryingWithdrawal} onClick={retryWithdrawal}>
              {retryingWithdrawal ? "Trying again…" : "Try deletion again"}
            </button>}
          </div>
          <div className={styles.footer}>
            <a className={styles.privacy} href="/privacy#website-analytics">Privacy</a>
            <div className={styles.actions}>
              <button type="button" onClick={() => saveChoices(true)}>Decline all</button>
              <button type="button" onClick={() => saveChoices()}>Save choices</button>
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
          onClick={() => {
            returnFocusTarget.current = null;
            setSettingsOpen(true);
          }}
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
