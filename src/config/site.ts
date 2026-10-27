/**
 * Single source of truth for brand, copy experiments, survey options and
 * public links. Everything a non-engineer is likely to change lives here.
 *
 * Keep the company and product identity here so every page stays consistent.
 */

export { reservation } from "./reservation";

const brand = "cymba";
const product = brand;

export const site = {
  brand,
  product,
  /** Public business label; this does not assert a registered legal entity. */
  legalName: brand,
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://trycymba.com",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@muraband.com",
  /** Add real destinations only. Empty entries are not rendered. */
  social: [] as { label: string; href: string }[],
  seo: {
    title: `${product} — The earbuds for deep work`,
    description:
      `${product}: gentle nerve stimulation built into everyday earbuds, for longer focus. Coming Q4 2027. Reserve from US$50, fully refundable, or join the waitlist.`,
  },
};

/* -------------------------------------------------------------------------- */
/* Positioning experiments                                                     */
/* -------------------------------------------------------------------------- */

export type HeroVariant = {
  id: "learn" | "focus" | "audio";
  hypothesis: string;
  eyebrow: string;
  headline: string[];
  subhead?: string;
  primaryCta: string;
};

export const heroVariants: Record<HeroVariant["id"], HeroVariant> = {
  // A. Cognitive outcomes (legacy analytics ID retained)
  learn: {
    id: "learn",
    hypothesis: "A. Cognitive outcomes",
    eyebrow: "Coming Q4 2027",
    headline: ["The earbuds", "for deep work."],
    subhead: "Focus on the tasks you care about for longer.",
    primaryCta: "Join the waitlist",
  },
  // B. Focus and deep work
  focus: {
    id: "focus",
    hypothesis: "B. Focus and deep work",
    eyebrow: "Coming Q4 2027",
    headline: ["For your most", "demanding work."],
    subhead:
      "Cognitive technology built around deeper focus, faster learning and stronger memory.",
    primaryCta: "Join waitlist",
  },
  // C. Cognitive ambition (legacy audio analytics ID retained)
  audio: {
    id: "audio",
    hypothesis: "C. Cognitive ambition",
    eyebrow: "Coming Q4 2027",
    headline: ["More from", "your mind."],
    subhead:
      `Meet ${product}. Targeted nerve stimulation in everyday earbuds, built for focus, learning and memory.`,
    primaryCta: "Join waitlist",
  },
};

/* -------------------------------------------------------------------------- */
/* Reservations                                                                */
/* -------------------------------------------------------------------------- */

/** Shared copy for the closing portrait in the animated and stacked layouts. */
export const closingHeadline = ["Give your brain", "an edge"] as const;
export const closingCta = "Join the waitlist";

/** Variant served when no `?v=` query parameter is present. */
export const defaultVariant: HeroVariant["id"] = "learn";

/* -------------------------------------------------------------------------- */
/* Post-signup survey                                                          */
/* -------------------------------------------------------------------------- */

export const survey = {
  interest: {
    question: "What interests you most?",
    options: [
      { value: "learning", label: "Learning and memory" },
      { value: "focus", label: "Focus for deep work" },
      { value: "sound", label: "Sound quality" },
      { value: "neurotech", label: "Personalised neurotechnology" },
      { value: "everything", label: "The combination" },
    ],
  },
  intent: {
    question:
      `How likely would you be to consider buying ${product} when it launches?`,
    options: [
      { value: "very_likely", label: "Very likely" },
      { value: "somewhat_likely", label: "Somewhat likely" },
      { value: "unsure", label: "Unsure" },
      { value: "unlikely", label: "Unlikely" },
    ],
  },
  /** Price bands are research options only. No price has been set. */
  price: {
    question: "What price would you seriously consider?",
    currency: "USD",
    options: [
      { value: "lt_200", label: "Under $200" },
      { value: "200_349", label: "$200–349" },
      { value: "350_499", label: "$350–499" },
      { value: "500_749", label: "$500–749" },
      { value: "750_plus", label: "$750 or more" },
    ],
  },
  role: {
    question: "Which best describes you?",
    options: [
      { value: "student", label: "Student" },
      { value: "developer", label: "Software developer" },
      { value: "researcher", label: "Researcher" },
      { value: "knowledge_worker", label: "Knowledge worker" },
      { value: "audio_enthusiast", label: "Audio enthusiast" },
      { value: "other", label: "Something else" },
    ],
  },
  concern: {
    question: "What would hold you back?",
    placeholder: "Safety, comfort, price, evidence…",
    maxLength: 500,
  },
} as const;

export type SurveyKey = "interest" | "intent" | "price" | "role";
