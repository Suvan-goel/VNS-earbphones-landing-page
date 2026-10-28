"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE, defaultMarket, markets, type Market, type MarketPricing } from "@/config/pricing";

type MarketContextValue = {
  market: Market;
  pricing: MarketPricing;
  setMarket: (market: Market) => void;
  /** True once a payment is being confirmed, when the currency can no longer change. */
  locked: boolean;
  setLocked: (locked: boolean) => void;
  /** False when rendered without a provider, so a switch would have nothing to update. */
  switchable: boolean;
};

const fallback: MarketContextValue = {
  market: defaultMarket, pricing: markets[defaultMarket], setMarket: () => {}, locked: false, setLocked: () => {}, switchable: false,
};

const MarketContext = createContext<MarketContextValue>(fallback);

function rememberMarket(market: Market) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${MARKET_COOKIE}=${market}; Path=/; Max-Age=${MARKET_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // The choice still applies to this page when cookies are blocked.
  }
}

/** The server detects the market once per request; the switch updates every price on the page in place. */
export function MarketProvider({ initial, children }: { initial: Market; children: ReactNode }) {
  const [market, setMarketState] = useState<Market>(initial);
  const [locked, setLocked] = useState(false);
  const setMarket = useCallback((next: Market) => {
    if (locked || !Object.hasOwn(markets, next)) return;
    setMarketState(next);
    rememberMarket(next);
  }, [locked]);
  const value = useMemo<MarketContextValue>(() => ({
    market, pricing: markets[market], setMarket, locked, setLocked, switchable: true,
  }), [market, setMarket, locked]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  return useContext(MarketContext);
}
