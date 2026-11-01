/** Render-neutral legal copy. A published version must never be edited in place. */
export type TermsRun = string | { readonly label: string; readonly href: string };

export type TermsBlock = {
  readonly kind: "paragraph" | "form";
  readonly runs: readonly TermsRun[];
};

export type TermsSection = {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly TermsBlock[];
};

export type TermsDocument = {
  readonly version: string;
  readonly title: string;
  readonly updated: string;
  readonly sections: readonly TermsSection[];
};

export function termsBlockText(block: TermsBlock): string {
  return block.runs.map((run) => typeof run === "string" ? run : run.label).join("");
}

export function termsDocumentText(document: TermsDocument): string {
  return [
    document.title,
    `Last updated ${document.updated}`,
    `Reservation terms version: ${document.version}`,
    ...document.sections.flatMap((section) => [section.title, ...section.blocks.map((block) =>
      block.runs.map((run) => {
        if (typeof run === "string") return run;
        if (run.href === `mailto:${run.label}`) return run.label;
        const url = run.href.startsWith("/") ? `https://trycymba.com${run.href}` : run.href;
        return `${run.label} (${url})`;
      }).join(""))]),
  ].join("\n\n");
}
