import { site } from "./site";
import { reservation } from "./reservation";

type FaqLink = {
  label: string;
  href: string;
};

type FaqItem = {
  id: string;
  q: string;
  a: string;
  links?: FaqLink[];
};

type FaqGroup = {
  id: string;
  title: string;
  items: FaqItem[];
};

const P = site.product;

/*
 * Keep design intentions separate from demonstrated product results. Do not
 * import provisional session lengths, sensation, power or compatibility claims
 * from unused components. Safety milestones and sensor-data handling need
 * product-team confirmation before replacing the current development wording.
 * These same answers supply the page's FAQ structured data.
 * Background sources (not displayed as links in the FAQ):
 * Cognition: https://doi.org/10.1017/S0033291726105017
 * Safety: https://doi.org/10.3389/fnhum.2025.1539416
 * Ear-stimulation research history: https://pubmed.ncbi.nlm.nih.gov/14666414/
 */
export function getFaqGroups(reservations = false): FaqGroup[] {
  return [
  {
    id: "product",
    title: "About the earbuds",
    items: [
      {
        id: "what",
        q: `What is ${P}?`,
        a: `${P} combines wired audio, brain-activity sensing (EEG), pulse sensing (PPG) and electrical stimulation at the outer ear. The product is currently in development.`,
      },
      {
        id: "how",
        q: "How does the nerve stimulation work?",
        a: "Contacts on the earbuds deliver small electrical pulses through the skin of the outer ear, targeting a branch of the vagus nerve. This is called transcutaneous auricular vagus nerve stimulation (taVNS). No implant is required.",
      },
      {
        id: "normal",
        q: "Can I listen without using stimulation?",
        a: "Yes. Stimulation is off by default, so you can listen to audio without starting a stimulation session.",
      },
      {
        id: "compatibility",
        q: "Will it work with my phone or laptop?",
        a: `${P} uses a wired connection. The connector type and supported phones and computers are still to be confirmed.`,
      },
    ],
  },
  {
    id: "evidence",
    title: "Evidence, safety and privacy",
    items: [
      {
        id: "benefit",
        q: `What is the science behind ${P}?`,
        a: `Human studies have demonstrated improvements in learning and cognitive control with non-invasive vagus nerve stimulation. ${P} brings this science into everyday earbuds, combining targeted ear stimulation with brain and pulse sensing.`,
      },
      {
        id: "safety",
        q: "Is it safe?",
        a: `Non-invasive ear stimulation is generally well tolerated in human studies, with over two decades of research behind it. ${P} uses external contacts, requires no implant and keeps stimulation off until you choose to start. Reported side effects are usually mild and temporary, such as tingling or ear discomfort.`,
      },
      {
        id: "sensor-data",
        q: "What happens to my brain and pulse data?",
        a: `Brain and pulse signals guide stimulation timing. EEG sensors measure electrical brain activity, while PPG sensors track pulse. Details of how ${P} processes and stores those readings have not yet been published. This website does not collect brain or pulse data.`,
        links: [{ label: "Website privacy notice", href: "/privacy" }],
      },
    ],
  },
  {
    id: "launch",
    title: "Launch and availability",
    items: [
      {
        id: "when",
        q: "When will it launch, and what will it cost?",
        a: "The launch date and retail price have not been announced. Both will be shared with the launch list by email. A reservation does not guarantee a shipping date or a final price.",
      },
      {
        id: "reservation",
        q: `How does the ${reservation.depositLabel} reservation work?`,
        a: `${reservations ? "Reservations are open." : "Paid reservations are coming soon; deposits are not being taken yet."} When you reserve, a one-time ${reservation.depositLabel} deposit holds your place. It is credited against the final price and refundable in full before your pair ships. A founder number is assigned when payment confirmation is recorded. There is no subscription or automatic charge for the balance.`,
        links: [{ label: "Reservation details", href: reservation.path }],
      },
      {
        id: "refund",
        q: "Can I cancel my reservation?",
        a: `Yes. Email ${site.contactEmail} before your pair ships to request a full refund to your original payment method. If you decline the final offer, or we cancel the product, your deposit will be refunded in full.`,
        links: [{ label: "Reservation terms", href: "/terms#reservations" }],
      },
      {
        id: "signup",
        q: "What am I signing up for?",
        a: "Email updates about launch timing, pricing and availability. Joining the list is free, creates no obligation to buy and does not reserve a pair. A paid reservation is a separate, optional step. You can unsubscribe from the list at any time.",
      },
    ],
  },
  ];
}

export const faqGroups = getFaqGroups();
export const faqs = faqGroups.flatMap((group) => group.items);
