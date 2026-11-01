"use client";

import { formatPrice, type PriceKind } from "@/config/pricing";
import { useMarket } from "./MarketProvider";

/** One amount in the currency detected from the visitor's location. */
export function Price({ of, suffix = "", className }: { of: PriceKind; suffix?: string; className?: string }) {
  const { market } = useMarket();
  return <span className={className}>{formatPrice(market, of)}{suffix}</span>;
}
