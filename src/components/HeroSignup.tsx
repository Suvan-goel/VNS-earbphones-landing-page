import { reservation, type HeroVariant } from "@/config/site";
import { foundersOffer } from "@/config/pricing";
import type { StorageMode } from "@/lib/storage";
import { Price } from "./Price";
import { WaitlistForm } from "./WaitlistForm";
import styles from "./HeroSignup.module.css";

export function HeroSignup({
  mode,
  v,
}: {
  mode: StorageMode;
  v: HeroVariant;
}) {
  return (
    <div className={styles.signup}>
      <WaitlistForm mode={mode} variant={v.id} cta={v.primaryCta} placement="hero" />
      <div className={styles.footer}>
        <a href={`${reservation.path}?v=${v.id}`} data-cta="hero_reserve" className={styles.reserve}>
          Reserve yours <span aria-hidden="true" className={styles.arrow}>→</span>
        </a>
        <p className={styles.offer}>
          <span className={styles.offerLimit}>First {foundersOffer.limit} reservations:</span>{" "}
          <Price of="founderDiscount" /> off + {foundersOffer.freeMonths} months free + Founders Buds
        </p>
      </div>
    </div>
  );
}
