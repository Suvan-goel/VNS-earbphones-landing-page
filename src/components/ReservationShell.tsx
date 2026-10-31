import type { ReactNode } from "react";
import Image from "next/image";
import listeningScene from "@/assets/earbuds/listening-portrait-studio-grey-wide-v3.webp";
import { site } from "@/config/site";
import { BackLink } from "./BackLink";
import { Wordmark } from "./Wordmark";
import styles from "./ReservationShell.module.css";

export function ReservationShell({ children, home = "/", card = false }: { children: ReactNode; home?: string; card?: boolean }) {
  return (
    <div className={`${styles.page}${card ? ` on-scene ${styles.cardPage}` : ""}`}>
      {card && <div className={styles.backdrop} aria-hidden="true">
        <Image src={listeningScene} alt="" fill sizes="100vw" quality={75} className={styles.backdropImage} />
      </div>}
      <a href="#main" className={styles.skip}>Skip to content</a>
      <header className={card ? "site-header" : "site-header site-header--sticky"} data-theme={card ? "dark" : "light"}>
        <nav aria-label="Reservation" className={card ? `site-nav ${styles.reservationNav}` : "site-nav site-nav--simple"}>
          <a href={home} className="site-nav__brand" aria-label={`${site.brand}, back to site`}>
            <Wordmark className="site-nav__wordmark" size="text-[1.125rem] sm:text-[1.375rem]" />
          </a>
          <BackLink href={home} className={card ? styles.reservationBack : undefined} />
        </nav>
      </header>
      <main id="main" className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} {site.brand}</span>
        <nav aria-label="Reservation footer">
          <a href="/privacy">Privacy</a>
          <a href="/terms#reservations">Terms</a>
          <a href="/contact">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
