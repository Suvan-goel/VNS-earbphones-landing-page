"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getMarketingConsent,
  isMetaLeadTrackingEnabled,
  isMetaPixelConfigured,
  setMarketingConsent,
  subscribeMarketingConsent,
  trackMetaPageView,
  type MarketingConsent as Choice,
} from "@/lib/meta-pixel";

export function MarketingConsent() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<Choice>(null);
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const configured = isMetaPixelConfigured();

  useEffect(() => {
    const current = getMarketingConsent();
    setChoice(current);
    setOpen(configured && current === null);
    setReady(true);
    return subscribeMarketingConsent(() => setChoice(getMarketingConsent()));
  }, [configured]);

  useEffect(() => {
    if (ready && choice === "granted" && pathname === "/") trackMetaPageView();
  }, [ready, choice, pathname]);

  function choose(next: "granted" | "denied") {
    setMarketingConsent(next);
    setOpen(false);
    settingsButton.current?.focus();
  }

  if (!ready) return null;

  return (
    <>
      <button
        ref={settingsButton}
        type="button"
        aria-expanded={open}
        aria-controls="marketing-cookie-settings"
        onClick={() => {
          setOpen(!open);
          if (!open) requestAnimationFrame(() => heading.current?.focus());
        }}
        className="fixed bottom-3 left-3 z-[60] rounded-full border border-[var(--line-strong)] bg-paper px-3 py-2 text-xs text-ivory shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Cookie settings
      </button>
      {open && (
        <section
          id="marketing-cookie-settings"
          aria-labelledby="marketing-cookie-title"
          className="fixed bottom-16 left-3 right-3 z-[60] max-h-[calc(100dvh-7rem)] overflow-auto rounded-2xl border border-[var(--line-strong)] bg-paper p-5 text-ivory shadow-xl sm:right-auto sm:w-[30rem] sm:p-6"
        >
          <h2 ref={heading} tabIndex={-1} id="marketing-cookie-title" className="text-xl font-medium tracking-tight outline-none">
            Your cookie choices
          </h2>
          {configured ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                With your permission, we use Meta Pixel to measure homepage visits
                {isMetaLeadTrackingEnabled() ? " and completed launch-list signups" : ""} and understand our ads.
                Meta may receive your IP address, browser and page details, and cookie identifiers, and link them to your Meta account.
                We do not send your email or survey answers to the Pixel.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                You can join the launch list without accepting. Change your choice here at any time.{" "}
                <a href="/privacy" className="underline underline-offset-2">Privacy notice</a>
              </p>
              {choice && <p className="mt-3 text-sm text-muted">Marketing cookies are {choice === "granted" ? "accepted" : "rejected"}.</p>}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => choose("denied")} className="btn-secondary !min-h-11 !px-3 text-sm">Reject optional</button>
                <button type="button" onClick={() => choose("granted")} className="btn-secondary !min-h-11 !px-3 text-sm">Accept marketing</button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Meta advertising tracking is currently disabled on this website. You can still join the launch list.{" "}
                <a href="/privacy" className="underline underline-offset-2">Privacy notice</a>
              </p>
              <button type="button" onClick={() => choose("denied")} className="btn-secondary mt-5 !min-h-11 text-sm">Keep optional cookies off</button>
            </>
          )}
        </section>
      )}
    </>
  );
}
