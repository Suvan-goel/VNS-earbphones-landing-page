import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bone">
      <header className="bg-ink text-bone">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <a href="/" aria-label="Back to home">
            <Wordmark />
          </a>
          <a href="/" className="text-sm text-bone/70 hover:text-bone">
            Back to site
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="display text-5xl">{title}</h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-mute">Last updated {updated}</p>
        <div className="mt-6 rounded-2xl border border-dashed border-ink/25 p-4 text-sm text-ink/70">
          Template text for a pre-launch waitlist. Have it reviewed by a qualified adviser and completed with your legal entity details
          before collecting real signups.
        </div>
        <div className="prose-legal mt-12 space-y-6 text-[1.02rem] leading-relaxed text-ink/75 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">
          {children}
        </div>
      </main>
    </div>
  );
}
