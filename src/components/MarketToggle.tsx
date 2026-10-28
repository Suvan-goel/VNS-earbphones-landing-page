"use client";

import { marketIds, markets } from "@/config/pricing";
import { useMarket } from "./MarketProvider";
import styles from "./MarketToggle.module.css";

const symbols = { uk: "£", us: "$" } as const;
const names = { uk: "pounds", us: "US dollars" } as const;

/** A two-way currency switch. Geolocation picks the starting currency; this remembers a different choice. */
export function MarketToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { market, setMarket, locked, switchable } = useMarket();
  if (!switchable) return null;
  return (
    <div role="group" aria-label="Currency" className={`${styles.toggle} ${compact ? styles.compact : ""} ${className}`}>
      {marketIds.map((id) => {
        const selected = id === market;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            aria-label={`${markets[id].code}, ${markets[id].region}`}
            disabled={locked && !selected}
            onClick={() => setMarket(id)}
            className={styles.option}
          >
            <span aria-hidden="true" className={styles.symbol}>{symbols[id]}</span>
            {markets[id].code}
          </button>
        );
      })}
    </div>
  );
}

/** One quiet sentence with a text link: "Prices in pounds. Show in USD." */
export function MarketSwitchLink({ className = "" }: { className?: string }) {
  const { market, setMarket, locked, switchable } = useMarket();
  if (!switchable) return null;
  const other = marketIds.find((id) => id !== market) ?? market;
  return (
    <span className={className}>
      Prices in {names[market]}.{" "}
      <button type="button" disabled={locked} onClick={() => setMarket(other)} className={styles.link}>
        Show in {markets[other].code}
      </button>.
    </span>
  );
}
