import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { ContactForm } from "@/components/ContactForm";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";
import { Wordmark } from "@/components/Wordmark";
import { site } from "@/config/site";
import frame from "@/components/LegalPage.module.css";
import styles from "./page.module.css";

const title = `Contact · ${site.brand}`;
const description = "Get in touch with cymba. Send us a message or email support@trycymba.com.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { type: "website", siteName: site.brand, title, description, url: "/contact", images: [] },
  twitter: { card: "summary", title, description, images: [] },
};

export default function Contact() {
  return (
    <div className={`${frame.page} ${styles.page}`}>
      <a href="#main" className={frame.skip}>Skip to content</a>
      <header className="site-header site-header--sticky" data-theme="light">
        <nav className="site-nav site-nav--simple" aria-label="Site">
          <a href="/" className="site-nav__brand" aria-label="Back to home">
            <Wordmark className="site-nav__wordmark" size="text-[1.125rem] sm:text-[1.375rem]" />
          </a>
          <BackLink />
        </nav>
      </header>

      <main id="main" className={styles.main}>
        <div className={styles.copy}>
          <div className={styles.accent} aria-hidden="true" />
          <h1 className={`headline ${styles.title}`}>Contact us.</h1>
          <p className={styles.intro}>Have a question? We’re here to help.</p>
          <div className={styles.email}>
            <p>Prefer email?</p>
            <a href={`mailto:${site.contactEmail}`}>
              {site.contactEmail}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
            </a>
          </div>
        </div>
        <div className={styles.panel}><ContactForm /></div>
      </main>

      <footer className={`${frame.footer} ${styles.footer}`}>
        <span>© {new Date().getFullYear()} {site.brand}</span>
        <nav aria-label="Legal and contact">
          <a href="/contact" aria-current="page">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <CookieSettingsLink />
        </nav>
      </footer>
    </div>
  );
}
