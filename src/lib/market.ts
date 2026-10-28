import { headers } from "next/headers";
import { MARKET_COOKIE, defaultMarket, isMarket, marketForCountry, type Market } from "@/config/pricing";

/*
 * The hosted site runs on Cloudflare, which reports the visitor's country in
 * cf-ipcountry (the Worker also copies request.cf.country there). The other
 * names cover common hosts so a move does not silently switch everyone to dollars.
 */
const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country", "x-country-code", "x-geo-country"] as const;

export type MarketSource = "cookie" | "geo" | "default";
export type MarketDetection = { market: Market; source: MarketSource; country: string | null };

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.split("=");
    if (key?.trim() === name) return decodeURIComponent(rest.join("=").trim());
  }
  return null;
}

export function countryFromHeaders(get: (name: string) => string | null): string | null {
  for (const name of COUNTRY_HEADERS) {
    const value = get(name)?.trim().toUpperCase();
    // Cloudflare sends XX for unknown and T1 for Tor; neither is a country.
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") return value;
  }
  return null;
}

/** A remembered choice wins over geolocation; geolocation wins over the default. */
export function resolveMarket(get: (name: string) => string | null): MarketDetection {
  const country = countryFromHeaders(get);
  const saved = cookieValue(get("cookie"), MARKET_COOKIE);
  if (isMarket(saved)) return { market: saved, source: "cookie", country };
  const geo = marketForCountry(country);
  if (geo) return { market: geo, source: "geo", country };
  return { market: defaultMarket, source: "default", country };
}

/** Server components call this once per request and pass the result to MarketProvider. */
export async function detectMarket(): Promise<MarketDetection> {
  const requestHeaders = await headers();
  return resolveMarket((name) => requestHeaders.get(name));
}
