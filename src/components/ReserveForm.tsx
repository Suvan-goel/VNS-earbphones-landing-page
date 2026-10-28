"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { reservation } from "@/config/reservation";
import { formatPrice } from "@/config/pricing";
import { useMarket } from "./MarketProvider";
import { getAttribution, track } from "@/lib/analytics";
import type { PreparedReservationPayment } from "./InlineReservationPayment";
import styles from "./ReserveForm.module.css";
import paymentStyles from "./ReservationPayment.module.css";
import inlineStyles from "./InlineReservationPayment.module.css";

const ReservationPayment = dynamic(() => import("./ReservationPayment").then((module) => module.ReservationPayment), {
  ssr: false,
  loading: () => <p role="status" className={paymentStyles.loading}>Loading secure payment…</p>,
});

const InlineReservationPayment = dynamic(() => import("./InlineReservationPayment").then((module) => module.InlineReservationPayment), {
  ssr: false,
  loading: () => <p role="status" className={inlineStyles.loading}>Loading secure payment…</p>,
});

type Phase = { k: "idle" } | { k: "submitting" } | { k: "redirecting" } | { k: "error"; message: string }
  | { k: "payment"; clientSecret: string; sessionId: string; email: string };
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

export function ReserveForm({ variant, open, preview = false, testMode = false, hostedUrl = null, publishableKey = null }: { variant: string; open: boolean; preview?: boolean; testMode?: boolean; hostedUrl?: string | null; publishableKey?: string | null }) {
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineLocked, setInlineLocked] = useState(false);
  const startedAt = useRef(0);
  const inFlight = useRef(false);
  const attempts = useRef(new Map<string, string>());
  const errorRef = useRef<HTMLParagraphElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const focusEmailOnReturn = useRef(false);
  const id = useId();
  const { market, pricing, setLocked } = useMarket();
  // Stripe verifies the live total too; this is what the page promised in the visitor's currency.
  const expected = { amount: pricing.deposit, currency: pricing.currency, label: formatPrice(market, "deposit") };

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
    if (phase.k === "payment") paymentRef.current?.focus({ preventScroll: true });
    if (phase.k === "idle" && focusEmailOnReturn.current) {
      focusEmailOnReturn.current = false;
      emailRef.current?.focus();
    }
  }, [phase]);

  const invalid = touched && !EMAIL_RE.test(email.trim());
  const busy = inlineBusy || phase.k === "submitting" || phase.k === "redirecting";
  const detailsDisabled = busy || inlineLocked;
  // A checkout is priced in one currency, so the switch waits until the visitor is back at the form.
  const marketLocked = detailsDisabled || phase.k === "payment";
  useEffect(() => { setLocked(marketLocked); }, [marketLocked, setLocked]);
  useEffect(() => () => setLocked(false), [setLocked]);
  const errId = `${id}-err`;

  function validateDetails(): string | null {
    setTouched(true);
    setSubmitted(true);
    if (!EMAIL_RE.test(email.trim())) return "Please enter a valid email address.";
    if (!termsAccepted) return "Please accept the reservation terms before continuing.";
    return null;
  }

  async function preparePayment(form: HTMLFormElement): Promise<PreparedReservationPayment> {
    const validationError = validateDetails();
    if (validationError) throw new Error(validationError);
    if (!open || inFlight.current) throw new Error("Please wait while we prepare your reservation.");
    const normalizedEmail = email.trim().toLowerCase();
    const company = (new FormData(form).get("company") as string) ?? "";
    inFlight.current = true;
    track("reserve_click", { location: "reserve_page" });
    try {
      const attemptId = getAttempt(normalizedEmail, attempts.current);
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, company, startedAt: startedAt.current, variant, market,
          attribution: getAttribution(), attemptId, termsAccepted: true, termsVersion: reservation.termsVersion }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string; url?: string; clientSecret?: string; sessionId?: string; resetAttempt?: boolean };
      if (res.ok && data.status === "ok" && data.clientSecret && data.sessionId && publishableKey) {
        track("reserve_checkout_started", { location: "reserve_page" });
        return { kind: "inline", clientSecret: data.clientSecret, sessionId: data.sessionId, email: normalizedEmail };
      }
      if (res.ok && data.status === "ok" && data.url) {
        const destination = new URL(data.url, window.location.origin);
        if (destination.origin !== window.location.origin && !(destination.protocol === "https:" && destination.hostname === "checkout.stripe.com")) {
          throw new Error("We couldn't open checkout. Please try again.");
        }
        track("reserve_checkout_started", { location: "reserve_page" });
        return { kind: "redirect", url: destination.href };
      }
      if (data.resetAttempt === true) {
        attempts.current.delete(normalizedEmail);
        try { sessionStorage.removeItem(`${ATTEMPT_KEY}:${normalizedEmail}`); } catch { /* Memory has already been reset. */ }
      }
      track("reserve_error", { location: "reserve_page", code: res.status });
      throw new Error(data.message ?? "We couldn't open checkout. Please try again.");
    } catch (error) {
      if (error instanceof TypeError) {
        track("reserve_error", { location: "reserve_page", code: 0 });
        throw new Error("We couldn't open checkout. Check your connection and try again; we'll reuse your checkout attempt.");
      }
      throw error;
    } finally {
      inFlight.current = false;
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open || inFlight.current) return;
    const validationError = validateDetails();
    if (validationError) {
      setPhase({ k: "error", message: validationError });
      return;
    }
    setPhase({ k: "submitting" });
    try {
      const prepared = await preparePayment(e.currentTarget);
      if (prepared.kind === "inline") {
        setPhase({ k: "payment", clientSecret: prepared.clientSecret, sessionId: prepared.sessionId, email: prepared.email });
      } else {
        setPhase({ k: "redirecting" });
        window.location.assign(prepared.url);
      }
    } catch (error) {
      setPhase({ k: "error", message: error instanceof Error ? error.message : "We couldn't open checkout. Please try again." });
    }
  }

  if (!open && hostedUrl) {
    return (
      <div>
        <a href={hostedUrl} data-cta="reserve_hosted" className={`${styles.button} ${styles.hostedButton}`}>
          Reserve for {expected.label}
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3 10h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </div>
    );
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

  if (phase.k === "payment" && publishableKey) {
    return (
      <div ref={paymentRef} tabIndex={-1} className={styles.paymentStage} aria-label="Reservation payment">
        {testMode && <p className={styles.testNotice}><strong>Test mode</strong> Use test cards only. No real charge.</p>}
        <ReservationPayment
          publishableKey={publishableKey}
          clientSecret={phase.clientSecret}
          sessionId={phase.sessionId}
          email={phase.email}
          expected={expected}
          onEditDetails={() => {
            focusEmailOnReturn.current = true;
            setPhase({ k: "idle" });
          }}
        />
      </div>
    );
  }

  const details = (
    <>
      {testMode && <p className={styles.testNotice}><strong>Test mode</strong> Use test cards only. No real charge.</p>}
      <label htmlFor={`${id}-email`} className={styles.label}>Email address</label>
      <input
        ref={emailRef}
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
        aria-describedby={phase.k === "error" ? errId : undefined}
        disabled={detailsDisabled}
        className={`${styles.field} ${invalid ? styles.invalid : ""}`}
      />

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
          disabled={detailsDisabled}
          aria-invalid={(submitted && !termsAccepted) || undefined}
          aria-describedby={phase.k === "error" ? errId : undefined}
          className={styles.checkbox}
        />
        <span>I agree to the <a href="/terms#reservations" target="_blank" rel="noopener noreferrer">reservation terms</a>.</span>
      </label>

      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Company<input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
      </div>

    </>
  );

  if (publishableKey && !preview) {
    return (
      <InlineReservationPayment
        key={market}
        publishableKey={publishableKey}
        email={email.trim().toLowerCase()}
        expected={expected}
        details={details}
        validate={validateDetails}
        prepare={preparePayment}
        onBusyChange={setInlineBusy}
        onConfirmationStart={() => setInlineLocked(true)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Reservation details" aria-busy={busy}>
      {details}
      <div aria-live="polite">
        {phase.k === "error" && <p id={errId} ref={errorRef} tabIndex={-1} className={styles.error}>{phase.message}</p>}
        {busy && <p className="sr-only">{phase.k === "redirecting" ? "Opening checkout." : "Preparing your reservation checkout."}</p>}
      </div>
      <button type="submit" data-cta="reserve" disabled={busy} className={styles.button}>
        {busy ? <><span className={styles.spinner} aria-hidden="true" />{phase.k === "redirecting" ? "Opening checkout…" : "One moment…"}</> : preview ? "Preview reservation" : "Reserve now"}
      </button>
      <p className={styles.checkoutNote}>{preview ? "Local preview — no payment or reservation is made." : <>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        Secure payment with Stripe
      </>}</p>
      {!preview && <p className={styles.checkoutNote}>Your card statement will show {reservation.merchantName}.</p>}
    </form>
  );
}
