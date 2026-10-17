import { survey } from "@/config/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Attribution = Partial<Record<UtmKey | "referrer" | "landing_path", string>>;

/** Keep only known attribution keys, trimmed to sane lengths. */
export function cleanAttribution(raw: unknown): Attribution {
  const out: Attribution = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of [...UTM_KEYS, "referrer", "landing_path"] as const) {
    const v = src[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 200);
  }
  return out;
}

const pick = <T extends readonly { value: string }[]>(opts: T, v: unknown) =>
  typeof v === "string" && opts.some((o) => o.value === v) ? v : null;

export type SurveyAnswers = {
  interest: string | null;
  intent: string | null;
  price: string | null;
  role: string | null;
  concern: string | null;
};

export function cleanSurvey(raw: unknown): SurveyAnswers {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const concern =
    typeof src.concern === "string" && src.concern.trim()
      ? src.concern.trim().slice(0, survey.concern.maxLength)
      : null;
  return {
    interest: pick(survey.interest.options, src.interest),
    intent: pick(survey.intent.options, src.intent),
    price: pick(survey.price.options, src.price),
    role: pick(survey.role.options, src.role),
    concern,
  };
}

export const variantIds = ["learn", "focus", "audio"] as const;
export function cleanVariant(v: unknown): string | null {
  return typeof v === "string" && (variantIds as readonly string[]).includes(v) ? v : null;
}
