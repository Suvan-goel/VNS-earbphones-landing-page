"use client";

import { useEffect } from "react";
import { getAttribution, getConsent, setVariant, subscribeConsent, track } from "@/lib/analytics";

/** Page-level analytics: visit, CTA clicks (any [data-cta]), FAQ opens. */
export function Tracker({ variant }: { variant: string }) {
  useEffect(() => {
    setVariant(variant);
    getAttribution();
    // Measure the current visit when permission is granted, including a visitor
    // who previously declined and later changes their choice in Cookie settings.
    let viewed = false;
    const measureVisit = () => {
      if (getConsent() !== "granted") {
        // Withdrawal clears both queued events and the analytics session. A new
        // grant must be able to measure this visit, even if its first send was cancelled.
        viewed = false;
        return;
      }
      if (viewed) return;
      viewed = true;
      track("page_view", { variant });
    };
    measureVisit();
    const unsubscribe = subscribeConsent(measureVisit);

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cta]");
      if (el?.dataset.cta) track("cta_click", { location: el.dataset.cta });
    };
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (d.tagName === "DETAILS" && d.open && d.dataset.faq) track("faq_open", { question: d.dataset.faq });
    };
    document.addEventListener("click", onClick);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      unsubscribe();
      document.removeEventListener("click", onClick);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, [variant]);
  return null;
}
