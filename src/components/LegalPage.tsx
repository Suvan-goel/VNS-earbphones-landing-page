import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

export function LegalPage({ title, updated, children, showTemplateNotice = true }: { title: string; updated: string; children: ReactNode; showTemplateNotice?: boolean }) {
  return (
    <div className="min-h-screen">
      <header>
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-5 sm:px-8">
          <a href="/" aria-label="Back to home">
            <Wordmark />
          </a>
          <a href="/" className="btn-secondary !min-h-10 !px-4 !py-2 text-sm">
            Back to site
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <h1 className="headline text-[clamp(2.5rem,6vw,3.5rem)]">{title}</h1>
        <p className="eyebrow mt-4">Last updated {updated}</p>
        {showTemplateNotice && <div className="panel mt-8 !rounded-2xl p-4 text-sm text-ivory-soft">
          Template text for a pre-launch waitlist. Have it reviewed by a qualified adviser and completed with your legal entity details
          before collecting real signups.
        </div>}
        <div className="prose-legal mt-12 space-y-6 text-[1.02rem] leading-relaxed text-muted [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-normal [&_h2]:tracking-[-0.035em] [&_h2]:text-ivory [&_li]:ml-5 [&_li]:list-disc [&_a]:text-ivory [&_a]:underline [&_strong]:font-medium [&_strong]:text-ivory-soft">
          {children}
        </div>
      </main>
    </div>
  );
}
