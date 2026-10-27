import { reservation, type HeroVariant } from "@/config/site";
import type { StorageMode } from "@/lib/storage";
import { WaitlistForm } from "./WaitlistForm";
import styles from "./HeroSignup.module.css";

export function HeroSignup({
  mode,
  v,
  reservations,
}: {
  mode: StorageMode;
  v: HeroVariant;
  reservations: boolean;
}) {
  return (
    <div className={styles.signup}>
      <WaitlistForm mode={mode} variant={v.id} cta={v.primaryCta} placement="hero" reservations={reservations} />
      <div className={styles.footer}>
        <a href={`${reservation.path}?v=${v.id}`} data-cta="hero_reserve" className={styles.reserve}>
          Reserve yours <span aria-hidden="true" className={styles.arrow}>→</span>
        </a>
      </div>
    </div>
  );
}
