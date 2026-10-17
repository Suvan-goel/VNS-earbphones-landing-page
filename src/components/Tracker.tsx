"use client";

import { useEffect } from "react";
import { getAttribution, setVariant, track } from "@/lib/analytics";

/** Page-level analytics: visit, CTA clicks (any [data-cta]), FAQ opens. */
export function Tracker({ variant }: { variant: string }) {
  useEffect(() => {
    setVariant(variant);
    getAttribution();
    track("page_view", { variant });

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
      document.removeEventListener("click", onClick);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, [variant]);
  return null;
}
