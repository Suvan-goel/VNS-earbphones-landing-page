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
    title: "Aurel One — Premium earphones, engineered for the way you learn",
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
    eyebrow: "Introducing Aurel One",
    headline: ["Earphones engineered", "for the way you learn."],
    subhead:
      "Premium wired sound, with gentle ear stimulation built into the earpiece. Designed for the hours you spend studying, and for finding out how much more your earphones can do.",
    primaryCta: "Join early access",
    secondaryCta: "Explore the technology",
  },
  // B. Focus and deep work
  focus: {
    id: "focus",
    hypothesis: "B. Focus and deep work",
    eyebrow: "Introducing Aurel One",
    headline: ["Built for", "your deepest work."],
    subhead:
      "Exceptional sound and serious passive isolation for long sessions, with non-invasive ear stimulation built in. Designed for the work that needs all of you.",
    primaryCta: "Join early access",
    secondaryCta: "Explore the technology",
  },
  // C. Premium audio meets neuroscience
  audio: {
    id: "audio",
    hypothesis: "C. Premium audio meets neuroscience",
    eyebrow: "Introducing Aurel One",
    headline: ["Extraordinary sound.", "Engineered for the mind."],
    subhead:
      "A pair of premium wired earphones you will love listening to, with integrated neurotechnology that reaches beyond what you hear.",
    primaryCta: "Join early access",
    secondaryCta: "Explore the technology",
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
