import "server-only";
import { createHash } from "node:crypto";

export const ANALYTICS_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** A 256-bit capability is supplied only in JSON, never in URLs or stored rows.
 * Possession of a database session hash cannot authorise deletion or ingestion.
 * Expired capabilities can still erase their records, but cannot add new ones.
 */
export function analyticsSessionHash(token: unknown, allowExpired = false): string | null {
  if (typeof token !== "string" || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) return null;
  const issuedAt = Number(token.slice(0, 13));
  const age = Date.now() - issuedAt;
  if (age < -60_000 || (!allowExpired && age > ANALYTICS_SESSION_MAX_AGE_MS)) return null;
  return createHash("sha256").update(`cymba-analytics-v2:${token}`).digest("hex");
}

export function sameOriginAnalyticsRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  return !origin || origin === new URL(request.url).origin;
}
