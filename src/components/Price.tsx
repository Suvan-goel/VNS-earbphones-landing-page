"use client";

import { formatPrice, type PriceKind } from "@/config/pricing";
import { useMarket } from "./MarketProvider";

/** One amount in the visitor's currency, updated in place when the currency switch changes. */
export function Price({ of, suffix = "", className }: { of: PriceKind; suffix?: string; className?: string }) {
  const { market } = useMarket();
  return <span className={className}>{formatPrice(market, of)}{suffix}</span>;
}
