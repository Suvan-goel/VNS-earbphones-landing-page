import "server-only";
import { promises as fs, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import type { ReservationEvent, ReservationEventResult, ReservationRow } from "./storage";

type LocalDatabase = { ready: Promise<PGlite>; release: () => void };
const localGlobal = globalThis as typeof globalThis & { __cymbaReservationDatabases?: Map<string, LocalDatabase> };
const databases = localGlobal.__cymbaReservationDatabases ??= new Map();
const dataPath = () => path.join(process.cwd(), ".data", "reservations-test-db");

/** This database must never become a fallback for live payments or a hosted deployment. */
function assertLocalTest() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (process.env.RESERVATIONS_LOCAL_TEST !== "true" || process.env.NODE_ENV === "production"
    || (key && !/^(?:[sr]k|rkcs)_test_/.test(key))) throw new Error("Local reservation testing is unavailable.");
}

/** PGlite is single-process. Refuse a second server using this directory. */
async function claimDatabase(directory: string): Promise<() => void> {
  const lockPath = `${directory}.lock`;
  const ownership = JSON.stringify({ pid: process.pid, token: randomUUID() });
  await fs.mkdir(path.dirname(directory), { recursive: true });
  let file;
  try { file = await fs.open(lockPath, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // Do not guess whether a previous process is safe to replace. The launcher can
    // remove a stale lock after confirming its owner has exited.
    throw new Error("The local reservation database is already open. Stop the other reservation server first.");
  }
  await file.writeFile(ownership);
  await file.close();
  const release = () => {
    try { if (readFileSync(lockPath, "utf8") === ownership) unlinkSync(lockPath); } catch { /* Already released. */ }
    process.removeListener("exit", release);
  };
  process.once("exit", release);
  return release;
}

async function localDatabase(): Promise<PGlite> {
  assertLocalTest();
  const directory = dataPath();
  const existing = databases.get(directory);
  if (existing) return existing.ready;
  const entry: LocalDatabase = { ready: undefined as unknown as Promise<PGlite>, release: () => undefined };
  // Retain one initialization promise across routes, concurrent requests, and development HMR.
  entry.ready = (async () => {
    entry.release = await claimDatabase(directory);
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(directory, { relaxedDurability: false });
    try {
      await db.exec(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
      end $$;`);
      // Execute the production schema and reducer, so local tests exercise the same transaction.
      const migration = await fs.readFile(path.join(process.cwd(), "supabase", "migrations", "20261025_paid_reservations.sql"), "utf8");
      await db.exec(migration);
      await db.exec(await fs.readFile(path.join(process.cwd(), "supabase", "migrations", "20261030_reservation_numbers.sql"), "utf8"));
      return db;
    } catch (error) { await db.close().catch(() => undefined); throw error; }
  })().catch((error) => {
    entry.release();
    databases.delete(directory);
    throw error;
  });
  databases.set(directory, entry);
  return entry.ready;
}

/** Used by local maintenance/tests; no HTTP route exposes the database. */
export async function closeLocalReservationDatabase(): Promise<void> {
  const directory = dataPath();
  const entry = databases.get(directory);
  if (!entry) return;
  try { await (await entry.ready).close(); }
  finally { entry.release(); databases.delete(directory); }
}

// PGlite returns timestamptz values as Dates; keep the existing storage contract's ISO strings.
const serializableRow = (row: ReservationRow): ReservationRow => JSON.parse(JSON.stringify(row)) as ReservationRow;

export async function lookupLocalReservation(field: "stripe_session_id" | "id" | "attempt_id", value: string): Promise<ReservationRow | null> {
  const db = await localDatabase();
  const result = await db.query<ReservationRow>(`select * from public.reservations where ${field} = $1 limit 1`, [value]);
  return result.rows[0] ? serializableRow(result.rows[0]) : null;
}

export async function createLocalReservation(row: ReservationRow & Record<string, unknown>): Promise<ReservationRow> {
  if (row.livemode) throw new Error("Local reservations must use test payments.");
  const db = await localDatabase();
  const fields = ["id", "attempt_id", "created_at", "email", "variant", "amount", "currency", "terms_version", "terms_accepted_at", "livemode",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "landing_path"];
  const result = await db.query<ReservationRow>(`insert into public.reservations (${fields.join(",")})
    values (${fields.map((_, i) => `$${i + 1}`).join(",")}) on conflict (attempt_id) do nothing returning *`, fields.map((field) => row[field]));
  const saved = result.rows[0] ?? await lookupLocalReservation("attempt_id", row.attempt_id);
  if (!saved) throw new Error("Local reservation was not stored.");
  return serializableRow(saved);
}

export async function attachLocalReservationSession(id: string, sessionId: string, expiresAt: number): Promise<boolean> {
  if (!sessionId.startsWith("cs_test_")) return false;
  const db = await localDatabase();
  const result = await db.query(`update public.reservations set stripe_session_id = $2, checkout_expires_at = $3
    where id = $1 and (stripe_session_id is null or stripe_session_id = $2) returning id`, [id, sessionId, new Date(expiresAt * 1000).toISOString()]);
  return result.rows.length === 1;
}

export async function applyLocalReservationEvent(event: ReservationEvent): Promise<ReservationEventResult> {
  if (event.livemode || (event.sessionId && !event.sessionId.startsWith("cs_test_"))) return "mismatch";
  const db = await localDatabase();
  const result = await db.query<{ result: ReservationEventResult }>(
    "select public.apply_reservation_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) as result",
    [event.eventId, event.eventType, event.reservationId, event.attemptId, event.termsVersion, event.sessionId,
      event.paymentIntent, event.customer, event.status, event.amount, event.currency, event.amountRefunded, event.livemode, event.occurredAt]);
  return result.rows[0]?.result ?? "unavailable";
}
