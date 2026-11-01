import { termsArchive } from "@/content/terms/history";
import { termsDocumentText, type TermsDocument } from "@/content/terms/types";
import { CURRENT_TERMS_VERSION } from "@/content/terms/version";
import type { ReservationRow } from "@/lib/storage";

const CONTACT = "support@trycymba.com";
const MERCHANT = "Frame Wearable, Inc., operating as cymba";
const ADDRESS = "2810 North Church Street, STE 89620, Wilmington, DE 19802, United States";

function recordedTime(value: string | null | undefined): string {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? `${new Date(time).toISOString()} (UTC)` : "Not recorded";
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: currency.toUpperCase(), currencyDisplay: "code",
  }).format(amount / 100);
}

export function reservationBenefitSummary(row: ReservationRow, options: { concise?: boolean } = {}): string {
  if (options.concise) {
    if (row.status === "refunded") return "This reservation is no longer active.";
    if (row.status !== "paid" || row.amount_refunded !== 0) return "Reply to confirm your benefits after this refund or payment update.";
  }
  if (row.status === "refunded") return "This reservation has been refunded and is no longer active. Refer to your recorded terms and any separate support confirmation for previous benefits; this confirmation does not reinstate a cancelled reservation.";
  if (row.status !== "paid" || row.amount_refunded !== 0) return `Your current reservation benefits need confirmation because the payment has a refund or review status. Contact ${CONTACT}; this confirmation does not confirm active Founder eligibility.`;
  const number = row.founder_number;
  if (!Number.isSafeInteger(number) || number == null || number < 1) return options.concise ? "Reply to confirm your reservation and benefits." : `No reservation number is recorded. Contact ${CONTACT} to confirm your reservation and any benefits.`;
  const position = row.founder_position ?? number;
  if (!Number.isSafeInteger(position) || position < 1) return options.concise ? "Reply to confirm your reservation benefits." : `Contact ${CONTACT} to confirm the benefits recorded for your reservation.`;
  if (position > 50) return options.concise ? "Outside the first 50 paid places. Any later Founder eligibility is confirmed separately." : `Your recorded reservation is outside the first 50 paid places. Eligibility gained through a cancelled Founders place is confirmed separately by support and is not established by your reservation number. Contact ${CONTACT} for any such confirmation.`;
  if (row.terms_version === "2026-10-28-founders-referrals" || row.terms_version === "2026-10-29-legal-update" || row.terms_version === "2026-10-29-contact-email" || row.terms_version === CURRENT_TERMS_VERSION) {
    const discount = row.currency === "gbp" ? "£50" : row.currency === "usd" ? "US$50" : null;
    if (discount) return options.concise
      ? `Founding 50: ${discount} off the launch RRP, 3 free software months and limited-edition Founders Buds when you buy. Free months start at activation.`
      : `Your recorded paid reservation is within the first 50: ${discount} off the launch recommended retail price, 3 months of software subscription free and limited-edition Founders Buds when you buy the finished product. The full deposit credit is additional to the discount. Free months begin when you activate the delivered product.`;
  }
  if (row.terms_version === "2026-10-28") return options.concise ? "Your reservation includes limited-edition Founders Buds at no extra cost when you buy." : "Your recorded paid reservation is within the first 50 and qualifies for limited-edition Founders Buds at no extra cost when you buy the finished product under this archived version. This version did not promise the later launch-price discount or free subscription months.";
  return options.concise ? "Reply to confirm the benefits in your original reservation terms." : `This historical record does not reliably identify your Founder benefits. Contact ${CONTACT} for confirmation; no additional offer has been inferred from today's terms.`;
}

/** Keep stored archives intact while making every displayed contact address current. */
function confirmationTermsText(document: TermsDocument): string {
  const original = termsDocumentText(document);
  const currentContact = original.replaceAll("support@muraband.com", CONTACT);
  if (original === currentContact) return original;
  return `Contact-address update: Support contact details in this copy have been updated to ${CONTACT}. The original terms version, dates and all other wording are unchanged.\n\n${currentContact}`;
}

/** A portable snapshot, using only the saved record and its archived terms version. */
export function reservationConfirmationText(row: ReservationRow, now = new Date()): string {
  const version = typeof row.terms_version === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(row.terms_version) ? row.terms_version : "Not recorded";
  const archive = termsArchive(version);
  const number = Number.isSafeInteger(row.founder_number) && row.founder_number != null && row.founder_number > 0
    ? `#${String(row.founder_number).padStart(3, "0")}` : "Not recorded";
  const lines = [
    "CYMBA RESERVATION CONFIRMATION",
    row.livemode ? "Recorded reservation details" : "TEST / PREVIEW — this is not a live reservation confirmation",
    `Saved on: ${now.toISOString()} (UTC)`,
    `${MERCHANT}\n${ADDRESS}\nContact: ${CONTACT}`,
    `Reservation number: ${number}`,
    `Payment recorded: ${recordedTime(row.paid_at)}`,
    `Terms accepted: ${recordedTime(row.terms_accepted_at)}`,
    `Recorded terms version: ${version}`,
    `Original deposit: ${money(row.amount, row.currency)}`,
    `Refund recorded: ${money(row.amount_refunded, row.currency)}`,
    `Remaining recorded deposit: ${money(Math.max(0, row.amount - row.amount_refunded), row.currency)}`,
    `Payment status when saved: ${row.status.replaceAll("_", " ")}`,
    "Your reservation is separate from a purchase of the finished product. Your reservation reference is not a guaranteed shipping date. The remaining balance will not be charged automatically.",
    "RESERVATION BENEFITS",
    reservationBenefitSummary(row),
    `Referral rewards and any support-confirmed promotion are administered separately. This download does not show a referral balance or override a benefit confirmed to you by support. Contact ${CONTACT} if you need those records.`,
    "CANCELLATION AND HELP",
    `For a cancellation or refund request, clearly tell ${CONTACT} that you want to cancel, or write to the business address above. Your reservation number helps us find the record. If you cannot use your reservation email address, contact us another way so we can identify the reservation. Do not send card details. Applicable refund promises and your statutory rights are preserved; see the terms archive below.`,
    "Keep this file and your payment receipt. This is a snapshot of the recorded status when downloaded; later payments, refunds and support confirmations will not update this saved file.",
  ];
  if (archive.status === "verified") {
    lines.push("TERMS FOR YOUR RECORDED VERSION", confirmationTermsText(archive.documents[0]));
  } else if (archive.status === "ambiguous") {
    lines.push("HISTORICAL TERMS — VERSION AMBIGUITY",
      `The recorded version number was used for more than one wording revision. The available source snapshots are included below, but this reservation record does not establish which revision you saw. They are not represented as a single confirmed copy of your accepted contract. Contact ${CONTACT} for help confirming the terms and benefits that applied to you. Today's terms have not been substituted for your historical version.`);
    archive.documents.forEach((document, index) => lines.push(`ARCHIVED WORDING ${index + 1} OF ${archive.documents.length}`, confirmationTermsText(document)));
  } else {
    lines.push("HISTORICAL TERMS UNAVAILABLE",
      `We do not have a verified archived copy for the recorded version in this download. Today's terms have not been substituted. Contact ${CONTACT} with your reservation number to request the terms and benefits that applied to your reservation. This does not remove any rights or commitments accepted when you reserved.`);
  }
  return `${lines.join("\n\n")}\n`;
}
