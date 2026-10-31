"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { defaultMarket, markets, type Market, type MarketPricing } from "@/config/pricing";

type MarketContextValue = {
  market: Market;
  pricing: MarketPricing;
};

const fallback: MarketContextValue = {
  market: defaultMarket, pricing: markets[defaultMarket],
};

const MarketContext = createContext<MarketContextValue>(fallback);

/** Keep the server-detected currency stable for this page and any payment in progress. */
export function MarketProvider({ initial, children }: { initial: Market; children: ReactNode }) {
  const [market] = useState<Market>(initial);
  const value = useMemo<MarketContextValue>(() => ({
    market, pricing: markets[market],
  }), [market]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  return useContext(MarketContext);
}
