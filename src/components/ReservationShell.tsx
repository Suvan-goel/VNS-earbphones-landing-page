import type { ReactNode } from "react";
import { site } from "@/config/site";
import { Wordmark } from "./Wordmark";
import styles from "./ReservationShell.module.css";

export function ReservationShell({ children, home = "/", card = false }: { children: ReactNode; home?: string; card?: boolean }) {
  return (
    <div className={`${styles.page}${card ? ` ${styles.cardPage}` : ""}`}>
      <a href="#main" className={styles.skip}>Skip to content</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href={home} aria-label={`${site.brand}, back to site`}><Wordmark size="text-base sm:text-[1.0625rem]" /></a>
          <a href={home} className={styles.back}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m8 5-5 5 5 5M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to site
          </a>
        </div>
      </header>
      <main id="main" className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} {site.brand}</span>
        <nav aria-label="Reservation footer">
          <a href="/privacy">Privacy</a>
          <a href="/terms#reservations">Terms</a>
          <a href={`mailto:${site.contactEmail}`}>Contact</a>
        </nav>
      </footer>
    </div>
  );
}
