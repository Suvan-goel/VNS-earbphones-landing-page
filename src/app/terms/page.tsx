import type { Metadata } from "next";
import { Fragment } from "react";
import { site } from "@/config/site";
import { LegalPage } from "@/components/LegalPage";
import { currentTerms } from "@/content/terms/current";

const title = `Terms and reservations · ${site.brand}`;
const description = "cymba website and reservation terms, including deposits, refunds, Founders benefits, referral rewards and your consumer rights.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/terms" },
  robots: { index: false, follow: true },
  openGraph: { type: "website", siteName: site.brand, title, description, url: "/terms", images: [] },
  twitter: { card: "summary", title, description, images: [] },
};

export default function Terms() {
  return (
    <LegalPage title={currentTerms.title} updated={currentTerms.updated} showTemplateNotice={false}
      sections={currentTerms.sections.map((section) => ({ id: section.id, label: section.title }))}>
      {currentTerms.sections.map((section) => <Fragment key={section.id}>
        <h2 id={section.id} className="scroll-mt-24">{section.title}</h2>
        {section.blocks.map((block, index) => <p key={index} className={block.kind === "form" ? "whitespace-pre-line" : undefined}>
          {block.runs.map((run, runIndex) => typeof run === "string"
            ? <Fragment key={runIndex}>{run}</Fragment>
            : <a key={runIndex} href={run.href}>{run.label}</a>)}
        </p>)}
      </Fragment>)}
    </LegalPage>
  );
}
