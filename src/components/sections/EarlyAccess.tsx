import { reservation, site, type HeroVariant } from "@/config/site";
import { foundersOffer } from "@/config/pricing";
import { Price } from "../Price";
import type { StorageMode } from "@/lib/storage";
import { WaitlistForm } from "../WaitlistForm";
import { Container, Headline } from "../ui";
import styles from "./EarlyAccess.module.css";

export function EarlyAccess({ mode, v, reservations = false }: { mode: StorageMode; v: HeroVariant; reservations?: boolean }) {
  return (
    <section id="early-access" aria-labelledby="ea-title" className={`${reservations ? styles.compact : "section"} scroll-mt-14`}>
      <Container>
        <div className={styles.layout}>
          {!reservations && (
            <>
              <Headline id="ea-title" lines={["Be first to", `experience ${site.brand}.`]} className="reveal text-[clamp(2rem,3.6vw,3.25rem)]" />
              <p className="reveal mt-4 text-[1.0625rem] leading-relaxed text-muted sm:text-lg">
                Get launch dates, pricing and first-access details.
              </p>
            </>
          )}
          <div id="signup" tabIndex={-1} aria-label="Launch updates signup" className={`reveal scroll-mt-28 ${styles.signup}`}>
            {reservations && (
              <div className={styles.waitlistIntro}>
                <h2 id="ea-title">Join the waitlist.</h2>
              </div>
            )}
            <WaitlistForm mode={mode} variant={v.id} cta={reservations ? "Join" : v.primaryCta} />
            {reservations && <div className={styles.reservation}>
              <div className={styles.offerCopy}>
                <p className={styles.offerLabel}>Founders Edition · First {foundersOffer.limit} reservations</p>
                <p className={styles.offer}><Price of="founderDiscount" /> off + {foundersOffer.freeMonths} months free + Founders Buds</p>
              </div>
              <a href={`${reservation.path}?v=${v.id}`} data-cta="early_access_reserve" className={styles.reserve}>Reserve now</a>
            </div>}
          </div>
        </div>
      </Container>
    </section>
  );
}
