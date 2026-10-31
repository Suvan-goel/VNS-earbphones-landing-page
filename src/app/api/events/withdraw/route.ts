import { NextResponse } from "next/server";
import { analyticsSessionHash, sameOriginAnalyticsRequest } from "@/lib/analytics-session";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/request-json";
import { storageUnavailable, withdrawAnalyticsSession } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (erased: boolean, status = 200) => NextResponse.json({ erased }, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export async function POST(request: Request) {
  if (!sameOriginAnalyticsRequest(request)) return reply(false, 403);
  if (!rateLimit(`analytics-withdraw:${clientKey(request)}`, 60, 60 * 1000)) return reply(false, 429);
  const parsed = await readJsonObject(request, 1024);
  if (parsed.response) {
    parsed.response.headers.set("Cache-Control", "private, no-store");
    return parsed.response;
  }
  const sessionHash = analyticsSessionHash(parsed.body.token, true);
  if (!sessionHash) return reply(false, 401);
  if (storageUnavailable()) return reply(false, 503);
  return await withdrawAnalyticsSession(sessionHash) ? reply(true) : reply(false, 503);
}
