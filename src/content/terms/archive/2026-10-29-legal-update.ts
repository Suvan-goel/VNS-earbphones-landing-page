import { document as previous } from "./2026-10-28-founders-referrals";
const CURRENT_TERMS_VERSION = "2026-10-29-legal-update";
import type { TermsDocument, TermsRun, TermsSection } from "../types";

// Shared contract copy for the page and downloads. Refer only to immutable
// archived text, never mutable pricing or brand configuration. Archive this
// document before changing published wording or CURRENT_TERMS_VERSION.
const email = { label: "support@muraband.com", href: "mailto:support@muraband.com" } as const;
const paragraph = (...runs: TermsRun[]) => ({ kind: "paragraph" as const, runs });
const section = (id: string, title: string, ...blocks: TermsSection["blocks"]): TermsSection => ({ id, title, blocks });
function retained(id: string): TermsSection {
  const found = previous.sections.find((item) => item.id === id);
  if (!found) throw new Error("Missing archived terms section");
  return found;
}

export const document: TermsDocument = {
  version: CURRENT_TERMS_VERSION,
  title: "Terms of use and reservations",
  updated: "29 October 2026",
  sections: [
    section("about", "About these terms",
      paragraph("These terms explain how you may use the cymba website, join the cymba launch list and make a paid reservation when available. References to “cymba”, “we” and “us” mean Frame Wearable, Inc., operating as cymba. Our business address is 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States. For questions, contact ", email, ".")),
    section("launch-list", "The launch list",
      ...retained("the-launch-list").blocks,
      paragraph("A paid reservation is separate from the launch list and does not subscribe you to marketing.")),
    section("development", "Product development and availability",
      ...retained("product-development-and-availability").blocks,
      paragraph("We will confirm supported delivery destinations before you decide whether to buy. A reservation does not guarantee delivery to a particular country. If we cannot supply your location, we will refund your deposit in full.")),
    section("pricing", "Planned pricing and launch",
      paragraph("We plan to launch cymba in Q4 2027. The planned price of the earbuds is £400 in the UK, including applicable VAT, or US$449 in the US, excluding applicable sales tax, paid once. The planned software subscription is £15 a month in the UK, including applicable VAT, or US$15 a month in the US, excluding applicable sales tax. The website shows pounds sterling to visitors in the United Kingdom and US dollars to visitors elsewhere, selected automatically by location."),
      paragraph("Shipping is not included in these planned product prices. Final shipping costs and any location-dependent taxes outside the UK are not yet confirmed. We will explain the total price, shipping charges and any applicable taxes before orders open and before asking you to pay anything beyond the reservation deposit. The deposit shown at checkout is the total reservation payment charged now.")),
    section("reservations", "Paid reservations",
      ...retained("reservations").blocks,
      paragraph("The deposit shown at checkout is the total reservation payment charged now. You can save a copy of your recorded reservation and the available terms archive from the confirmation page. Keep that download and your payment receipt for your records.")),
    section("founding-offer", "The Founding 50 offer",
      retained("founding-offer").blocks[0],
      paragraph("The free subscription months begin when you activate your delivered product. If a qualifying reservation is cancelled, its place passes to the next confirmed paid reservation. Your reservation reference number will not change. Our support team will confirm any eligibility gained through a cancelled place; a reference number above 50 does not itself confirm or rule out that eligibility. Contact ", email, " if you need your eligibility checked.")),
    section("subscription", "Software subscription and free months",
      paragraph("After the free period, the planned standard software subscription price is £15 a month in the UK, including applicable VAT, or US$15 a month in the US, excluding applicable sales tax. Before you decide whether to buy, we will explain which features need a subscription and what works without one. We will provide the final subscription price, renewal and cancellation terms before activation."),
      paragraph("Making a reservation does not start a subscription or authorise recurring charges. Neither expiry of free months nor product activation alone authorises a paid subscription. We will ask you to separately agree to the paid subscription and its terms before charging you for it.")),
    section("referrals", "Referral rewards",
      ...retained("referrals").blocks,
      paragraph("Once a referral month has been earned, it stays earned even if the referred friend later cancels their reservation. There is no cap on earned referral months and they do not expire. Each friend still counts only once. We will preserve the reward record until the months are used, including if they are not used at the first product activation."),
      paragraph("When recommending cymba through this offer, make the incentive clear to your friend or audience, for example: “I receive a free month of cymba software if you reserve through my referral.” Share your reservation number and the public reservation page, not a private checkout or confirmation link. Do not send us someone else’s contact details without their permission.")),
    section("refunds", "Reservation cancellation and refunds",
      paragraph("You can cancel your reservation for a full refund at any time before your pair ships. Tell us clearly that you want to cancel, preferably by emailing ", email, ". Include your reservation number or payment reference if available. Using the email address on your reservation helps us locate it, but you may use another address or write to our business address if needed. We may ask for reasonable information to identify the reservation. Please do not send card details by email."),
      paragraph("We will acknowledge your cancellation and initiate the full refund to your original payment method within 7 working days after receiving your cancellation request, or after a refund otherwise becomes due, and sooner where the law requires. We do not charge a cancellation or refund fee. Your payment provider may take additional time to show the refund. If you decline the final purchase offer, or if we decide not to ship the product, your deposit will be refunded in full. A reservation does not guarantee a particular launch price, product specification or delivery date."),
      paragraph("If expected shipping moves beyond Q4 2027, we will notify you promptly, explain the revised timing or any uncertainty, and offer you a choice of a full refund or keeping your reservation. We will ask for your agreement to continue waiting and give you a response deadline in that notice. Unless you agree to continue by that deadline, we will cancel your reservation and initiate a full refund. You can still cancel for a full refund at any time before your pair ships, even if you agreed to wait."),
      paragraph("Our voluntary refund promise is additional to any statutory cancellation, refund or other consumer rights that apply to you. It does not mean that your legal rights end when the product ships. For UK consumers, a qualifying distance service contract normally has a 14-day cancellation period from entering the contract; for a qualifying goods contract, the normal period runs until 14 days after delivery. The rules applicable to any final product purchase will be provided before you buy. You do not need to give a reason or use a particular form to exercise a statutory right to cancel.")),
    section("cancellation-form", "Optional cancellation form",
      paragraph("You may use this form, but any clear statement that you wish to cancel is sufficient. Send it by email to ", email, " or by post to Frame Wearable, Inc., 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States."),
      { kind: "form", runs: ["To Frame Wearable, Inc.:\nI/We hereby give notice that I/We cancel my/our contract for the sale of the following goods / supply of the following service:\n\nOrdered on / received on:\nReservation number (if available):\nName of consumer(s):\nAddress of consumer(s):\nSignature of consumer(s) (only if sent on paper):\nDate:\n\nDelete as appropriate."] }),
    retained("product-information"),
    retained("using-this-website"),
    retained("privacy"),
    section("updates-and-your-rights", "Updates and your rights",
      paragraph("We may update these terms as the website and product develop. Changes apply to new reservations after the updated version takes effect. They do not remove the refund, deposit-credit, qualifying Founding 50 offer or referral reward commitments already accepted or earned under an earlier version. Nothing in these terms excludes or limits rights or responsibilities that cannot lawfully be excluded or limited. Mandatory consumer protections that apply where you live remain available."),
      paragraph(`Reservation terms version: ${CURRENT_TERMS_VERSION}.`)),
    section("contact", "Contact and complaints",
      paragraph("For questions or a complaint about this website, the launch list, a reservation or referral rewards, contact ", email, ". Explain what happened and how you would like us to resolve it, with your reservation number if relevant. We will review the issue and respond to you. This complaints process does not restrict your rights to seek other remedies."),
      paragraph("Frame Wearable, Inc., operating as cymba, 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States.")),
  ],
};
