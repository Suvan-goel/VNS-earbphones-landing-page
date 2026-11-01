import { site } from "./site";
import { reservation } from "./reservation";
import { formatBothMarkets, foundersOffer, launch } from "./pricing";

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
        a: `${P} brings audio, brain-activity sensing (EEG), pulse sensing (PPG) and targeted ear stimulation together in one pair of wired earbuds. We're developing it to make this technology a natural part of everyday listening.`,
      },
      {
        id: "how",
        q: "How does the nerve stimulation work?",
        a: "Small contacts on the earbuds deliver electrical pulses through the skin of your outer ear, targeting a branch of the vagus nerve. The technique is called transcutaneous auricular vagus nerve stimulation (taVNS). It is non-invasive and requires no implant.",
      },
      {
        id: "normal",
        q: "Can I listen without using stimulation?",
        a: `Absolutely. You can use ${P} just for audio whenever you like. Stimulation is off by default and only starts when you choose to begin a session.`,
      },
      {
        id: "compatibility",
        q: "Will it work with my phone or laptop?",
        a: `${P} uses USB-C for a straightforward wired connection to compatible phones and computers. We'll confirm supported devices and adapter options closer to launch, so you can check your setup before buying.`,
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
        a: `${P} builds on human research into non-invasive vagus nerve stimulation. Studies have demonstrated improvements in learning and cognitive control with this approach. We're bringing that science into everyday earbuds, combining targeted ear stimulation with brain and pulse sensing.`,
      },
      {
        id: "safety",
        q: "Is it safe?",
        a: `Non-invasive ear stimulation has been studied for over two decades and is well tolerated in human research. ${P} uses contacts on the outer ear, with no implant required. You're in control: stimulation stays off until you choose to start a session.`,
      },
      {
        id: "sensor-data",
        q: "What happens to my brain and pulse data?",
        a: `The sensors have a clear purpose: EEG measures electrical brain activity and PPG tracks pulse to guide stimulation timing. This website does not collect either kind of reading. Product-specific details about how ${P} processes and stores sensor data have not yet been published.`,
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
        a: `We're planning to launch in ${launch.window}. The planned price of the earbuds is ${formatBothMarkets("retail")}, paid once, and the ${P} software subscription is planned at ${formatBothMarkets("subscription", " a month")}. The first ${foundersOffer.limit} paid reservations qualify for the Founding ${foundersOffer.limit} offer. Currency is set automatically by location: pounds for UK visitors and US dollars elsewhere. We'll confirm final pricing, taxes and shipping with the launch list before orders open, and if you reserve you'll see them before deciding whether to complete your purchase.`,
      },
      {
        id: "reservation",
        q: "How does the reservation deposit work?",
        a: `${reservations ? "Reservations are open." : "Paid reservations are coming soon; deposits are not being taken yet."} Your one-time deposit of ${formatBothMarkets("deposit")} holds your place and is credited in full against the price of the earbuds if you choose to buy. It is fully refundable before your pair ships, with no subscription or automatic charge for the balance. Your reservation number is assigned once we record payment confirmation. Any Founding ${foundersOffer.limit} discount is applied in addition to your deposit credit.`,
        links: [{ label: "Reservation details", href: reservation.path }],
      },
      {
        id: "founding-offer",
        q: `What is included in the Founding ${foundersOffer.limit} offer?`,
        a: `The first ${foundersOffer.limit} paid reservations receive ${formatBothMarkets("founderDiscount")} off the launch recommended retail price, the first ${foundersOffer.freeMonths} months of the software subscription free, and limited-edition Founders Buds at no extra cost when they buy the finished product. The discount is in addition to the full credit for your reservation deposit. The free months begin when you activate your delivered product. After the free period, the planned standard subscription price is ${formatBothMarkets("subscription", " a month")}; we'll confirm the final subscription terms before activation. Founders Buds differ from the standard product in finish only. Places are allocated in the order we record successful payment confirmations. If a qualifying reservation is cancelled, its place passes to the next confirmed paid reservation.`,
        links: [{ label: "Founding offer details", href: "/terms#founding-offer" }],
      },
      {
        id: "referrals",
        q: "Can I earn more free subscription months by referring friends?",
        a: `Yes. All paid reservation holders can earn ${foundersOffer.referralMonths} extra month of the software subscription free for each additional friend they refer who completes a paid reservation. Each friend counts once. After paying, your friend emails ${site.contactEmail} from their reservation email address and includes your reservation number. Our support team verifies their paid reservation and records the free month for you. These months are added to your free subscription period when you activate your delivered product. Referral rewards are separate from the first-${foundersOffer.limit} limit. Your friend's own reservation benefits, including eligibility for the Founding ${foundersOffer.limit} offer, are determined independently by their reservation.`,
        links: [{ label: "Referral reward details", href: "/terms#referrals" }],
      },
      {
        id: "refund",
        q: "Can I cancel my reservation?",
        a: `Yes. Your deposit is fully refundable at any time before your pair ships. Email ${site.contactEmail} from your reservation email address and we'll return it to your original payment method. If you decline the final offer, or the product does not ship, you'll receive a full refund.`,
        links: [{ label: "Reservation terms", href: "/terms#reservations" }],
      },
      {
        id: "signup",
        q: "What am I signing up for?",
        a: "You'll receive email updates about launch timing, pricing and availability. Joining is free, there's no obligation to buy, and you can unsubscribe at any time. If you'd like to reserve a pair, a paid reservation is a separate, optional step.",
      },
    ],
  },
  ];
}

export const faqGroups = getFaqGroups();
export const faqs = faqGroups.flatMap((group) => group.items);
