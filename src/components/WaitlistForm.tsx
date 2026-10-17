"use client";

import { useEffect, useId, useRef, useState } from "react";
import { site, survey } from "@/config/site";
import { getAttribution, track } from "@/lib/analytics";

type Mode = "supabase" | "file" | "demo";
type Phase =
  | { k: "idle" }
  | { k: "submitting" }
  | { k: "error"; message: string }
  | { k: "created"; token: string }
  | { k: "duplicate" }
  | { k: "demo" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function WaitlistForm({ mode, variant, cta }: { mode: Mode; variant: string; cta: string }) {
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [email, setEmail] = useState("");
  const [researchOptIn, setResearchOptIn] = useState(false);
  const [touched, setTouched] = useState(false);
  const startedAt = useRef(0);
  const statusRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const invalid = touched && !EMAIL_RE.test(email.trim());

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!EMAIL_RE.test(email.trim())) {
      setPhase({ k: "error", message: "Please enter a valid email address." });
      return;
    }
    const company = (new FormData(e.currentTarget).get("company") as string) ?? "";
    setPhase({ k: "submitting" });
    track("waitlist_submit_attempt", { location: "early_access" });

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          researchOptIn,
          company,
          startedAt: startedAt.current,
          variant,
          attribution: getAttribution(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string; surveyToken?: string };
      if (data.status === "created" && data.surveyToken) {
        track("waitlist_signup_success", { research_opt_in: researchOptIn });
        setPhase({ k: "created", token: data.surveyToken });
      } else if (data.status === "duplicate") {
        track("waitlist_signup_duplicate");
        setPhase({ k: "duplicate" });
      } else if (data.status === "demo") {
        setPhase({ k: "demo" });
      } else {
        track("waitlist_signup_error", { code: res.status });
        setPhase({ k: "error", message: data.message ?? "Something went wrong. Please try again." });
      }
    } catch {
      track("waitlist_signup_error", { code: 0 });
      setPhase({ k: "error", message: "We couldn't reach our server. Check your connection and try again." });
    }
  }

  useEffect(() => {
    if (phase.k !== "idle" && phase.k !== "submitting") statusRef.current?.focus();
  }, [phase.k]);

  if (phase.k === "created" || phase.k === "demo") {
    return (
      <div ref={statusRef} tabIndex={-1} className="outline-none">
        <Confirmation demo={phase.k === "demo"} />
        <Survey token={phase.k === "created" ? phase.token : null} demo={phase.k === "demo"} />
      </div>
    );
  }

  if (phase.k === "duplicate") {
    return (
      <div ref={statusRef} tabIndex={-1} className="rounded-3xl border border-[var(--line)] bg-black/20 p-6 outline-none sm:p-8" role="status">
        <p className="eyebrow">Already on the list</p>
        <p className="mt-3 text-2xl font-normal tracking-[-0.035em] text-ivory">You&rsquo;re already signed up with that email.</p>
        <p className="mt-2 text-muted">No need to do anything else. We&rsquo;ll be in touch as {site.product} develops.</p>
      </div>
    );
  }

  const busy = phase.k === "submitting";
  const errId = `${id}-err`;

  return (
    <form onSubmit={onSubmit} noValidate aria-describedby={phase.k === "error" ? errId : undefined}>
      <p className="mb-5 px-1 text-sm text-muted sm:px-4">No payment. No commitment. Just your email.</p>
      {mode === "demo" && <DemoNotice />}
      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>
      <div
        className={`flex flex-col gap-2 rounded-[1.75rem] border bg-black/25 p-2 transition-colors focus-within:border-ivory/40 sm:flex-row sm:items-center sm:rounded-full ${
          invalid ? "border-rose/70" : "border-[var(--line-strong)]"
        }`}
      >
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (phase.k === "error") setPhase({ k: "idle" });
          }}
          onBlur={() => email && setTouched(true)}
          aria-invalid={invalid || undefined}
          disabled={busy}
          className="h-12 min-w-0 flex-1 bg-transparent px-4 text-[1.02rem] text-ivory placeholder:text-faint/70 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy}
          className="relative inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ivory px-6 text-[0.95rem] font-medium text-[#141414] transition-colors hover:bg-[#fffaf0] disabled:cursor-progress"
        >
          {busy ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-[#141414]/25 border-t-[#141414]" aria-hidden="true" />
              Joining…
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

      <div className="mt-3 min-h-6 px-4" aria-live="polite">
        {phase.k === "error" && (
          <p id={errId} ref={statusRef} tabIndex={-1} className="text-sm text-[#f0a58c] outline-none">
            {phase.message}
          </p>
        )}
      </div>

      <label className="mt-2 flex cursor-pointer items-start gap-3 px-4 text-sm leading-relaxed text-muted">
        <input
          type="checkbox"
          checked={researchOptIn}
          onChange={(e) => setResearchOptIn(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span>Optional: invite me to prototype testing and research studies.</span>
      </label>
      <p className="mt-3 px-4 text-xs leading-relaxed text-faint">
        We&rsquo;ll email you development updates and availability news. Unsubscribe any time. See our{" "}
        <a href="/privacy" className="underline underline-offset-2 hover:text-ivory-soft">
          privacy notice
        </a>
        .
      </p>
    </form>
  );
}

function DemoNotice() {
  return (
    <p className="mb-4 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--line-strong)] px-4 py-3 text-[0.8rem] leading-relaxed text-muted">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose" aria-hidden="true" />
      <span>
        <strong className="font-medium text-ivory-soft">Demonstration mode.</strong> No backend is connected, so emails entered here
        are not saved.
      </span>
    </p>
  );
}

function Confirmation({ demo }: { demo: boolean }) {
  return (
    <div role="status" className="mb-8">
      <p className="eyebrow">{demo ? "Demonstration mode" : "You’re on the list"}</p>
      <p className="mt-3 text-3xl font-normal tracking-[-0.04em] text-ivory sm:text-4xl">
        {demo ? "Form works. Nothing was saved." : "Welcome to early access."}
      </p>
      <p className="mt-3 max-w-lg text-muted">
        {demo
          ? "No backend is connected yet, so your email was not stored. Connect Supabase to start collecting signups. You can still try the optional survey below."
          : "We’ll be in touch with updates as we build. One more thing, if you have a moment:"}
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
      <div role="status" className="rounded-3xl border border-[var(--line)] bg-black/20 p-6 sm:p-8">
        <p className="text-2xl font-normal tracking-[-0.035em] text-ivory">
          {state === "saved" ? "Thank you. That genuinely helps." : state === "demo" ? "Survey complete (not saved)." : "No problem."}
        </p>
        <p className="mt-2 text-muted">
          {state === "saved"
            ? "Your answers are stored with your signup and will directly shape what we build first."
            : state === "demo"
              ? "In demonstration mode answers are discarded. With a backend connected they are stored against the signup."
              : demo
                ? "Nothing was saved in demonstration mode."
                : "You’re still on the list. We’ll be in touch."}
        </p>
      </div>
    );
  }

  const q = step === "concern" ? null : survey[step];
  return (
    <div ref={panel} className="rounded-3xl border border-[var(--line)] bg-black/20 p-6 sm:p-8">
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
            className="inline-flex h-11 items-center rounded-full bg-ivory px-5 text-sm font-medium text-[#141414] hover:bg-[#fffaf0] disabled:cursor-progress disabled:opacity-70"
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
        <p role="alert" className="mt-3 text-sm text-[#f0a58c]">
          {error}
        </p>
      )}
    </div>
  );
}
