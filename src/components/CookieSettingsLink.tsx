"use client";

import { useSyncExternalStore } from "react";
import { consentRequired } from "@/lib/analytics";
import { isMetaPixelConfigured } from "@/lib/meta-pixel";
import styles from "./CookieSettingsLink.module.css";

export const OPEN_COOKIE_SETTINGS_EVENT = "cymba:open-cookie-settings";
const subscribeHydration = () => () => {};

/** Opens the existing consent panel without changing the visitor's choices. */
export function CookieSettingsLink({ className }: { className?: string }) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  if (!hydrated || (!consentRequired && !isMetaPixelConfigured())) return null;

  return <button
    type="button"
    className={className ? `${styles.link} ${className}` : styles.link}
    aria-controls="marketing-cookie-settings"
    onClick={(event) => window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT, { detail: { trigger: event.currentTarget } }))}
  >Cookie settings</button>;
}
