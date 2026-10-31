import { reservationBenefitSummary, reservationConfirmationText } from "./reservation-confirmation";
import type { ReservationRow } from "./storage";
import { reservationEmailAssets } from "./reservation-email-assets";

export type ReservationEmailKind = "paid" | "processing" | "failed" | "partially_refunded" | "refunded" | "refund_review";
export type ReservationEmailJob = {
  id: string;
  reservation_id: string;
  kind: ReservationEmailKind;
  snapshot: ReservationRow;
  created_at: string;
};
export type ReservationEmail = {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  attachments?: { filename: string; content: string; content_id?: string }[];
};
const SUPPORT = "support@trycymba.com";
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-GB", {
  style: "currency", currency: currency.toUpperCase(), currencyDisplay: "code",
}).format(amount / 100);

/** Deterministic copy from the committed snapshot; no private checkout or browser-cookie links. */
export function reservationEmail(job: ReservationEmailJob): ReservationEmail {
  const row = job.snapshot;
  const preview = row.livemode !== true;
  const number = !preview && row.founder_number && row.founder_number > 0 && Number.isSafeInteger(row.founder_number)
    ? `#${String(row.founder_number).padStart(3, "0")}` : null;
  const reference = preview ? "DEMO-" + job.id.slice(0, 8) : number ?? row.id;
  const deposit = money(row.amount, row.currency);
  let subject: string;
  let title: string;
  let intro: string;
  let paragraphs: string[];
  const details: [string, string][] = [["Reservation reference", reference], ["Original deposit", deposit]];
  let attachment: string | undefined;
  switch (job.kind) {
    case "paid":
      subject = "cymba reservation " + reference + " — confirmed";
      title = "Your place is reserved.";
      intro = "Thanks for reserving cymba. Your place is confirmed.";
      paragraphs = [
        "Your deposit comes off your pair. We’ll email you final pricing and shipping details. No automatic balance payment or subscription.",
        reservationBenefitSummary(row, { concise: true }),
        "For a full refund before shipping, simply reply to cancel.",
        "Your reservation details and terms are attached.",
      ];
      attachment = reservationConfirmationText(preview ? { ...row, founder_number: null, id: reference } : row, new Date(job.created_at));
      break;
    case "processing":
      subject = "Your cymba reservation payment is processing";
      title = "We're processing your reservation";
      intro = "Your payment is processing. Your place isn’t confirmed yet.";
      paragraphs = ["Please don’t pay again. We’ll email you when it’s confirmed or if it fails."];
      break;
    case "failed":
      subject = "Your cymba reservation payment wasn’t completed";
      title = "Your payment wasn’t completed.";
      intro = "Your payment wasn’t completed, so your place hasn’t been reserved.";
      paragraphs = ["Pending charge on your statement, or unsure whether you paid? Contact us before trying again."];
      break;
    case "partially_refunded":
      subject = "Your cymba deposit has been partially refunded";
      title = "Your partial refund has been issued.";
      intro = `We’ve refunded a total of ${money(row.amount_refunded, row.currency)} to your original payment method.`;
      paragraphs = ["Your bank may take time to show it. Requested a full cancellation? Reply so we can check the remaining refund."];
      break;
    case "refunded":
      subject = "Your cymba reservation has been refunded";
      title = "Your deposit has been refunded.";
      intro = "Your full deposit has been refunded. Your reservation is no longer active.";
      paragraphs = ["Returned to your original payment method. Your bank may take time to show it."];
      break;
    case "refund_review":
      subject = "An update on your cymba refund";
      title = "Your refund needs attention.";
      intro = "We couldn’t confirm your refund. Please reply so we can help.";
      paragraphs = ["Don’t send card or bank details. Your refund rights are unchanged."];
      break;
  }
  if (job.kind === "partially_refunded" || job.kind === "refunded") {
    details.push(["Total refunded", money(row.amount_refunded, row.currency)], ["Deposit remaining", money(row.amount - row.amount_refunded, row.currency)]);
  }
  if (job.kind !== "paid") subject += " — " + reference;
  // Gmail can ignore a bracketed [TEST] prefix when grouping messages.
  if (preview) subject = "Design preview only: " + job.kind + " (" + reference + ")";
  const footer = `cymba reservation update.\n${SUPPORT}\nFrame Wearable, Inc., operating as cymba\n2810 North Church Street, STE 89620, Wilmington, DE 19802, United States`;
  const text = ["cymba", title, intro, details.map(([label, value]) => `${label}: ${value}`).join("\n"), ...paragraphs, ...(job.kind === "failed" ? ["Try again: https://trycymba.com/reserve"] : []), "Questions? Reply to this email.", footer].join("\n\n");
  const html = renderEmail({ job, subject, intro, paragraphs, details, reference });
  const attachments: NonNullable<ReservationEmail["attachments"]> = [
    ...(attachment ? [{ filename: "cymba-reservation-confirmation.txt", content: Buffer.from(attachment, "utf8").toString("base64") }] : []),
    { filename: "cymba-mark.png", content: reservationEmailAssets.mark, content_id: "cymba-mark" },
    ...(job.kind === "paid" ? [{ filename: "cymba-earbuds.png", content: reservationEmailAssets.product, content_id: "cymba-earbuds" }] : []),
  ];
  return { subject, html, text, attachments,
    headers: { "X-Entity-Ref-ID": "cymba-" + (preview ? "preview-" : "reservation-") + job.id } };
}

const emailLabels: Record<ReservationEmailKind, { eyebrow: string; status: string; heading: string }> = {
  paid: { eyebrow: "Reservation confirmed", status: "Confirmed", heading: "Your place.<br><span style=\"color:#77777d\">Reserved.</span>" },
  processing: { eyebrow: "Payment update", status: "Processing", heading: "We're processing your reservation" },
  failed: { eyebrow: "Payment update", status: "Not completed", heading: "Let’s try that again." },
  partially_refunded: { eyebrow: "Refund update", status: "Partial refund", heading: "Your refund.<br><span style=\"color:#77777d\">An update.</span>" },
  refunded: { eyebrow: "Refund confirmed", status: "Refunded", heading: "Your deposit.<br><span style=\"color:#77777d\">Returned.</span>" },
  refund_review: { eyebrow: "Refund update", status: "Needs attention", heading: "Let’s get this<br>sorted." },
};

function renderEmail({ job, subject, intro, paragraphs, details, reference }: {
  job: ReservationEmailJob; subject: string; intro: string;
  paragraphs: string[]; details: [string, string][]; reference: string;
}): string {
  const label = emailLabels[job.kind];
  const paid = job.kind === "paid";
  const refund = job.kind === "refunded" || job.kind === "partially_refunded";
  const mainAmount = refund ? money(job.snapshot.amount_refunded, job.snapshot.currency) : money(job.snapshot.amount, job.snapshot.currency);
  const amountLabel = refund ? "Total refunded" : paid ? "Deposit received" : "Reservation deposit";
  const compactMoney = mainAmount.replace(/GBP\s/, "£").replace(/USD\s/, "US$").replace(/\.00$/, "");
  const displayMoney = (copy: string) => copy.replace(/GBP\s/g, "£").replace(/USD\s/g, "US$");
  const p = (copy: string) => `<p style="margin:0;font-size:15px;line-height:1.65;color:#6e6e73">${escape(copy)}</p>`;
  const heading = (copy: string) => `<h2 style="margin:0 0 10px;font-size:19px;line-height:1.35;letter-spacing:-.4px;font-weight:600;color:#1d1d1f">${escape(copy)}</h2>`;
  const section = (name: string, copy: string) => `<tr><td class="content-pad" style="padding:0 44px 28px">${heading(name)}${p(copy)}</td></tr>`;
  const body = paid
    ? section("What happens next", paragraphs[0])
      + `<tr><td class="content-pad" style="padding:0 44px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:20px 24px;background:#f6f3ed;border:1px solid #e9e1d4;border-radius:16px"><p style="margin:0 0 10px;color:#7f6238;font-size:10px;line-height:1.5;letter-spacing:1.6px;text-transform:uppercase;font-weight:600">Your reservation benefits</p>${p(paragraphs[1])}</td></tr></table></td></tr>`
      + `<tr><td class="content-pad" style="padding:0 44px 28px">${p(paragraphs[2])}<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#6e6e73">${escape(paragraphs[3])}</p></td></tr>`
    : paragraphs.map(copy => `<tr><td class="content-pad" style="padding:0 44px 24px">${p(copy)}</td></tr>`).join("");
  const helpUrl = job.kind === "failed" ? "https://trycymba.com/reserve" : `mailto:${SUPPORT}?subject=${encodeURIComponent(`Reservation ${reference}`)}`;
  const button = job.kind === "failed" ? "Try again" : "Contact support";
  const action = job.kind === "failed" || job.kind === "refund_review"
    ? `<tr><td class="content-pad" align="center" style="padding:0 44px 30px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#1d1d1f" style="border-radius:30px;background:#1d1d1f;mso-padding-alt:15px 28px"><a href="${escape(helpUrl)}" style="display:inline-block;padding:15px 28px;color:#ffffff;font-size:13px;font-weight:500;line-height:1.4;text-decoration:none;border:1px solid #1d1d1f;border-radius:30px;mso-padding-alt:0">${button}</a></td></tr></table></td></tr>`
    : "";
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escape(subject)}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}table{border-collapse:separate}img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}a{color:inherit}a:focus-visible{outline:2px solid #9c7b4a;outline-offset:4px}@media only screen and (max-width:600px){.outer-pad{padding:0!important}.email-shell{border-radius:0!important}.content-pad{padding-left:26px!important;padding-right:26px!important}.brand-pad{padding:28px 26px!important}.hero-pad{padding:36px 26px 20px!important}.hero-title{font-size:42px!important;letter-spacing:-1.7px!important}.product-image{width:150px!important;max-width:100%!important}.reference{font-size:40px!important}.amount{font-size:27px!important}.summary-pad{padding:24px!important}.status{font-size:9px!important;padding:7px 10px!important}.footer-pad{padding:30px 26px!important}}</style><!--[if mso]><style>body,table,td,h1,h2,p,a{font-family:Arial,sans-serif!important}</style><![endif]--></head>
<body style="margin:0;padding:0;width:100%;background:#ededf0;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escape(intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ededf0"><tr><td align="center" class="outer-pad" style="padding:36px 16px">
<!--[if mso]><table role="presentation" width="640" align="center" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-shell" bgcolor="#ffffff" style="width:100%;max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden">
<tr><td class="brand-pad" style="padding:32px 44px;border-bottom:1px solid #eeeeef"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td valign="middle" style="padding-right:8px"><img src="cid:cymba-mark" width="29" height="32" alt="" style="display:block;width:29px;height:32px;object-fit:contain"></td><td valign="middle" style="font-size:31px;line-height:1;letter-spacing:-1.8px;font-weight:500;color:#1d1d1f">cymba</td></tr></table></td><td align="right" valign="middle"><span class="status" style="display:inline-block;padding:8px 12px;border:1px solid #e7dfd2;border-radius:30px;color:#7f6238;font-size:10px;line-height:1.2;font-weight:600;letter-spacing:.3px;white-space:nowrap">${label.status}</span></td></tr></table></td></tr>
<tr><td class="hero-pad" align="center" style="padding:42px 44px 22px"><p style="margin:0 0 16px;font-size:10px;line-height:1.5;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#9c7b4a">${label.eyebrow}</p><h1 class="hero-title" style="margin:0 0 20px;font-size:52px;line-height:1.04;letter-spacing:-2.4px;font-weight:600;color:#1d1d1f">${label.heading}</h1><p style="margin:0;max-width:430px;font-size:16px;line-height:1.65;color:#6e6e73">${escape(displayMoney(intro))}</p></td></tr>
${paid ? `<tr><td align="center" style="padding:2px 20px 22px"><img class="product-image" src="cid:cymba-earbuds" width="174" height="301" alt="cymba earbuds from the site hero, with gold detailing and trailing cables" style="display:block;width:174px;max-width:100%;height:auto"></td></tr>` : `<tr><td height="14" style="font-size:1px;line-height:14px">&nbsp;</td></tr>`}
<tr><td class="content-pad" style="padding:0 44px 34px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#1d1d1f" style="background:#1d1d1f;border-radius:18px"><tr><td class="summary-pad" style="padding:28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="52%" valign="top" style="padding-right:12px"><p style="margin:0 0 10px;color:#c9ae83;font-size:9px;line-height:1.5;letter-spacing:1.4px;text-transform:uppercase">Reservation</p><p class="${reference.startsWith("#") ? "reference" : ""}" style="margin:0;color:#ffffff;font-size:${reference.startsWith("#") ? "48" : "17"}px;line-height:1.08;letter-spacing:-1.2px;overflow-wrap:anywhere;word-break:break-word;font-weight:500">${escape(reference)}</p></td><td width="48%" valign="top" align="right"><p style="margin:0 0 16px;color:#c9ae83;font-size:9px;line-height:1.5;letter-spacing:1.2px;text-transform:uppercase">${amountLabel}</p><p class="amount" style="margin:0;color:#ffffff;font-size:32px;line-height:1.1;letter-spacing:-1px;font-weight:500;white-space:nowrap">${escape(compactMoney)}</p></td></tr></table>${refund ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:1px solid #434345">${details.filter(([key])=>key === "Original deposit" || key === "Deposit remaining").map(([key,value])=>`<tr><td style="padding-top:14px;font-size:12px;color:#b6b6bc">${escape(key)}</td><td align="right" style="padding-top:14px;font-size:13px;color:#ffffff">${escape(displayMoney(value))}</td></tr>`).join("")}</table>` : ""}</td></tr></table></td></tr>
${body}
${action}
<tr><td class="footer-pad" align="center" bgcolor="#f8f8fa" style="padding:24px 44px;border-top:1px solid #ededf0;background:#f8f8fa"><p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#6e6e73">Questions? Reply to this email.<br><a href="mailto:${SUPPORT}" style="text-decoration:none;color:#6e6e73">${SUPPORT}</a></p><p style="margin:0;font-size:10px;line-height:1.6;color:#86868b">Frame Wearable, Inc., operating as cymba<br>2810 North Church Street, STE 89620<br>Wilmington, DE 19802, United States</p><p style="margin:12px 0 0;font-size:10px;color:#86868b"><a href="https://trycymba.com" style="color:#86868b;text-decoration:none">trycymba.com</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://trycymba.com/privacy" style="color:#86868b;text-decoration:underline">Privacy</a></p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
