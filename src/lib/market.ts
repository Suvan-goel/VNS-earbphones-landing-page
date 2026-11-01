import { headers } from "next/headers";
import { defaultMarket, marketForCountry, type Market } from "@/config/pricing";

/*
 * The hosted site runs on Cloudflare, which reports the visitor's country in
 * cf-ipcountry (the Worker also copies request.cf.country there). The other
 * names cover common hosts so a move does not silently switch everyone to dollars.
 */
const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country", "x-country-code", "x-geo-country"] as const;

export type MarketSource = "geo" | "default";
export type MarketDetection = { market: Market; source: MarketSource; country: string | null };

export function countryFromHeaders(get: (name: string) => string | null): string | null {
  for (const name of COUNTRY_HEADERS) {
    const value = get(name)?.trim().toUpperCase();
    // Cloudflare sends XX for unknown and T1 for Tor; neither is a country.
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") return value;
  }
  return null;
}

/** Location selects the currency. Previous manual currency preferences are ignored. */
export function resolveMarket(get: (name: string) => string | null): MarketDetection {
  const country = countryFromHeaders(get);
  const geo = marketForCountry(country);
  if (geo) return { market: geo, source: "geo", country };
  return { market: defaultMarket, source: "default", country };
}

/** Server components call this once per request and pass the result to MarketProvider. */
export async function detectMarket(): Promise<MarketDetection> {
  const requestHeaders = await headers();
  return resolveMarket((name) => requestHeaders.get(name));
}
