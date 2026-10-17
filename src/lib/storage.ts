import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Attribution, SurveyAnswers } from "./validation";

/**
 * Storage drivers for waitlist signups, survey answers and analytics events.
 *
 *  - "supabase": production. Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *    (server-only; never exposed to the browser). Schema: supabase/schema.sql.
 *  - "file":     local development only. Set WAITLIST_STORAGE=file to write
 *    JSON files under .data/. Not suitable for production or serverless.
 *  - "demo":     nothing configured. Nothing is stored and the UI says so.
 */
export type StorageMode = "supabase" | "file" | "demo";

export function storageMode(): StorageMode {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (process.env.WAITLIST_STORAGE === "file" && process.env.NODE_ENV !== "production") return "file";
  return "demo";
}

export type SignupInput = {
  email: string;
  researchOptIn: boolean;
  variant: string | null;
  attribution: Attribution;
};

export type SignupResult =
  | { status: "created"; surveyToken: string }
  | { status: "duplicate" }
  | { status: "demo" }
  | { status: "error"; message: string };

export type SurveyResult = { status: "saved" } | { status: "not_found" } | { status: "demo" } | { status: "error"; message: string };

/* ------------------------------- Supabase -------------------------------- */

function sb(pathname: string, init: RequestInit & { prefer?: string } = {}) {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${base}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    cache: "no-store",
  });
}

/* --------------------------------- File ---------------------------------- */

const DATA_DIR = path.join(process.cwd(), ".data");
type FileRow = Record<string, unknown> & { email: string; survey_token: string | null };

async function readFile<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), "utf8")) as T;
  } catch {
    return fallback;
  }
}
async function writeFile(name: string, data: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
}

/* -------------------------------- Public --------------------------------- */

export async function createSignup(input: SignupInput): Promise<SignupResult> {
  const mode = storageMode();
  if (mode === "demo") return { status: "demo" };

  const surveyToken = randomUUID();
  const row = {
    email: input.email,
    research_opt_in: input.researchOptIn,
    variant: input.variant,
    utm_source: input.attribution.utm_source ?? null,
    utm_medium: input.attribution.utm_medium ?? null,
    utm_campaign: input.attribution.utm_campaign ?? null,
    utm_term: input.attribution.utm_term ?? null,
    utm_content: input.attribution.utm_content ?? null,
    referrer: input.attribution.referrer ?? null,
    landing_path: input.attribution.landing_path ?? null,
    survey_token: surveyToken,
  };

  if (mode === "file") {
    const rows = await readFile<FileRow[]>("waitlist.json", []);
    if (rows.some((r) => r.email === input.email)) return { status: "duplicate" };
    rows.push({ ...row, id: randomUUID(), created_at: new Date().toISOString() });
    await writeFile("waitlist.json", rows);
    return { status: "created", surveyToken };
  }

  try {
    const res = await sb("waitlist", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
    if (res.status === 201 || res.status === 204) return { status: "created", surveyToken };
    if (res.status === 409) return { status: "duplicate" };
    const text = await res.text();
    if (text.includes("23505")) return { status: "duplicate" };
    console.error("[waitlist] supabase insert failed", res.status, text);
    return { status: "error", message: "We couldn't save your signup. Please try again." };
  } catch (err) {
    console.error("[waitlist] supabase unreachable", err);
    return { status: "error", message: "We couldn't reach our server. Please try again." };
  }
}

export async function saveSurvey(token: string, answers: SurveyAnswers): Promise<SurveyResult> {
  const mode = storageMode();
  if (mode === "demo") return { status: "demo" };

  const patch = {
    survey_interest: answers.interest,
    survey_intent: answers.intent,
    survey_price: answers.price,
    survey_role: answers.role,
    survey_concern: answers.concern,
    survey_completed_at: new Date().toISOString(),
    survey_token: null, // one submission per signup
  };

  if (mode === "file") {
    const rows = await readFile<FileRow[]>("waitlist.json", []);
    const row = rows.find((r) => r.survey_token === token);
    if (!row) return { status: "not_found" };
    Object.assign(row, patch);
    await writeFile("waitlist.json", rows);
    return { status: "saved" };
  }

  try {
    const res = await sb(`waitlist?survey_token=eq.${encodeURIComponent(token)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      prefer: "return=representation",
    });
    if (!res.ok) {
      console.error("[survey] supabase update failed", res.status, await res.text());
      return { status: "error", message: "We couldn't save your answers. Please try again." };
    }
    const rows = (await res.json()) as unknown[];
    return rows.length ? { status: "saved" } : { status: "not_found" };
  } catch (err) {
    console.error("[survey] supabase unreachable", err);
    return { status: "error", message: "We couldn't reach our server. Please try again." };
  }
}

export type EventRow = {
  name: string;
  session_id: string | null;
  variant: string | null;
  path: string | null;
  props: Record<string, string | number | boolean | null>;
  attribution: Attribution;
};

export async function storeEvents(events: EventRow[]): Promise<boolean> {
  const mode = storageMode();
  if (mode === "demo" || events.length === 0) return false;
  if (mode === "file") {
    const rows = await readFile<unknown[]>("events.json", []);
    rows.push(...events.map((e) => ({ ...e, created_at: new Date().toISOString() })));
    await writeFile("events.json", rows.slice(-5000));
    return true;
  }
  try {
    const res = await sb("events", { method: "POST", body: JSON.stringify(events), prefer: "return=minimal" });
    if (!res.ok) console.error("[events] supabase insert failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[events] supabase unreachable", err);
    return false;
  }
}
