"use client";

import { useEffect, useState } from "react";
import { consentRequired, getConsent, setConsent } from "@/lib/analytics";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!consentRequired || getConsent() !== null) return;
    // Wait until the visitor has seen the hero, so the banner never covers the first impression.
    const show = () => setOpen(true);
    const onScroll = () => window.scrollY > window.innerHeight * 0.6 && show();
    const t = setTimeout(show, 9000);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!open) return null;

  const choose = (v: "granted" | "denied") => {
    setConsent(v);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Analytics preferences"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-[var(--line)] bg-[#151515]/90 p-4 text-ivory shadow-2xl backdrop-blur-md sm:left-auto sm:right-5 sm:bottom-5 sm:mx-0"
    >
      <p className="text-sm leading-relaxed text-ivory-soft">
        We&rsquo;d like to use cookie-free, privacy-friendly analytics to learn which parts of this page resonate. No advertising, no
        cross-site tracking. <a href="/privacy" className="underline underline-offset-2">Privacy</a>
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => choose("granted")} className="h-9 rounded-full bg-ivory px-4 text-sm font-medium text-[#141414] hover:bg-[#fffaf0]">
          Allow
        </button>
        <button onClick={() => choose("denied")} className="h-9 rounded-full border border-[var(--line-strong)] px-4 text-sm text-ivory-soft hover:border-ivory/40">
          No thanks
        </button>
      </div>
    </div>
  );
}
