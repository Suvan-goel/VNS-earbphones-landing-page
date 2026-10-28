/**
 * One source of truth for the reservation flow. The deposit itself is priced
 * per market in `./pricing`: £35 for the UK, US$50 for the US.
 */
export const reservation = {
  merchantName: "Frame Wearable, Inc.",
  navCta: "Reserve",
  path: "/reserve",
  hostedUrl: "https://trycymba.com/reserve",
  termsVersion: "2026-10-28",
} as const;
