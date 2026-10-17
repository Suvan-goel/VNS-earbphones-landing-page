/**
 * Single source of truth for brand, copy experiments, survey options and
 * public links. Everything a non-engineer is likely to change lives here.
 *
 * Brand name is a PLACEHOLDER. Replace `brand` and `product` when the final
 * identity is chosen; nothing else in the codebase hard-codes the name.
 */

export const site = {
  brand: "Aurel", // placeholder company name
  product: "Aurel One", // placeholder product name
  /** Shown in the footer and privacy page until a legal entity exists. */
  legalName: "Aurel (working name)",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@example.com",
  /** Add real destinations only. Empty entries are not rendered. */
  social: [] as { label: string; href: string }[],
  seo: {
    title: "Aurel One — Premium earphones, built to explore how you learn",
    description:
      "Premium wired earphones combining exceptional sound with gentle, non-invasive ear stimulation and research-stage sensing. In development. Join early access.",
  },
};

/* -------------------------------------------------------------------------- */
/* Positioning experiments                                                     */
/* -------------------------------------------------------------------------- */

export type HeroVariant = {
  id: "learn" | "focus" | "audio";
  hypothesis: string;
  eyebrow: string;
  headline: string[]; // each entry renders on its own line on large screens
  subhead: string;
  primaryCta: string;
  secondaryCta: string;
};

export const heroVariants: Record<HeroVariant["id"], HeroVariant> = {
  // A. Learning and memory (default)
  learn: {
    id: "learn",
    hypothesis: "A. Learning and memory",
    eyebrow: "Now in development",
    headline: ["What if your earphones", "helped you learn?"],
    subhead:
      "Premium wired earphones with gentle, non-invasive ear stimulation built in. Developed to find out whether the pair you already study in can help you learn and remember more.",
    primaryCta: "Join early access",
    secondaryCta: "See how it works",
  },
  // B. Focus and deep work
  focus: {
    id: "focus",
    hypothesis: "B. Focus and deep work",
    eyebrow: "Now in development",
    headline: ["Earphones for", "your deepest work."],
    subhead:
      "Exceptional sound and serious isolation for long sessions, with integrated non-invasive neurostimulation being developed to explore what else your earphones could do for demanding work.",
    primaryCta: "Join early access",
    secondaryCta: "See how it works",
  },
  // C. Premium audio meets neuroscience
  audio: {
    id: "audio",
    hypothesis: "C. Premium audio meets neuroscience",
    eyebrow: "Now in development",
    headline: ["Extraordinary sound.", "With a mind of its own."],
    subhead:
      "A pair of premium wired earphones you'll love listening to, with integrated non-invasive neurotechnology being developed to explore new possibilities for learning and deep work.",
    primaryCta: "Join early access",
    secondaryCta: "See how it works",
  },
};

/** Variant served when no `?v=` query parameter is present. */
export const defaultVariant: HeroVariant["id"] = "learn";

/* -------------------------------------------------------------------------- */
/* Post-signup survey                                                          */
/* -------------------------------------------------------------------------- */

export const survey = {
  interest: {
    question: "What interests you most?",
    options: [
      { value: "learning", label: "Learning and remembering more" },
      { value: "focus", label: "Staying focused during demanding work" },
      { value: "sound", label: "Exceptional sound quality" },
      { value: "neurotech", label: "Personalised neurotechnology" },
      { value: "everything", label: "The combination of everything" },
    ],
  },
  intent: {
    question:
      "If its benefits were demonstrated and the sound met your expectations, how likely would you be to buy it?",
    options: [
      { value: "very_likely", label: "Very likely" },
      { value: "somewhat_likely", label: "Somewhat likely" },
      { value: "unsure", label: "Unsure" },
      { value: "unlikely", label: "Unlikely" },
    ],
  },
  /** Price bands are research options only. No price has been set. */
  price: {
    question: "What price would you seriously consider for a product like this?",
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
    question: "Anything that would hold you back? (optional)",
    placeholder: "Safety, comfort, price, evidence…",
    maxLength: 500,
  },
} as const;

export type SurveyKey = "interest" | "intent" | "price" | "role";
