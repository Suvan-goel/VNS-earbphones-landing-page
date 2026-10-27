"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type {
  Appearance,
  StripeCheckoutElementsSdk,
  StripeCheckoutLoadActionsResult,
  StripeElementsOptions,
  StripeExpressCheckoutElementConfirmEvent,
} from "@stripe/stripe-js";
import { reservation } from "@/config/reservation";
import styles from "./InlineReservationPayment.module.css";

export type PreparedReservationPayment =
  | { kind: "inline"; clientSecret: string; sessionId: string; email: string }
  | { kind: "redirect"; url: string };

export type InlineReservationPaymentProps = {
  publishableKey: string;
  email: string;
  details: ReactNode;
  validate: () => string | null;
  prepare: (form: HTMLFormElement) => Promise<PreparedReservationPayment>;
  onBusyChange: (busy: boolean) => void;
  onConfirmationStart: () => void;
};

type CheckoutActions = Extract<StripeCheckoutLoadActionsResult, { type: "success" }>["actions"];
type CheckoutEntry = { sdk: StripeCheckoutElementsSdk; actions: Promise<CheckoutActions> | null };
type CheckoutCache = Map<string, CheckoutEntry>;

class PaymentMessage extends Error {}

const appearance: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#cfae7c",
    colorBackground: "#2b2b2d",
    colorText: "#f5f5f7",
    colorTextSecondary: "#b9b9bb",
    colorDanger: "#ffb8ad",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeBase: "16px",
    spacingUnit: "4px",
    borderRadius: "9px",
  },
  rules: {
    ".Input": { borderColor: "#7e7e74", boxShadow: "none", padding: "14px" },
    ".Input:focus": { borderColor: "#cfae7c", boxShadow: "0 0 0 2px #cfae7c40" },
    ".Label": { fontWeight: "500", fontSize: "14px", marginBottom: "9px" },
    ".Tab": { borderColor: "#7e7e74", boxShadow: "none" },
    ".Tab--selected": { borderColor: "#cfae7c", boxShadow: "0 0 0 1px #cfae7c" },
  },
};

const elementOptions: StripeElementsOptions = {
  mode: "payment",
  amount: reservation.amount,
  currency: reservation.currency,
  paymentMethodCreation: "manual",
  appearance,
  loader: "auto",
};

/** Collect payment details first; the server still records consent before creating Checkout. */
export function InlineReservationPayment(props: InlineReservationPaymentProps) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Client secrets and SDKs stay in memory and survive a payment-fields loading retry.
  const checkoutCache = useRef<CheckoutCache>(new Map());
  return (
    <InlinePaymentProvider
      key={loadAttempt}
      {...props}
      checkoutCache={checkoutCache.current}
      onReload={() => setLoadAttempt((attempt) => attempt + 1)}
    />
  );
}

function InlinePaymentProvider({ publishableKey, ...props }: InlineReservationPaymentProps & { checkoutCache: CheckoutCache; onReload: () => void }) {
  const [scriptFailed, setScriptFailed] = useState(false);
  const stripePromise = useMemo(() => loadStripe(publishableKey).catch(() => null), [publishableKey]);
  useEffect(() => {
    let active = true;
    void stripePromise.then((stripe) => { if (active && !stripe) setScriptFailed(true); });
    return () => { active = false; };
  }, [stripePromise]);

  return (
    <Elements stripe={stripePromise} options={elementOptions}>
      <InlinePaymentForm {...props} scriptFailed={scriptFailed} />
    </Elements>
  );
}

function InlinePaymentForm({ email, details, validate, prepare, onBusyChange, onConfirmationStart, checkoutCache, onReload, scriptFailed }: Omit<InlineReservationPaymentProps, "publishableKey"> & { checkoutCache: CheckoutCache; onReload: () => void; scriptFailed: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletsAvailable, setWalletsAvailable] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paymentLoadError, setPaymentLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState<string>(reservation.depositLabel);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const walletPending = useRef(false);
  const hasAvailabilityEvent = useRef(false);
  const active = useRef(true);
  const id = useId();

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      inFlight.current = false;
      walletPending.current = false;
      setSubmitting(false);
      setWalletOpen(false);
      onBusyChange(false);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [onBusyChange]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { setError(null); }, [email]);

  function failWallet(event: StripeExpressCheckoutElementConfirmEvent | undefined, message: string) {
    if (!event) return;
    try { event.paymentFailed({ reason: "fail", message }); } catch { /* The sheet may already have closed. */ }
  }

  function releaseBusy() {
    inFlight.current = false;
    walletPending.current = false;
    if (!active.current) return;
    setSubmitting(false);
    setWalletOpen(false);
    onBusyChange(false);
  }

  async function submitPayment(walletEvent?: StripeExpressCheckoutElementConfirmEvent) {
    if (inFlight.current || (walletPending.current && !walletEvent)) return;
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      failWallet(walletEvent, validationMessage);
      releaseBusy();
      return;
    }
    if (!stripe || !elements || !formRef.current || scriptFailed) {
      const message = "Secure payment is still loading. Please try again in a moment.";
      setError(message);
      failWallet(walletEvent, message);
      releaseBusy();
      return;
    }

    const submittedEmail = email.trim().toLowerCase();
    inFlight.current = true;
    walletPending.current = false;
    setWalletOpen(false);
    setSubmitting(true);
    setError(null);
    onBusyChange(true);

    let navigating = false;
    try {
      // Both card and wallet paths validate through the same Stripe Elements instance.
      const submitted = await elements.submit();
      if (!active.current) return;
      if (submitted.error) throw new PaymentMessage(submitted.error.message ?? "Please check your payment details.");

      const method = await stripe.createPaymentMethod({ elements, params: { billing_details: { email: submittedEmail } } });
      if (!active.current) return;
      if (method.error) throw new PaymentMessage(method.error.message ?? "Please check your payment details.");

      let prepared: PreparedReservationPayment;
      try { prepared = await prepare(formRef.current); }
      catch (cause) {
        // The prepare callback exposes the reservation API's customer-facing validation errors.
        throw new PaymentMessage(cause instanceof Error ? cause.message : "We couldn’t prepare your reservation. Please try again.");
      }
      if (!active.current) return;
      if (prepared.kind === "redirect") {
        const destination = new URL(prepared.url, window.location.origin);
        if (destination.origin !== window.location.origin && !(destination.protocol === "https:" && destination.hostname === "checkout.stripe.com")) {
          throw new PaymentMessage("We couldn’t verify the checkout destination. Please try again.");
        }
        navigating = true;
        window.location.assign(destination.href);
        return;
      }
      if (prepared.email !== submittedEmail) throw new PaymentMessage("Your email changed. Please review your details and try again.");

      let entry = checkoutCache.get(prepared.clientSecret);
      if (!entry) {
        entry = {
          sdk: stripe.initCheckoutElementsSdk({
            clientSecret: prepared.clientSecret,
            adaptivePricing: { allowed: false },
            elementsOptions: { appearance, savedPaymentMethod: { enableSave: "never" } },
          }),
          actions: null,
        };
        checkoutCache.set(prepared.clientSecret, entry);
      }
      if (!entry.actions) {
        const cachedEntry = entry;
        entry.actions = entry.sdk.loadActions().then((result) => {
          if (result.type === "error") throw new PaymentMessage(result.error.message);
          return result.actions;
        }).catch((cause: unknown) => {
          cachedEntry.actions = null;
          throw cause;
        });
      }
      const actions = await entry.actions;
      if (!active.current) return;
      const checkout = actions.getSession();
      // The server also verifies Checkout mode, references and consent before releasing its secret.
      if (checkout.id !== prepared.sessionId
        || checkout.currency.toLowerCase() !== reservation.currency
        || checkout.total.total.minorUnitsAmount !== reservation.amount
        || checkout.minorUnitsAmountDivisor !== 100
        || checkout.email?.trim().toLowerCase() !== submittedEmail) {
        throw new PaymentMessage("The payment details couldn’t be verified. Please try again.");
      }
      const completionPath = `/reserve/complete?session_id=${encodeURIComponent(prepared.sessionId)}`;
      if (checkout.status.type === "complete") {
        navigating = true;
        window.location.assign(completionPath);
        return;
      }
      if (checkout.status.type !== "open") throw new PaymentMessage("This checkout has expired. Refresh the page to start a new reservation.");

      // Stripe requires the live total to be read and shown before confirmation.
      const liveAmountLabel = new Intl.NumberFormat("en-GB", {
        style: "currency", currency: checkout.currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
      }).format(checkout.total.total.minorUnitsAmount / checkout.minorUnitsAmountDivisor);
      flushSync(() => setAmountLabel(liveAmountLabel));
      onConfirmationStart();
      const result = await actions.confirm({ paymentMethod: method.paymentMethod.id, redirect: "if_required" });
      if (!active.current) return;
      if (result.type === "error") throw new PaymentMessage(result.error.message);
      // Only the server and signed webhooks determine whether this reservation is paid.
      navigating = true;
      window.location.assign(completionPath);
      return;
    } catch (cause) {
      navigating = false;
      const message = cause instanceof PaymentMessage
        ? cause.message
        : "We couldn’t confirm your payment. Check your connection and try again; we’ll reuse this checkout.";
      if (active.current) setError(message);
      failWallet(walletEvent, message);
    } finally {
      if (!navigating) releaseBusy();
    }
  }

  const loadingError = scriptFailed ? "Secure payment couldn’t load. Check your connection and try again." : paymentLoadError;
  const busy = submitting || walletOpen;

  return (
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void submitPayment(); }} noValidate aria-label="Reservation details and payment" aria-busy={submitting} className={styles.form}>
      {details}
      <section aria-labelledby={`${id}-heading`} className={styles.paymentSection}>
        <h3 id={`${id}-heading`} className={styles.heading}>Payment details</h3>
        {!scriptFailed && <>
          <div className={walletsAvailable ? styles.wallets : styles.walletsHidden} inert={submitting || undefined}>
            <ExpressCheckoutElement
              options={{
                buttonHeight: 52,
                buttonTheme: { applePay: "white", googlePay: "white", paypal: "white" },
                buttonType: { applePay: "check-out", googlePay: "checkout" },
                layout: { maxColumns: 1, maxRows: 0, overflow: "never" },
                paymentMethods: { applePay: "auto", googlePay: "auto", amazonPay: "never", klarna: "never" },
              }}
              onReady={({ availablePaymentMethods }) => {
                if (!hasAvailabilityEvent.current) setWalletsAvailable(Object.values(availablePaymentMethods ?? {}).some(Boolean));
              }}
              onAvailablePaymentMethodsChange={({ paymentMethods }) => {
                hasAvailabilityEvent.current = true;
                setWalletsAvailable(Object.values(paymentMethods ?? {}).some((method) => method?.available));
              }}
              onLoadError={() => setWalletsAvailable(false)}
              onClick={(event) => {
                if (inFlight.current || walletPending.current) { event.reject(); return; }
                const message = validate();
                if (message) { setError(message); event.reject(); return; }
                setError(null);
                walletPending.current = true;
                setWalletOpen(true);
                onBusyChange(true);
                event.resolve();
              }}
              onCancel={() => { if (!inFlight.current) releaseBusy(); }}
              onConfirm={(event) => { void submitPayment(event); }}
            />
          </div>
          {walletsAvailable && <div className={styles.divider}><span>Or choose another payment method</span></div>}
          <div inert={busy || undefined}>
            <PaymentElement
              options={{ layout: "accordion", wallets: { applePay: "never", googlePay: "never", link: "never" } }}
              onReady={() => { setPaymentReady(true); setPaymentLoadError(null); }}
              onLoadError={({ error: loadError }) => {
                setPaymentReady(false);
                setPaymentLoadError(loadError.message ?? "Payment fields couldn’t load. Please try again.");
              }}
            />
          </div>
        </>}
        {!paymentReady && !loadingError && <p role="status" className={styles.loading}>Loading secure payment…</p>}
        {loadingError && <div className={styles.loadError}>
          <p role="alert" className={styles.error}>{loadingError}</p>
          <button type="button" onClick={onReload} disabled={busy} className={styles.retry}>Try loading payment again</button>
        </div>}
      </section>
      <div className={styles.total}><span>Due today</span><strong>{amountLabel}</strong></div>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
      {submitting && <p className="sr-only" role="status">Confirming your reservation payment.</p>}
      <button type="submit" data-cta="reserve" disabled={busy || !stripe || !elements || !paymentReady || Boolean(loadingError)} className={styles.button}>
        {submitting ? <><span className={styles.spinner} aria-hidden="true" />Confirming…</> : "Reserve now"}
      </button>
      <p className={styles.secureNote}>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M7 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        Secure payment with Stripe
      </p>
    </form>
  );
}
