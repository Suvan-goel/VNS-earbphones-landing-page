export type ConsentChoice = "granted" | "denied" | null;
export type ConsentRecord = { choice: Exclude<ConsentChoice, null>; version: string; recordedAt: number };

export const ANALYTICS_CONSENT_VERSION = "analytics-2026-10-29-v2";
export const ADVERTISING_CONSENT_VERSION = "advertising-2026-10-29-v2";
export const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/** Old refusals remain refusals. An unversioned grant is never upgraded silently. */
export function consentChoice(raw: string | null, version: string): ConsentChoice {
  if (raw === "denied") return "denied";
  try {
    const record: unknown = JSON.parse(raw ?? "null");
    if (!record || typeof record !== "object") return null;
    const { choice, version: savedVersion, recordedAt } = record as Partial<ConsentRecord>;
    if (choice === "denied") return "denied";
    if (choice !== "granted" || savedVersion !== version || typeof recordedAt !== "number"
      || !Number.isFinite(recordedAt) || recordedAt > Date.now() || Date.now() - recordedAt > CONSENT_MAX_AGE_MS) return null;
    return "granted";
  } catch { return null; }
}

export function newConsentRecord(choice: Exclude<ConsentChoice, null>, version: string): string {
  return JSON.stringify({ choice, version, recordedAt: Date.now() } satisfies ConsentRecord);
}
