/**
 * Launch pricing, in the two currencies the site quotes. Amounts are in the
 * smallest currency unit so one set of numbers drives the copy, the FAQ, the
 * terms and the Stripe checkout. UK visitors see pounds, US visitors see
 * dollars, and everyone else sees dollars until they switch.
 */

export type Market = "uk" | "us";

export type MarketPricing = {
  id: Market;
  /** ISO 4217 code shown on the currency switch. */
  code: "GBP" | "USD";
  /** Lower-case Stripe currency. */
  currency: "gbp" | "usd";
  region: string;
  /** Formats the local currency with its plain symbol: £400, $449. */
  locale: "en-GB" | "en-US";
  /** The earbuds, paid once. */
  retail: number;
  /** The software, billed monthly. */
  subscription: number;
  /** The refundable reservation deposit. */
  deposit: number;
};

export const launch = {
  /** The planned launch window shown across the site. */
  window: "Q4 2027",
} as const;

export const markets: Record<Market, MarketPricing> = {
  uk: { id: "uk", code: "GBP", currency: "gbp", region: "United Kingdom", locale: "en-GB", retail: 40000, subscription: 1500, deposit: 3500 },
  us: { id: "us", code: "USD", currency: "usd", region: "United States", locale: "en-US", retail: 44900, subscription: 1500, deposit: 5000 },
};

export const marketIds = Object.keys(markets) as Market[];

/** Visitors outside the UK and US see US dollars, matching the US merchant of record. */
export const defaultMarket: Market = "us";

/** A chosen currency is remembered for a year. */
export const MARKET_COOKIE = "cymba_market";
export const MARKET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isMarket(value: unknown): value is Market {
  return typeof value === "string" && Object.hasOwn(markets, value);
}

/** ISO 3166-1 alpha-2 codes, as geolocation headers report them. */
const COUNTRY_MARKETS: Record<string, Market> = {
  GB: "uk", GG: "uk", JE: "uk", IM: "uk",
  US: "us", PR: "us", GU: "us", VI: "us", AS: "us", MP: "us", UM: "us",
};

export function marketForCountry(country: string | null | undefined): Market | null {
  if (typeof country !== "string") return null;
  return COUNTRY_MARKETS[country.trim().toUpperCase()] ?? null;
}

export type PriceKind = "retail" | "subscription" | "deposit" | "balance";

/** The price left to pay at launch after the deposit is credited. */
export function balanceFor(market: Market | MarketPricing): number {
  const m = typeof market === "string" ? markets[market] : market;
  return m.retail - m.deposit;
}

export function amountFor(market: Market | MarketPricing, kind: PriceKind): number {
  const m = typeof market === "string" ? markets[market] : market;
  return kind === "balance" ? balanceFor(m) : m[kind];
}

/**
 * £400, $449, £15. Whole amounts drop the pence and cents; anything else keeps
 * two decimals. `explicit` labels dollars as US$ for text that mixes currencies.
 */
export function formatAmount(market: Market | MarketPricing, minorUnits: number, options: { explicit?: boolean } = {}): string {
  const m = typeof market === "string" ? markets[market] : market;
  const whole = minorUnits % 100 === 0;
  return new Intl.NumberFormat(options.explicit ? "en-GB" : m.locale, {
    style: "currency",
    currency: m.code,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function formatPrice(market: Market | MarketPricing, kind: PriceKind, options: { explicit?: boolean } = {}): string {
  return formatAmount(market, amountFor(market, kind), options);
}

/** "£400 (UK) or US$449 (US)": for the FAQ, terms and metadata, which every visitor reads the same way. */
export function formatBothMarkets(kind: PriceKind, suffix = ""): string {
  return `${formatPrice("uk", kind, { explicit: true })}${suffix} (UK) or ${formatPrice("us", kind, { explicit: true })}${suffix} (US)`;
}

/** "£35 / US$50" for titles and descriptions. */
export function formatCompactMarkets(kind: PriceKind): string {
  return `${formatPrice("uk", kind, { explicit: true })} / ${formatPrice("us", kind, { explicit: true })}`;
}
