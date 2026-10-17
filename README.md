# VNS-earbphones-landing-page

Premium earphones that combine high quality audio with cutting-edge neurostimulation technology to improve learning, focus and productivity during deep work tasks.

This repository is the demand-validation landing page: a Next.js (App Router) + TypeScript + Tailwind CSS site with a working early-access waitlist, an optional research survey, and privacy-conscious conversion tracking.

## Quick start

```bash
npm install
cp .env.example .env.local     # optional; without it the form runs in demonstration mode
npm run dev                    # http://localhost:3000
```

To try the full signup flow locally without a database, set `WAITLIST_STORAGE=file` in `.env.local`. Signups, survey answers and events are then written to `.data/*.json` (development only).

## Where to change things

| What | Where |
| --- | --- |
| Brand and product name (placeholders: "Aurel" / "Aurel One") | `src/config/site.ts` → `site` |
| Hero headline, subhead and CTA variants | `src/config/site.ts` → `heroVariants`, `defaultVariant` |
| Survey questions, price bands, roles | `src/config/site.ts` → `survey` |
| Contact email, site URL | `.env` (`NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SITE_URL`) |
| Social links (only real ones are rendered) | `src/config/site.ts` → `site.social` |
| Section copy | `src/components/sections/*.tsx` |
| FAQ | `src/components/sections/Faq.tsx` |
| Product illustrations | `src/components/visuals/*.tsx` |
| Privacy notice and terms (templates, need legal review) | `src/app/privacy`, `src/app/terms` |

## Positioning experiments

Three hero variants map to the three hypotheses in the brief:

- `learn` (default): learning and memory — `/?v=learn`
- `focus`: focus and deep work — `/?v=focus`
- `audio`: premium audio meets neuroscience — `/?v=audio`

The served variant is attached to every analytics event and saved on each waitlist signup, so conversion can be compared per variant. Point each ad or campaign at a `?v=` URL, or plug in your experimentation tool and pass its assignment through the same parameter.

## Backend: Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. It creates `waitlist` and `events` tables (RLS on, no public policies) and three reporting views: `funnel_by_variant`, `survey_summary`, `signups_by_source`.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your hosting environment. The key is used only in server routes (`src/app/api/*`) and is never sent to the browser.

Behaviour:

- Emails are validated and normalised (lowercased); duplicates return a friendly "already on the list" state via a unique index.
- Bot protection: hidden honeypot field, minimum fill time, and per-IP rate limiting (in-memory; swap `src/lib/rate-limit.ts` for Upstash/Redis on serverless). For heavier abuse, add Cloudflare Turnstile to `WaitlistForm` and verify the token in `/api/waitlist`.
- After signing up, the server returns a one-time survey token; the optional survey writes its answers onto the same `waitlist` row.
- With no backend configured, the API returns `demo` and the UI says plainly that nothing was saved. No success state is ever shown for unsaved data.

## Analytics

`src/lib/analytics.ts` sends allow-listed events to `/api/events` (stored in the `events` table), and mirrors them to Plausible or a `dataLayer` if present. Nothing is sent until the visitor allows analytics in the consent banner (configurable). No cookies; a random per-tab id lives in `sessionStorage` only after consent.

Events: `page_view`, `cta_click` (with `location`), `waitlist_submit_attempt`, `waitlist_signup_success`, `waitlist_signup_duplicate`, `waitlist_signup_error`, `survey_completed` (interest, intent, price, role), `survey_skipped`, `faq_open`. First-touch UTM parameters, referring domain and variant are attached to events and stored with each signup.

## Still needed before launch

- Final brand name, logo and domain.
- Real product renders or photography to replace the SVG concept illustrations (keep them labelled as concepts until there is a manufactured product).
- Supabase project and keys; an email provider (e.g. Resend, Postmark, Loops) for confirmation / double opt-in and updates.
- Legal review of the privacy notice and terms, company details, and data-processor list.
- Confirmed price bands for the survey.

## Scripts

- `npm run dev` — development server
- `npm run build` / `npm start` — production build and server
- `npm run typecheck` — TypeScript
