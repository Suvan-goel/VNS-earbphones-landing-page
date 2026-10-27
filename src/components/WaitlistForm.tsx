"use client";

import { useEffect, useId, useRef, useState } from "react";
import { defaultVariant, heroVariants, reservation, survey } from "@/config/site";
import { getAttribution, track } from "@/lib/analytics";
import { trackMetaLead } from "@/lib/meta-pixel";
import styles from "./WaitlistForm.module.css";

type Mode = "supabase" | "file" | "demo";
type Phase =
  | { k: "idle" }
  | { k: "submitting" }
  | { k: "redirecting" }
  | { k: "error"; message: string }
  | { k: "created"; token: string | null }
  | { k: "demo" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function WaitlistForm({
  mode,
  variant,
  cta,
  placement = "early_access",
  redirectToReservation = true,
}: {
  mode: Mode;
  variant: string;
  cta: string;
  placement?: "hero" | "early_access";
  /** Continue to the reservation page after a saved signup. */
  redirectToReservation?: boolean;
}) {
  const compact = placement === "hero";
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const startedAt = useRef(0);
  const inFlight = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    startedAt.current = Date.now();
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        inFlight.current = false;
        setPhase({ k: "idle" });
      }
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  const invalid = touched && !EMAIL_RE.test(email.trim());

  function openReservation() {
    // Keep the email out of URLs and reuse the reservation form's short-lived prefill.
    try {
      sessionStorage.setItem("cymba.reservation-prefill", JSON.stringify({ email: email.trim().toLowerCase(), savedAt: Date.now() }));
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
    const selectedVariant = Object.hasOwn(heroVariants, variant) ? variant : defaultVariant;
    setPhase({ k: "redirecting" });
    window.location.assign(`${reservation.path}?v=${encodeURIComponent(selectedVariant)}`);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    setTouched(true);
    if (!EMAIL_RE.test(email.trim())) {
      setPhase({ k: "error", message: "Please enter a valid email address." });
      return;
    }
    const company = (new FormData(e.currentTarget).get("company") as string) ?? "";
    inFlight.current = true;
    setPhase({ k: "submitting" });
    track("waitlist_submit_attempt", { location: placement });

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          researchOptIn: false,
          company,
          startedAt: startedAt.current,
          variant,
          attribution: getAttribution(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string; surveyToken?: string };
      if (res.ok && data.status === "created" && data.surveyToken) {
        track("waitlist_signup_success", { location: placement, research_opt_in: false });
        // Give a consented conversion a bounded opportunity to dispatch before
        // leaving this document. Tracking failure must never block signup.
        await trackMetaLead(res.status, data);
        if (redirectToReservation) {
          openReservation();
          return;
        }
        setPhase({ k: "created", token: data.surveyToken });
      } else if (res.ok && data.status === "duplicate") {
        track("waitlist_signup_duplicate", { location: placement });
        if (redirectToReservation) {
          openReservation();
          return;
        }
        setPhase({ k: "created", token: null });
      } else if (res.ok && data.status === "demo") {
        setPhase({ k: "demo" });
      } else {
        track("waitlist_signup_error", { location: placement, code: res.status });
        setPhase({ k: "error", message: data.message ?? "Something went wrong. Please try again." });
      }
    } catch {
      track("waitlist_signup_error", { location: placement, code: 0 });
      setPhase({ k: "error", message: "We couldn't reach our server. Check your connection and try again." });
    }
    inFlight.current = false;
  }

  useEffect(() => {
    if (phase.k !== "idle" && phase.k !== "submitting" && phase.k !== "redirecting") statusRef.current?.focus();
  }, [phase.k]);

  if (phase.k === "created" || phase.k === "demo") {
    return (
      <div ref={statusRef} tabIndex={-1} className="outline-none">
        <Confirmation demo={phase.k === "demo"} compact={compact} />
        {!compact && (phase.k === "demo" || phase.token) && <Survey token={phase.k === "created" ? phase.token : null} demo={phase.k === "demo"} />}
      </div>
    );
  }

  const busy = phase.k === "submitting" || phase.k === "redirecting";
  const errId = `${id}-err`;
  const noteId = `${id}-note`;
  const showNote = mode === "demo";
  const descriptionId = [phase.k === "error" ? errId : null, showNote ? noteId : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate aria-label={cta} aria-busy={busy}>
      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>
      <div className={styles.controls} data-placement={placement} data-invalid={invalid || undefined}>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email address"
          required
          maxLength={254}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (phase.k === "error") setPhase({ k: "idle" });
          }}
          onBlur={() => email && setTouched(true)}
          aria-invalid={invalid || undefined}
          aria-describedby={descriptionId}
          disabled={busy}
          className={styles.input}
        />
        <button
          type="submit"
          data-cta={placement}
          disabled={busy}
          className={styles.button}
        >
          {busy ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-paper/25 border-t-paper" aria-hidden="true" />
              {phase.k === "redirecting" ? "Continuing…" : "Joining…"}
            </>
          ) : (
            cta
          )}
        </button>
      </div>

      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="px-1" aria-live="polite">
        {phase.k === "redirecting" && <p className="sr-only">You’re on the waitlist. Opening device reservations.</p>}
        {phase.k === "error" && (
          <p id={errId} ref={statusRef} tabIndex={-1} className="mt-2 text-sm text-[var(--form-error)] outline-none">
            {phase.message}
          </p>
        )}
      </div>

      {showNote && (
        <p id={noteId} className="mt-3 text-center text-xs leading-relaxed text-muted">
          <DemoNotice compact={compact} />
        </p>
      )}
    </form>
  );
}

/* Development only: shown while no backend is connected. One quiet line, not a box. */
function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <span className="block mt-1">
      {compact ? "Preview only. Email addresses aren’t saved yet." : "Demonstration mode: no backend is connected, so emails entered here are not saved."}
    </span>
  );
}

function Confirmation({ demo, compact = false }: { demo: boolean; compact?: boolean }) {
  return (
    <div role="status" className={compact ? styles.confirmation : "mb-8"}>
      <p className="eyebrow">{demo ? "Demonstration mode" : "You’re on the list"}</p>
      <p className={`mt-2 font-normal tracking-[-0.04em] text-ivory ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}>
        {demo ? "Form works. Nothing was saved." : "You’re on the launch list."}
      </p>
      <p className="mt-3 max-w-lg text-muted">
        {demo
          ? compact
            ? "This preview isn’t saving email addresses yet."
            : "No backend is connected yet, so your email was not stored. Connect Supabase to start collecting signups. You can still try the optional survey below."
          : compact
            ? "We’ll be in touch with launch news and first access."
            : "One more thing, if you have a moment:"}
      </p>
    </div>
  );
}

const steps = ["interest", "intent", "price", "role", "concern"] as const;
type Step = (typeof steps)[number];
type Answers = Partial<Record<Step, string>>;

function Survey({ token, demo }: { token: string | null; demo: boolean }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [state, setState] = useState<"open" | "sending" | "saved" | "demo" | "skipped" | "error">("open");
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const step = steps[i];

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
  }, [i]);

  const choose = (k: Step, v: string) => {
    setAnswers((a) => ({ ...a, [k]: v }));
    setTimeout(() => setI((n) => Math.min(n + 1, steps.length - 1)), 260);
  };

  async function send() {
    setState("sending");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
      if (data.status === "saved" || data.status === "demo") {
        track("survey_completed", {
          interest: answers.interest ?? null,
          intent: answers.intent ?? null,
          price: answers.price ?? null,
          role: answers.role ?? null,
        });
        setState(data.status);
      } else {
        setError(data.message ?? "We couldn't save your answers.");
        setState("error");
      }
    } catch {
      setError("We couldn't reach our server. Please try again.");
      setState("error");
    }
  }

  if (state === "saved" || state === "demo" || state === "skipped") {
    return (
      <div role="status" className="rounded-2xl border border-[var(--line)] bg-surface p-6 sm:p-8">
        <p className="text-2xl font-normal tracking-[-0.035em] text-ivory">
          {state === "saved" ? "Thank you. That genuinely helps." : state === "demo" ? "Survey complete (not saved)." : "No problem."}
        </p>
        <p className="mt-2 text-muted">
          {state === "saved"
            ? "Your feedback helps shape what comes next."
            : state === "demo"
              ? "In demonstration mode answers are discarded. With a backend connected they are stored against the signup."
              : demo
                ? "Nothing was saved in demonstration mode."
                : "You’re on the list."}
        </p>
      </div>
    );
  }

  const q = step === "concern" ? null : survey[step];
  return (
    <div ref={panel} className="rounded-2xl border border-[var(--line)] bg-surface p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">
          Optional · {i + 1} of {steps.length}
        </p>
        <button
          type="button"
          onClick={() => {
            track("survey_skipped", { at_step: step });
            setState("skipped");
          }}
          className="text-sm text-muted underline-offset-4 hover:text-ivory hover:underline"
        >
          Skip survey
        </button>
      </div>
      <div className="mt-4 h-px w-full bg-[var(--line)]">
        <div className="h-px bg-rose transition-[width] duration-500 ease-out-expo" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>

      {q ? (
        <fieldset className="mt-6" key={step}>
          <legend className="text-xl font-normal leading-snug tracking-[-0.03em] text-ivory sm:text-2xl">{q.question}</legend>
          {step === "price" && <p className="mt-2 text-sm text-muted">For research only. No price has been set.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {q.options.map((o) => (
              <label key={o.value} className="chip relative cursor-pointer">
                <input type="radio" name={step} value={o.value} checked={answers[step] === o.value} onChange={() => choose(step, o.value)} />
                <span className="inline-flex min-h-11 items-center rounded-full border border-[var(--line-strong)] px-4 text-[0.92rem] text-ivory-soft hover:border-ivory/40">
                  {o.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="mt-6">
          <label htmlFor="survey-concern" className="text-xl font-normal leading-snug tracking-[-0.03em] text-ivory sm:text-2xl">
            {survey.concern.question}
          </label>
          <textarea
            id="survey-concern"
            rows={3}
            maxLength={survey.concern.maxLength}
            placeholder={survey.concern.placeholder}
            value={answers.concern ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, concern: e.target.value }))}
            className="mt-4 w-full resize-none rounded-2xl border border-[var(--line-strong)] bg-transparent p-4 text-ivory placeholder:text-faint/70 focus:border-ivory/40 focus:outline-none"
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
          className="text-sm text-muted hover:text-ivory disabled:invisible"
        >
          Back
        </button>
        {step === "concern" ? (
          <button
            type="button"
            onClick={send}
            disabled={state === "sending"}
            className="inline-flex h-11 items-center rounded-xl bg-ivory px-5 text-sm font-medium text-paper hover:bg-[var(--btn-hover)] disabled:cursor-progress disabled:opacity-70"
          >
            {state === "sending" ? "Sending…" : "Send answers"}
          </button>
        ) : (
          <button type="button" onClick={() => setI((n) => n + 1)} className="text-sm text-muted hover:text-ivory">
            {answers[step] ? "Next" : "Skip question"}
          </button>
        )}
      </div>
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-[var(--form-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
