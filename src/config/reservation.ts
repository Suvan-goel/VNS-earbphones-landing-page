/** One source of truth for the deposit shown to customers and charged at checkout. */
export const reservation = {
  merchantName: "Frame Wearable, Inc.",
  amount: 5000,
  currency: "usd",
  depositLabel: "US$50",
  cta: "Reserve for US$50",
  navCta: "Reserve",
  path: "/reserve",
  hostedUrl: "https://trycymba.com/reserve",
  termsVersion: "2026-10-25",
} as const;
