import { currentTerms } from "./current";
import { document as october29Contact } from "./archive/2026-10-29-contact-email";
import { document as october29Legal } from "./archive/2026-10-29-legal-update";
import { document as october25Initial } from "./archive/2026-10-25-initial";
import { document as october25Visuals } from "./archive/2026-10-25-visuals-update";
import { document as october25Founders } from "./archive/2026-10-25-founders-edition";
import { document as october28 } from "./archive/2026-10-28";
import { document as october28ReferralsInitial } from "./archive/2026-10-28-founders-referrals-initial";
import { document as october28Referrals } from "./archive/2026-10-28-founders-referrals";
import type { TermsDocument } from "./types";

export type TermsArchive = {
  status: "verified" | "ambiguous" | "unavailable";
  documents: readonly TermsDocument[];
};

const archives: Readonly<Record<string, readonly TermsDocument[]>> = {
  "2026-10-25": [october25Initial, october25Visuals, october25Founders],
  "2026-10-28": [october28],
  "2026-10-28-founders-referrals": [october28ReferralsInitial, october28Referrals],
  "2026-10-29-legal-update": [october29Legal],
  "2026-10-29-contact-email": [october29Contact],
  [currentTerms.version]: [currentTerms],
};

/** Older versions were reused for wording changes; never infer an accepted copy from a commit date. */
export function termsArchive(version: string): TermsArchive {
  const documents = Object.hasOwn(archives, version) ? archives[version] : [];
  return { status: documents.length === 1 ? "verified" : documents.length > 1 ? "ambiguous" : "unavailable", documents };
}
