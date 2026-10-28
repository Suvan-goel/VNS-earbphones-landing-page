"use client";

import { defaultVariant, heroVariants, reservation, site } from "@/config/site";
import { formatPrice } from "@/config/pricing";
import { useMarket } from "./MarketProvider";

/** Optional next step after joining. Personal information never goes in a link. */
export function ReserveStep({ email, variant = defaultVariant, compact = false }: { email: string; variant?: string; compact?: boolean }) {
  const selectedVariant = Object.hasOwn(heroVariants, variant) ? variant : defaultVariant;
  const { market } = useMarket();
  const deposit = formatPrice(market, "deposit");
  const href = `${reservation.path}?v=${encodeURIComponent(selectedVariant)}`;

  function rememberEmail() {
    try {
      sessionStorage.setItem("cymba.reservation-prefill", JSON.stringify({ email: email.trim(), savedAt: Date.now() }));
    } catch {
      // The reservation form remains usable when browser storage is unavailable.
    }
  }

  return (
    <div className={`mt-5 rounded-2xl border border-[var(--line)] ${compact ? "p-5" : "bg-surface p-6 sm:p-7"}`}>
      <p className="eyebrow">Take the next step</p>
      <p className="mt-2 text-lg font-medium leading-snug tracking-[-0.02em] text-ivory">
        A place in line for {site.product}.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Reserve with a {deposit} deposit, fully refundable before shipping and taken off the {formatPrice(market, "retail")} price.
        Joining the free list is enough to receive launch updates; reserving is optional.
      </p>
      <a href={href} onClick={rememberEmail} data-cta="reserve_step" className="btn-primary mt-4">
        Reserve for {deposit}
      </a>
    </div>
  );
}
