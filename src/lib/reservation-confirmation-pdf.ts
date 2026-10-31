import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { reservationBenefitSummary } from "./reservation-confirmation";
import { confirmationLogo } from "./reservation-document-assets";
import type { ReservationRow } from "./storage";

const INK = rgb(.114, .114, .122);
const MUTED = rgb(.39, .40, .42);
const GOLD = rgb(.58, .45, .27);
const LINE = rgb(.86, .86, .85);
const PAPER = rgb(.97, .965, .95);
const WHITE = rgb(1, 1, 1);
const PAGE = { width: 595.28, height: 841.89, margin: 46 };
const CONTENT = PAGE.width - PAGE.margin * 2;
const STATUS: Record<ReservationRow["status"], string> = {
  paid: "Reservation confirmed", partially_refunded: "Partial refund recorded",
  refunded: "Reservation refunded", refund_review: "Refund under review",
  pending: "Awaiting payment", processing: "Payment processing", expired: "Checkout expired", failed: "Payment unsuccessful",
};

// Consistent printable punctuation; original archived wording stays in the text record.
function printable(text: string) {
  return text.replace(/[\u2010-\u2015\u2212]/g, "-").replace(/[\u00a0\u202f]/g, " ");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  // PDF text operators use glyph advances without kerning. Measure the same way.
  const widths = new Map<string, number>();
  const measure = (value: string) => Array.from(value).reduce((total, character) => {
    if (!widths.has(character)) widths.set(character, font.widthOfTextAtSize(character, size));
    return total + widths.get(character)!;
  }, 0);
  for (const paragraph of printable(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (line && measure(`${line}${word}`) > width) {
        lines.push(line.trimEnd()); line = "";
      }
      // Long version identifiers and URLs must also stay inside the page margin.
      for (const character of word) {
        if (measure(line + character) > width) {
          lines.push(line.trimEnd()); line = "";
        }
        line += character;
      }
      line += " ";
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function time(value: string | null | undefined) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(parsed) + " UTC" : "Not recorded";
}

/** A one-page receipt; the full saved record and terms are downloaded separately. */
export async function reservationConfirmationPdf(row: ReservationRow, now = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(confirmationLogo);
  const reference = Number.isSafeInteger(row.founder_number) && row.founder_number != null && row.founder_number > 0
    ? `#${String(row.founder_number).padStart(3, "0")}` : "Not recorded";
  const amount = (value: number) => new Intl.NumberFormat("en-GB", {
    style: "currency", currency: row.currency.toUpperCase(),
  }).format(value / 100);
  pdf.setTitle(`cymba - Reservation ${reference}`);
  pdf.setAuthor("cymba / Frame Wearable, Inc.");
  pdf.setSubject("Reservation confirmation");
  pdf.setCreator("cymba");
  pdf.setProducer("cymba");
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  pdf.setLanguage("en-GB");

  const cover = pdf.addPage([PAGE.width, PAGE.height]);
  const draw = (page: PDFPage, text: string, x: number, top: number, size = 10, font = regular, color = INK) => {
    page.drawText(printable(text), { x, y: PAGE.height - top - size, size, font, color });
  };
  const paragraph = (page: PDFPage, text: string, x: number, top: number, width: number, size = 10, color = MUTED) => {
    const lines = wrap(text, regular, size, width);
    lines.forEach((line, i) => draw(page, line, x, top + i * size * 1.55, size, regular, color));
    return top + lines.length * size * 1.55;
  };
  const rule = (page: PDFPage, top: number) => page.drawLine({ start: { x: PAGE.margin, y: PAGE.height - top }, end: { x: PAGE.width - PAGE.margin, y: PAGE.height - top }, color: LINE, thickness: .6 });
  const brand = (page: PDFPage, top: number, width = 104) => page.drawImage(logo, { x: PAGE.margin, y: PAGE.height - top - width * logo.height / logo.width, width, height: width * logo.height / logo.width });

  cover.drawRectangle({ x: 0, y: PAGE.height - 7, width: PAGE.width, height: 7, color: GOLD });
  brand(cover, 43, 113);
  draw(cover, "RESERVATION CONFIRMATION", PAGE.width - 235, 48, 9, bold, MUTED);
  rule(cover, 96);
  if (!row.livemode) {
    cover.drawRectangle({ x: PAGE.margin, y: PAGE.height - 135, width: CONTENT, height: 24, color: PAPER });
    draw(cover, "SAMPLE / TEST - NOT A LIVE RESERVATION", PAGE.margin + 12, 117, 8, bold, GOLD);
  }
  const headingTop = row.livemode ? 121 : 154;
  draw(cover, STATUS[row.status], PAGE.margin, headingTop, 25, bold);
  draw(cover, `Reservation ${reference}`, PAGE.margin, headingTop + 39, 13, regular, GOLD);
  draw(cover, `Payment recorded: ${time(row.paid_at)}`, PAGE.margin, headingTop + 64, 9, regular, MUTED);

  const boxTop = headingTop + 100;
  const refund = row.amount_refunded > 0 || row.status === "refund_review";
  const boxHeight = refund ? 143 : 116;
  cover.drawRectangle({ x: PAGE.margin, y: PAGE.height - boxTop - boxHeight, width: CONTENT, height: boxHeight, color: INK });
  draw(cover, "DEPOSIT RECORDED", PAGE.margin + 22, boxTop + 20, 9, bold, rgb(.80, .73, .61));
  draw(cover, amount(row.amount), PAGE.margin + 22, boxTop + 42, 34, regular, WHITE);
  if (!refund && row.status === "paid") {
    draw(cover, "Fully refundable before shipping.", PAGE.margin + 22, boxTop + 90, 9, regular, rgb(.78, .78, .79));
    draw(cover, "Credited toward your pair.", PAGE.margin + 257, boxTop + 90, 9, regular, rgb(.78, .78, .79));
  } else {
    draw(cover, "Refund recorded", PAGE.margin + 257, boxTop + 29, 9, regular, rgb(.78, .78, .79));
    draw(cover, amount(row.amount_refunded), PAGE.margin + 257, boxTop + 46, 18, regular, WHITE);
    draw(cover, "Remaining deposit", PAGE.margin + 257, boxTop + 79, 9, regular, rgb(.78, .78, .79));
    draw(cover, amount(Math.max(0, row.amount - row.amount_refunded)), PAGE.margin + 257, boxTop + 96, 18, regular, WHITE);
  }

  let top = boxTop + boxHeight + 28;
  draw(cover, "YOUR RECORDED BENEFITS", PAGE.margin, top, 9, bold, GOLD);
  top = paragraph(cover, reservationBenefitSummary(row), PAGE.margin, top + 20, CONTENT, 10) + 24;
  rule(cover, top);
  top += 19;
  draw(cover, row.status === "paid" ? "WHAT HAPPENS NEXT" : "YOUR RESERVATION STATUS", PAGE.margin, top, 9, bold, GOLD);
  const next = row.status === "paid"
    ? "We’ll email you with final pricing and shipping details before you decide to buy. Your full deposit is credited to the price. The remaining balance will not be charged automatically."
    : row.status === "refunded"
      ? "This reservation is no longer active. Your bank or payment provider may take additional time to display the refund."
      : "Contact support to confirm your reservation, refund and benefits. Please do not make another payment while we resolve the status.";
  top = paragraph(cover, next, PAGE.margin, top + 20, CONTENT, 10) + 22;
  draw(cover, "QUESTIONS OR REFUNDS", PAGE.margin, top, 9, bold, GOLD);
  paragraph(cover, "support@trycymba.com  |  Include your reservation number.", PAGE.margin, top + 19, CONTENT, 10);
  const version = typeof row.terms_version === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(row.terms_version) ? row.terms_version : "Not recorded";
  paragraph(cover, `Recorded terms: ${version}\nTerms accepted: ${time(row.terms_accepted_at)}\nFull recorded terms are available separately on your confirmation page.`, PAGE.margin, 695, CONTENT, 8.5);

  for (const [index, current] of pdf.getPages().entries()) {
    rule(current, 769);
    draw(current, "Frame Wearable, Inc. · cymba", PAGE.margin, 781, 8, regular, MUTED);
    draw(current, `${index + 1} / ${pdf.getPageCount()}`, PAGE.width - PAGE.margin - 28, 781, 8, regular, MUTED);
    draw(current, "2810 North Church Street, STE 89620, Wilmington, DE 19802, United States", PAGE.margin, 798, 7, regular, MUTED);
  }
  return pdf.save();
}
