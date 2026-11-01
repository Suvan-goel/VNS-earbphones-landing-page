import type { ReactNode } from "react";
import { site } from "@/config/site";
import { BackLink } from "./BackLink";
import { CookieSettingsLink } from "./CookieSettingsLink";
import { Wordmark } from "./Wordmark";
import styles from "./LegalPage.module.css";

export type LegalSection = { id: string; label: string };

export function LegalPage({ title, updated, children, sections = [], showTemplateNotice = true }: { title: string; updated: string; children: ReactNode; sections?: readonly LegalSection[]; showTemplateNotice?: boolean }) {
  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skip}>Skip to content</a>
      <header className="site-header site-header--sticky" data-theme="light">
        <nav className="site-nav site-nav--simple" aria-label="Site">
          <a href="/" className="site-nav__brand" aria-label="Back to home">
            <Wordmark className="site-nav__wordmark" size="text-[1.125rem] sm:text-[1.375rem]" />
          </a>
          <BackLink />
        </nav>
      </header>
      <main id="main" className={`${styles.main} mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20`}>
        <h1 className="headline text-[clamp(2.5rem,6vw,3.5rem)]">{title}</h1>
        <p className={`${styles.updated} eyebrow mt-4`}>Last updated {updated}</p>
        {showTemplateNotice && <div className="panel mt-8 !rounded-2xl p-4 text-sm text-ivory-soft">
          Template text for a pre-launch waitlist. Have it reviewed by a qualified adviser and completed with your legal entity details
          before collecting real signups.
        </div>}
        {sections.length > 0 && <nav className={styles.contents} aria-labelledby="legal-contents-title">
          <h2 id="legal-contents-title">On this page</h2>
          <ul>
            {sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>)}
          </ul>
        </nav>}
        <div className="prose-legal mt-12 space-y-6 text-[1.02rem] leading-relaxed text-muted [&_[id]]:scroll-mt-24 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-normal [&_h2]:tracking-[-0.035em] [&_h2]:text-ivory [&_li]:ml-5 [&_li]:list-disc [&_a]:text-ivory [&_a]:underline [&_strong]:font-medium [&_strong]:text-ivory-soft">
          {children}
        </div>
      </main>
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} {site.brand}</span>
        <nav aria-label="Legal and contact">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/contact">Contact</a>
          <CookieSettingsLink />
        </nav>
      </footer>
    </div>
  );
}
