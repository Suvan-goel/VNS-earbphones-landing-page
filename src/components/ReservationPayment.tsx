"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js";
import type {
  Appearance,
  StripeCheckoutElementsSdkOptions,
  StripeExpressCheckoutElementConfirmEvent,
} from "@stripe/stripe-js";
import type { ExpectedDeposit } from "./InlineReservationPayment";
import styles from "./ReservationPayment.module.css";

type ReservationPaymentProps = {
  publishableKey: string;
  clientSecret: string;
  sessionId: string;
  email: string;
  expected: ExpectedDeposit;
  onEditDetails?: () => void;
};

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

/** Stripe retains card details; this component only holds this checkout's client secret in memory. */
export function ReservationPayment(props: ReservationPaymentProps) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hasAttemptedPayment, setHasAttemptedPayment] = useState(false);
  const confirmationStarted = useRef(false);

  return (
    <PaymentProvider
      key={`${props.sessionId}:${loadAttempt}`}
      {...props}
      onEditDetails={!hasAttemptedPayment && props.onEditDetails ? () => {
        if (!confirmationStarted.current) props.onEditDetails?.();
      } : undefined}
      onConfirmationStart={() => {
        confirmationStarted.current = true;
        setHasAttemptedPayment(true);
      }}
      onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
    />
  );
}

function PaymentProvider({ publishableKey, clientSecret, onRetry, ...props }: ReservationPaymentProps & { onRetry: () => void; onConfirmationStart: () => void }) {
  const [scriptFailed, setScriptFailed] = useState(false);
  const stripePromise = useMemo(() => loadStripe(publishableKey).catch(() => null), [publishableKey]);
  const options = useMemo<StripeCheckoutElementsSdkOptions>(() => ({
    clientSecret,
    adaptivePricing: { allowed: false },
    elementsOptions: {
      appearance,
      loader: "auto",
      savedPaymentMethod: { enableSave: "never" },
    },
  }), [clientSecret]);

  useEffect(() => {
    let active = true;
    void stripePromise.then((stripe) => { if (active && !stripe) setScriptFailed(true); });
    return () => { active = false; };
  }, [stripePromise]);

  if (scriptFailed) {
    return <PaymentLoadError message="Secure payment couldn’t load. Check your connection and try again." onRetry={onRetry} />;
  }

  return (
    <CheckoutElementsProvider stripe={stripePromise} options={options}>
      <PaymentForm {...props} onRetry={onRetry} />
    </CheckoutElementsProvider>
  );
}

function PaymentLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.loadError}>
      <p role="alert" className={styles.error}>{message}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>Try loading payment again</button>
    </div>
  );
}

function PaymentForm({ sessionId, email, expected, onEditDetails, onRetry, onConfirmationStart }: Pick<ReservationPaymentProps, "sessionId" | "email" | "expected" | "onEditDetails"> & { onRetry: () => void; onConfirmationStart: () => void }) {
  const checkoutState = useCheckoutElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [walletsAvailable, setWalletsAvailable] = useState(false);
  const [paymentLoadError, setPaymentLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const completionPath = `/reserve/complete?session_id=${encodeURIComponent(sessionId)}`;

  useEffect(() => { if (checkoutState.type === "success") headingRef.current?.focus(); }, [checkoutState.type]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    // The return page verifies the session with the server. It does not trust browser payment state.
    if (checkoutState.type === "success" && checkoutState.checkout.id === sessionId && checkoutState.checkout.status.type === "complete") {
      window.location.replace(completionPath);
    }
  }, [checkoutState, completionPath, sessionId]);

  if (checkoutState.type === "error") {
    return <PaymentLoadError message={checkoutState.error.message} onRetry={onRetry} />;
  }

  if (checkoutState.type === "loading") {
    return <p role="status" className={styles.loading}><span className={styles.spinner} aria-hidden="true" />Loading secure payment…</p>;
  }

  const { checkout } = checkoutState;
  const total = checkout.total.total;
  const amountMatches = checkout.id === sessionId
    && checkout.currency.toLowerCase() === expected.currency
    && total.minorUnitsAmount === expected.amount
    && checkout.minorUnitsAmountDivisor === 100;
  // Reading and displaying the live Checkout total is also required by Stripe before confirm().
  const amountLabel = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: checkout.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(total.minorUnitsAmount / checkout.minorUnitsAmountDivisor);
  const sessionOpen = checkout.status.type === "open";
  const readyToConfirm = amountMatches && sessionOpen && checkout.canConfirm;

  async function confirmPayment(expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent) {
    if (inFlight.current) return;
    // A wallet supplies its own payment details, so empty card fields must not block it.
    if (!amountMatches || !sessionOpen || (!expressCheckoutConfirmEvent && !checkout.canConfirm)) {
      const message = "This payment isn’t ready. Please reload the payment form and try again.";
      setError(message);
      expressCheckoutConfirmEvent?.paymentFailed({ reason: "fail", message });
      return;
    }
    inFlight.current = true;
    // Keep details locked even if confirmation has an uncertain result or payment reloads.
    onConfirmationStart();
    setSubmitting(true);
    setError(null);
    try {
      const result = await checkout.confirm({
        redirect: "if_required",
        ...(expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : {}),
      });
      if (result.type === "error") {
        setError(result.error.message);
        expressCheckoutConfirmEvent?.paymentFailed({ reason: "fail", message: result.error.message });
      } else {
        window.location.assign(completionPath);
        return;
      }
    } catch {
      const message = "We couldn’t confirm your payment. Check your connection and try again; we’ll reuse this checkout.";
      setError(message);
      expressCheckoutConfirmEvent?.paymentFailed({ reason: "fail", message });
    }
    inFlight.current = false;
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); void confirmPayment(); }}
      aria-labelledby={`${id}-heading`}
      aria-busy={submitting}
      className={styles.form}
    >
      <div className={styles.details}>
        <div>
          <span className={styles.detailsLabel}>Email address</span>
          <span className={styles.email}>{email}</span>
        </div>
        {onEditDetails && sessionOpen && <button type="button" disabled={submitting} onClick={onEditDetails} className={styles.edit}>Edit</button>}
      </div>

      <h3 id={`${id}-heading`} ref={headingRef} tabIndex={-1} className={styles.heading}>Payment details</h3>
      {!amountMatches ? (
        <PaymentLoadError message="The payment amount couldn’t be verified. Reload payment before continuing." onRetry={onRetry} />
      ) : !sessionOpen ? (
        <p role="alert" className={styles.error}>{checkout.status.type === "expired" ? "This checkout has expired. Refresh the page to start a new reservation." : "Checking your reservation…"}</p>
      ) : (
        <>
          <div className={walletsAvailable ? styles.wallets : styles.walletsHidden} inert={submitting || undefined}>
            <ExpressCheckoutElement
              options={{ buttonHeight: 52, buttonTheme: { applePay: "white", googlePay: "white" }, buttonType: { applePay: "check-out", googlePay: "checkout" }, layout: { maxColumns: 2, maxRows: 2 }, paymentMethodOrder: ["apple_pay", "google_pay", "link"], paymentMethods: { applePay: "auto", googlePay: "auto" } }}
              onReady={({ availablePaymentMethods }) => setWalletsAvailable(Object.values(availablePaymentMethods ?? {}).some(Boolean))}
              onAvailablePaymentMethodsChange={({ paymentMethods }) => setWalletsAvailable(Object.values(paymentMethods ?? {}).some((method) => method?.available))}
              onLoadError={() => setWalletsAvailable(false)}
              onConfirm={(event) => { void confirmPayment(event); }}
            />
          </div>
          {walletsAvailable && <div className={styles.divider}><span>Or choose another payment method</span></div>}

          <PaymentElement
            options={{ layout: "accordion", readOnly: submitting }}
            onReady={() => { setPaymentReady(true); setPaymentLoadError(null); }}
            onLoadError={({ error: stripeError }) => {
              setPaymentReady(false);
              setPaymentLoadError(stripeError.message ?? "Payment fields couldn’t load. Please try again.");
            }}
          />
          {paymentLoadError && <PaymentLoadError message={paymentLoadError} onRetry={onRetry} />}

          <div className={styles.total}><span>Due today</span><strong>{amountLabel}</strong></div>
          <div aria-live="polite">
            {error && <p ref={errorRef} tabIndex={-1} className={styles.error} role="alert">{error}</p>}
            {submitting && <p className="sr-only">Confirming your reservation payment.</p>}
          </div>
          <button type="submit" className={styles.button} disabled={submitting || !paymentReady || !readyToConfirm}>
            {submitting ? <><span className={styles.spinner} aria-hidden="true" />Confirming…</> : `Reserve for ${amountLabel}`}
          </button>
          <p className={styles.secureNote}>
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeLinecap="round" /></svg>
            Secure payment with Stripe
          </p>
        </>
      )}
    </form>
  );
}
