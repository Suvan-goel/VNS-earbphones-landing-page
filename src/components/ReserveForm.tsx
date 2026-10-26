"use client";

import { useEffect, useId, useRef, useState } from "react";
import { reservation } from "@/config/reservation";
import { getAttribution, track } from "@/lib/analytics";
import styles from "./ReserveForm.module.css";

type Phase = { k: "idle" } | { k: "submitting" } | { k: "redirecting" } | { k: "error"; message: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTEMPT_KEY = "cymba.reservation-attempt";

/** Reuse one checkout attempt per email, including after a lost network response. */
function getAttempt(email: string, memory: Map<string, string>): string {
  const existing = memory.get(email);
  if (existing) return existing;
  try {
    const saved = sessionStorage.getItem(`${ATTEMPT_KEY}:${email}`);
    if (saved && UUID_RE.test(saved)) {
      memory.set(email, saved);
      return saved;
    }
  } catch {
    // Storage is optional; the in-memory attempt still protects ordinary retries.
  }
  const next = crypto.randomUUID();
  memory.set(email, next);
  try { sessionStorage.setItem(`${ATTEMPT_KEY}:${email}`, next); } catch { /* Keep the in-memory attempt. */ }
  return next;
}

export function ReserveForm({ variant, open, preview = false, testMode = false }: { variant: string; open: boolean; preview?: boolean; testMode?: boolean }) {
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef(0);
  const inFlight = useRef(false);
  const attempts = useRef(new Map<string, string>());
  const errorRef = useRef<HTMLParagraphElement>(null);
  const id = useId();

  useEffect(() => {
    startedAt.current = Date.now();
    try {
      const prefill = JSON.parse(sessionStorage.getItem("cymba.reservation-prefill") ?? "null") as { email?: unknown; savedAt?: unknown } | null;
      sessionStorage.removeItem("cymba.reservation-prefill");
      if (typeof prefill?.email === "string" && prefill.email.length <= 254 && EMAIL_RE.test(prefill.email)
        && typeof prefill.savedAt === "number" && Date.now() - prefill.savedAt >= 0 && Date.now() - prefill.savedAt < 30 * 60 * 1000) {
        setEmail(prefill.email);
      }
    } catch { /* An empty form is a safe fallback. */ }
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        inFlight.current = false;
        setPhase({ k: "idle" });
      }
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  useEffect(() => {
    if (phase.k === "error") errorRef.current?.focus();
  }, [phase]);

  const invalid = touched && !EMAIL_RE.test(email.trim());
  const busy = phase.k === "submitting" || phase.k === "redirecting";
  const errId = `${id}-err`;
  const noteId = `${id}-note`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open || inFlight.current) return;
    setTouched(true);
    setSubmitted(true);
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      setPhase({ k: "error", message: "Please enter a valid email address." });
      return;
    }
    if (!termsAccepted) {
      setPhase({ k: "error", message: "Please accept the reservation terms before continuing." });
      return;
    }
    const company = (new FormData(e.currentTarget).get("company") as string) ?? "";
    inFlight.current = true;
    setPhase({ k: "submitting" });
    track("reserve_click", { location: "reserve_page" });
    try {
      const attemptId = getAttempt(normalizedEmail, attempts.current);
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, company, startedAt: startedAt.current, variant,
          attribution: getAttribution(), attemptId, termsAccepted: true, termsVersion: reservation.termsVersion }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string; url?: string; resetAttempt?: boolean };
      if (res.ok && data.status === "ok" && data.url) {
        const destination = new URL(data.url, window.location.origin);
        if (destination.origin !== window.location.origin && !(destination.protocol === "https:" && destination.hostname === "checkout.stripe.com")) {
          throw new Error("Invalid checkout destination");
        }
        track("reserve_checkout_started", { location: "reserve_page" });
        setPhase({ k: "redirecting" });
        window.location.assign(destination.href);
        return;
      }
      if (data.resetAttempt === true) {
        attempts.current.delete(normalizedEmail);
        try { sessionStorage.removeItem(`${ATTEMPT_KEY}:${normalizedEmail}`); } catch { /* Memory has already been reset. */ }
      }
      track("reserve_error", { location: "reserve_page", code: res.status });
      setPhase({ k: "error", message: data.message ?? "We couldn't open checkout. Please try again." });
    } catch {
      track("reserve_error", { location: "reserve_page", code: 0 });
      setPhase({ k: "error", message: "We couldn't open checkout. Check your connection and try again; we'll reuse your checkout attempt." });
    }
    inFlight.current = false;
  }

  if (!open) {
    return (
      <div role="status">
        <a href={`/?v=${encodeURIComponent(variant)}#signup`} className={`${styles.button} ${styles.closedButton}`}>
          Join the free waitlist
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Reservation details" aria-busy={busy}>
      {testMode && <p className={styles.testNotice}><strong>Stripe test mode</strong> No real money is charged. Use test card details only.</p>}
      <label htmlFor={`${id}-email`} className={styles.label}>Email address</label>
      <input
        id={`${id}-email`}
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        maxLength={254}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (phase.k === "error") setPhase({ k: "idle" });
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid || undefined}
        aria-describedby={[noteId, phase.k === "error" ? errId : ""].filter(Boolean).join(" ")}
        disabled={busy}
        className={`${styles.field} ${invalid ? styles.invalid : ""}`}
      />
      <p id={noteId} className={styles.helper}>This won’t add you to our marketing list.</p>

      <label className={styles.terms}>
        <input
          id={`${id}-terms`}
          type="checkbox"
          name="termsAccepted"
          required
          checked={termsAccepted}
          onChange={(e) => {
            setTermsAccepted(e.target.checked);
            if (phase.k === "error") setPhase({ k: "idle" });
          }}
          disabled={busy}
          aria-invalid={(submitted && !termsAccepted) || undefined}
          aria-describedby={phase.k === "error" ? errId : undefined}
          className={styles.checkbox}
        />
        <span>I agree to the <a href="/terms#reservations" target="_blank" rel="noopener noreferrer">reservation terms</a>.</span>
      </label>

      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Company<input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div aria-live="polite">
        {phase.k === "error" && <p id={errId} ref={errorRef} tabIndex={-1} className={styles.error}>{phase.message}</p>}
        {busy && <p className="sr-only">{phase.k === "redirecting" ? "Opening checkout." : "Preparing your reservation checkout."}</p>}
      </div>
      <button type="submit" data-cta="reserve" disabled={busy} className={styles.button}>
        {busy ? <><span className={styles.spinner} aria-hidden="true" />{phase.k === "redirecting" ? "Opening checkout…" : "One moment…"}</> : preview ? "Preview reservation" : "Reserve yours"}
        {!busy && <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3 10h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </button>
      <p className={styles.checkoutNote}>
        {preview ? "Local preview — no payment or reservation is made." : <><svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeLinecap="round" /></svg>Secure checkout with Stripe</>}
      </p>
    </form>
  );
}
