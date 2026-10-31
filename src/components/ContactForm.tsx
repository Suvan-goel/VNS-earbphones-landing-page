"use client";

import { useEffect, useId, useRef, useState } from "react";
import { site } from "@/config/site";
import styles from "./ContactForm.module.css";

type Fields = { name: string; email: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;
type Phase = { kind: "idle" | "submitting" | "sent" } | { kind: "error"; message: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ContactForm() {
  const id = useId();
  const [fields, setFields] = useState<Fields>({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);
  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => { startedAt.current = performance.now(); }, []);
  useEffect(() => {
    if (phase.kind === "sent" || phase.kind === "error") statusRef.current?.focus();
  }, [phase]);

  function update(field: keyof Fields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    submissionId.current = null;
    if (phase.kind === "error") setPhase({ kind: "idle" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const nextErrors: Errors = {};
    const name = fields.name.trim();
    const email = fields.email.trim();
    const message = fields.message.trim();
    if (name.length > 100) nextErrors.name = "Please use 100 characters or fewer.";
    if (email.length > 254 || !EMAIL_RE.test(email)) nextErrors.email = "Please enter a valid email address.";
    if (!message) nextErrors.message = "Please enter your message.";
    else if (message.length > 5000) nextErrors.message = "Please use 5,000 characters or fewer.";
    setErrors(nextErrors);
    const firstInvalid = (Object.keys(nextErrors) as (keyof Fields)[])[0];
    if (firstInvalid) {
      const field = formRef.current?.elements.namedItem(firstInvalid);
      if (field instanceof HTMLElement) field.focus();
      return;
    }

    const company = new FormData(event.currentTarget).get("company") ?? "";
    inFlight.current = true;
    setPhase({ kind: "submitting" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 40_000);
    try {
      // Reuse this identifier if delivery succeeded but its response was lost.
      submissionId.current ??= crypto.randomUUID();
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, company, elapsedMs: performance.now() - startedAt.current, submissionId: submissionId.current }),
        signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      const data = result && typeof result === "object" ? result as { status?: unknown; message?: unknown } : {};
      if (response.ok && data.status === "sent") {
        setPhase({ kind: "sent" });
      } else {
        setPhase({
          kind: "error",
          message: typeof data.message === "string" && data.message.trim().length > 0 && data.message.length <= 300
            ? data.message
            : "Your message couldn’t be sent. Please try again or email us directly.",
        });
      }
    } catch {
      setPhase({ kind: "error", message: "We couldn’t confirm your message was sent. Please try again or email us directly." });
    } finally {
      window.clearTimeout(timeout);
      inFlight.current = false;
    }
  }

  if (phase.kind === "sent") {
    return (
      <div className={styles.success} ref={statusRef} role="status" tabIndex={-1}>
        <span className={styles.successIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 4 4L19 6" /></svg></span>
        <h2>Message sent.</h2>
        <p>Thanks for getting in touch. We’ll reply to your email.</p>
      </div>
    );
  }

  const submitting = phase.kind === "submitting";
  return (
    <form className={styles.form} ref={formRef} action="/api/contact" method="post" onSubmit={submit} noValidate aria-label="Contact cymba" aria-busy={submitting}>
      <div className={styles.group}>
        <label className={styles.label} htmlFor={`${id}-name`}>Name <span>(optional)</span></label>
        <input className={styles.field} id={`${id}-name`} name="name" autoComplete="name" maxLength={100} value={fields.name}
          onChange={(event) => update("name", event.target.value)} disabled={submitting}
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${id}-name-error` : undefined} />
        {errors.name && <p className={styles.fieldError} id={`${id}-name-error`}>{errors.name}</p>}
      </div>
      <div className={styles.group}>
        <label className={styles.label} htmlFor={`${id}-email`}>Email</label>
        <input className={styles.field} id={`${id}-email`} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          required maxLength={254} value={fields.email} onChange={(event) => update("email", event.target.value)} disabled={submitting}
          aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${id}-email-error` : undefined} />
        {errors.email && <p className={styles.fieldError} id={`${id}-email-error`}>{errors.email}</p>}
      </div>
      <div className={styles.group}>
        <label className={styles.label} htmlFor={`${id}-message`}>Message</label>
        <textarea className={`${styles.field} ${styles.message}`} id={`${id}-message`} name="message" required maxLength={5000} rows={5}
          value={fields.message} onChange={(event) => update("message", event.target.value)} disabled={submitting}
          aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? `${id}-message-error` : undefined} />
        {errors.message && <p className={styles.fieldError} id={`${id}-message-error`}>{errors.message}</p>}
      </div>
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={`${id}-company`}>Company</label>
        <input id={`${id}-company`} name="company" tabIndex={-1} autoComplete="off" />
      </div>
      {phase.kind === "error" && (
        <div className={styles.error} ref={statusRef} role="alert" tabIndex={-1}>
          <p>{phase.message}</p>
          <a href={`mailto:${site.contactEmail}`}>Email {site.contactEmail}</a>
        </div>
      )}
      <button className={`btn-primary ${styles.button}`} type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send message"}
        {!submitting && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>}
      </button>
      <p className={styles.privacy}>We’ll use your details to reply. <a href="/privacy">Privacy policy</a></p>
    </form>
  );
}
