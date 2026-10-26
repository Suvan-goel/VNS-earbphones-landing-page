# VNS-earbphones-landing-page

cymba: premium wired earphones with integrated ear stimulation, launching soon.

This repository is the launch landing page: a Next.js (App Router) + TypeScript + Tailwind CSS site with a launch-update waitlist, an optional research survey, and privacy-conscious conversion tracking.

## Page flow

The page opens with a centered hero: the title, description and email signup sit above the centered transparent earbuds visual on every screen size. The hero has one primary action and no secondary explore link or launch-update note. An editorial product section follows, with an intimate listening portrait beside concise copy on desktop and a stacked layout on smaller screens. The page then moves through how it works, evidence and launch progress, sound and comfort, questions, and the signup form. The detailed component illustration is available in the expandable “Explore the design” panel. Background research links describe other devices and protocols, not evidence for cymba.

The hero includes a compact email signup form. It posts to the same server endpoint as the full form at `#signup`, with a short inline confirmation. Navigation signup buttons target `#signup`; `#early-access` links to the complete section with optional research invitations and the post-signup survey. Both forms stack on narrow screens. Signup means launch updates and optional research invitations, not a preorder or a guaranteed testing place.

The technology section uses `TechnologyTour.tsx` and its CSS module for a scroll-driven sequence of three different product angles: contact-side, front-facing audio housing, and reverse ear-tip view. Native scrolling crossfades between dedicated ImageGen assets with gentle zoom and matching copy. This is an image sequence, not a 3D turntable. Reduced-motion preferences, viewports under 620px tall, and the pre-hydration/no-JavaScript layout show all three images and descriptions without pinning or movement. The transparent `technology-*-angle.webp` images were generated with built-in ImageGen using the existing earbud as an identity reference; prompts and provenance are in `src/assets/earbuds/imagegen-technology-angles-prompts.json`.

## Quick start

```bash
npm install
cp .env.example .env.local     # optional; without it the form runs in demonstration mode
npm run dev                    # http://localhost:3000
```

The local preview uses `.next-dev`, separately from production builds in `.next`, so running a build does not overwrite a running preview's files.

To try the full signup flow locally without a database, set `WAITLIST_STORAGE=file` in `.env.local`. Signups, survey answers and events are then written to `.data/*.json` (development only).

## Local 3D product model

The hero uses `public/models/cymba-earbuds-hero.glb`, a 2.93 MB Draco export containing only the two original textured earbuds. The pair is presented at a smaller scale, with smooth cables hanging straight down and fading along their length. The controller, coil, Y connector and USB lead are absent from this presentation; the editable full Blender assembly is preserved in `output/meshy-earbud-blender`.

`src/components/three/EarbudExperience.tsx` controls the scroll transition from the floating pair onto the user-supplied Meshy neural head bust, then rotates the head and fitted earbuds together through only 45 degrees in total and holds that pose. `Mannequin.tsx` loads `public/models/cymba-neural-mannequin-premium.glb`: opaque honed ivory marble baked in Blender, with purple surface neural highlights and additional fine branches across the sides and back. A short brainstem motif and continuous neck curves replace the former glass cutaway and pink internal network. The earbud landing positions fit the new ear spacing. The neural pattern is traced into smooth, connected 3D filaments in Blender, with clean marble underneath and finer posterior/neck curves. As scroll advances, a softened wave spreads from the ears through the network and settles into a violet glow. `NeuralGlow.tsx` adds selective HDR bloom at two blur scales, preserving the transparent canvas and keeping the marble and earbuds out of the glow. They hold steady when scrolling stops and dim when scrolling back; these remain schematic artistic projections, not anatomical or measured brain activity. The editable Blender source, baked textures, source checksum and export report are in `output/neural-mannequin`. The original supplied download is unchanged. The previous attributed scan is retained with its credits in `public/models/credits.txt`. Framing fits desktop and phone canvases, loading/unavailable 3D uses the existing earbuds poster, and reduced-motion layouts retain still imagery. Viewers activate only when visible and pause offscreen.

The earbuds can render and respond to scrolling while the mannequin loads separately. The viewer hides the loading poster after completed screen draws, detects a stalled renderer and recreates it at the current scroll position, and offers a cache-clearing retry if assets cannot load. Development checks at `/dev/scene-recovery` cover delayed mannequin loading, render-loop stalls and context loss; `/dev/scroll-sync` checks native scrolling with a deliberately frozen animation input. Run `node --test tests/scene-health.test.cjs tests/product-stage-scroll.test.cjs` for the timing and recovery checks.

## Where to change things

| What | Where |
| --- | --- |
| Company and product name ("cymba") | `src/config/site.ts` → `brand` and `product` |
| Hero headline, subhead and CTA variants | `src/config/site.ts` → `heroVariants`, `defaultVariant` |
| Survey questions, price bands, roles | `src/config/site.ts` → `survey` |
| Contact email, site URL | `.env` (`NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SITE_URL`) |
| Social links (only real ones are rendered) | `src/config/site.ts` → `site.social` |
| Section copy | `src/components/sections/*.tsx` |
| FAQ questions, answers and supporting links | `src/config/faq.ts` |
| FAQ layout | `src/components/sections/Faq.tsx` |
| Product, lifestyle and technology images | `src/assets/earbuds/*.webp` (rendered in `Hero.tsx`, `ProductReveal.tsx`, `Story.tsx` and `Technology.tsx`) |
| Social sharing image | `src/app/opengraph-image.tsx`, using `src/assets/earbuds/hero-campaign-social-corrected.jpg` |
| Privacy notice and terms (templates, need legal review) | `src/app/privacy`, `src/app/terms` |

## FAQ

The FAQ separates the product design, evidence/safety/privacy, and launch details into nine questions with short, direct answers. The visible answers and FAQ structured data both use `src/config/faq.ts`. Research informs the copy; study links are intentionally omitted from the public FAQ, with background sources retained in source comments. The science answer describes promising evidence for the approach, and the safety answer describes tolerability reported in ear-stimulation research. Neither claims product-specific clinical validation or universal safety. Before adding product-specific claims, confirm results and safety milestones, intended users, the stimulation experience and controls, final compatibility, sensor-data processing and storage, and commercial details. The section uses a simple “FAQ” heading and contains no waitlist CTA.

## Positioning experiments

Three hero variants map to the three hypotheses in the brief:

- `learn` (default, retained analytics ID): cognitive outcomes — `/?v=learn`
- `focus`: focus and deep work — `/?v=focus`
- `audio` (retained analytics ID): cognitive ambition — `/?v=audio`

The served variant is attached to every analytics event and saved on each waitlist signup, so conversion can be compared per variant. Point each ad or campaign at a `?v=` URL, or plug in your experimentation tool and pass its assignment through the same parameter.

## Brand logo

The public brand is `cymba`. `Wordmark.tsx` pairs the existing transparent charcoal Flow symbol from `src/assets/brand` with the current brand name as live text. The interim public support address is `support@muraband.com` (selected by the user on 25 October 2026); historical logo exports remain alongside the standalone symbols. The browser icon uses the same symbol. The original concept, transparent ImageGen master and export provenance are in `assets/brand/logo-concepts-v3` and `assets/brand/flow-v1`. These exports are PNGs.

## Product imagery

The locked product design is `assets/cymba-locked-design-reference.png`, supplied by the user. Use it as the product identity reference for future image edits: smoked translucent shells, matte black outer faceplates with champagne rims, plain black silicone fins, contacts and a green optical window on the inner body, silicone-tip electrodes, and a three-button wired controller. Older generated images and schematic comments may depict superseded geometry. The hero uses `hero-premium-pair-v2.webp`: a compact pair-led composition with smooth satin graphite finishes, subdued smoked housings, champagne trim and a secondary controller. It preserves the locked hardware architecture and genuine alpha so the product sits directly on the page. The image is a generated product visualisation, not a photograph of manufactured hardware. The native 1254 × 1254 PNG is retained beside the roughly 188 kB WebP. Built-in ImageGen prompts and provenance are in `src/assets/earbuds/imagegen-hero-premium-pair-v2-prompts.json`. Earlier studio, transparent and campaign assets are retained.

The original four images come from Runway generations made on 18 October 2026 for the landing page. Local WebP copies avoid expiring hosted image links. The product and lifestyle assets are generated imagery; source prompts and provenance are retained with the assets.

| Asset | Placement | Original Runway task |
| --- | --- | --- |
| `hero.webp` | Hero product and controller | `186cc210-2f18-41fa-b2c2-dfe3404c205d` |
| `focus.webp` | Study lifestyle scene | `b699b2b8-73cb-4b9d-810e-9499bf81e115` |
| `cafe.webp` | Café lifestyle scene | `92e9bb90-7bde-4b16-9804-699a597303e5` |
| `detail.webp` | Sound/product close-up | `53aab082-14b4-42bb-8bb4-173ddab569b9` |

The remaining ear-placement and exploded SVG diagrams were replaced on 19 October 2026 with `in-ear.webp` and `exploded.webp`, generated using built-in ImageGen with the existing product images as references. The fit and internal assembly are illustrative, not validated engineering. Legacy SVG source files are retained but are no longer rendered by the site.

The product imagery was then regenerated with built-in ImageGen for a consistent premium studio treatment and genuine transparent backgrounds. `detail-transparent.webp` and `exploded-transparent.webp` sit directly against the page with preserved alpha channels. The earlier `hero-transparent.webp` and sharing image are retained as references. Exact prompts and provenance are saved in `src/assets/earbuds/imagegen-transparent-prompts.json`; the earlier fit and assembly prompts remain in `imagegen-prompts.json`.

An earlier launch hero used `hero-campaign-minimal.webp` (3840 × 2160) and `hero-campaign-mobile-minimal.webp` (2496 × 3328). Built-in ImageGen simplified the setting to a smooth charcoal platform and quiet studio backdrop with soft light, preserving the earphone and controller design. The generated images were upscaled for these delivery sizes; they are not native 4K generations. Exact prompts, generated dimensions and export settings are in `src/assets/earbuds/imagegen-campaign-minimal-prompts.json`.

Previous campaign assets, including `hero-campaign-hd.webp` and `hero-campaign-mobile-hd.webp`, are retained for reference, with their enhancement prompts in `src/assets/earbuds/imagegen-campaign-hd-prompts.json`. The original campaign used the user's Sennheiser screenshot as an art-direction reference and the existing CYMBA renders as product references. The foreground eartip has been corrected to attach behind the inner housing. `hero-campaign-social-corrected.jpg` supplies the sharing card. Original prompts and provenance are in `src/assets/earbuds/imagegen-campaign-prompts.json`; the correction prompts are in `src/assets/earbuds/imagegen-campaign-correction-prompts.json`.

The product introduction pairs a 4:5 portrait with a vertically centred text column on desktop. The two-line “Built for a sharper mind” heading, short introduction and compact benefit rows form one group, covering deeper focus, faster learning and stronger memory. A balanced two-column grid, restrained type scale and fine separators keep the composition focused. The portrait is `src/assets/earbuds/listening-portrait-selected-retouch-v2.webp`. The user chose the earlier grey-background portrait over the rebuilt face. Built-in ImageGen retouched that selected image with softer highlights and a more neutral brown skin tone while preserving its face, profile, pose, earbud and framing. Some artificial skin texture remains visible when enlarged. The native 1122 × 1402 PNG, selected original and exact prompts are in `assets/cymba-portrait-selected-retouch-v2`. The earlier portrait assets remain retained. On mobile, the order is heading, square portrait, then benefits, matching the document reading order. The portrait is a generated concept visualisation. The earlier study and idea-workspace images are retained in `assets/cymba-cognition-v1` and `assets/cymba-cognition-v2` but are not rendered by this section.

Static imports through Next Image provide intrinsic dimensions and responsive image variants. The hero renders the complete transparent product at its intrinsic aspect ratio, with high fetch priority, a maximum width of 640px and the available content width on smaller screens. The lifestyle and fit images retain blur placeholders; transparent product renders use the default empty placeholder to avoid a background flash. Other images load lazily.

The “For your next breakthrough” cards use `src/assets/earbuds/breakthrough-natural-v1/{study,deep-work,learning}.webp`. These are built-in ImageGen edits of the original notebook, wooden computer desk and music-keyboard scenes, with wider context, smaller earbuds and no people. The 1122 × 1402 PNG masters and exact prompts are in `assets/breakthrough-natural-v1`; the original images remain in `site-imagery-v2`. The cards retain the “Lifestyle visualisations” label.

## Backend: Supabase

The local site is connected to **cymba-waitlist** (`rgepubiwuafdjsnksapi`), provisioned on 20 October 2026 as a Nano project in London (`eu-west-2`). [Open the Supabase dashboard](https://supabase.com/dashboard/project/rgepubiwuafdjsnksapi). The schema below is applied, and live signup, duplicate, survey, analytics, and public-access checks passed. Synthetic test records were removed.

On 21 October 2026, this project was transferred into the separate Free **CYMBA** organization (`pgwwzknidbugulmklrqv`) for handover to the user's Gmail account. The project reference and existing website credentials remained valid, and all 10 signup records were verified after the transfer. The new-account Owner invitation is prepared but has not yet been sent or accepted; the original account currently remains the organization owner.

Server credentials are in the ignored, owner-readable `.env.local`; Supabase CLI link metadata is ignored under `supabase/.temp/`. When deploying the website, configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the host's private environment settings. The database password is only for administration and is not needed by the website.

To recreate the setup in another environment:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. It creates `waitlist` and `events` tables (RLS on, no public policies) and three reporting views: `funnel_by_variant`, `survey_summary`, `signups_by_source`.
3. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in your hosting environment and in an ignored `.env.local` for local development. The secret is used only in server routes (`src/app/api/*`) and is never sent to the browser. Modern `sb_secret_` keys use the `apikey` header; `SUPABASE_SERVICE_ROLE_KEY` remains supported for existing integrations. Never use a `NEXT_PUBLIC_` variable for either secret.
4. Verify a signup is present in the `waitlist` table, retry the same email to confirm deduplication, and confirm public roles cannot read or write signup data. The schema explicitly revokes table, sequence, and reporting-view access from `anon` and `authenticated`, and grants access to the trusted server role.

Behaviour:

- Emails are validated and normalised (lowercased); duplicates return a friendly "already on the list" state via a unique index.
- Bot protection: hidden honeypot field, minimum fill time, and per-IP rate limiting (in-memory; swap `src/lib/rate-limit.ts` for Upstash/Redis on serverless). For heavier abuse, add Cloudflare Turnstile to `WaitlistForm` and verify the token in `/api/waitlist`.
- After signing up, the server returns a one-time survey token; the optional survey writes its answers onto the same `waitlist` row.
- In local development with no backend configured, the API returns `demo` and the UI says plainly that nothing was saved. Missing production credentials or a partial configuration return an unavailable error (HTTP 503). No success state is shown for unsaved data.
- Request bodies are size-limited and checked before use. Database requests have a timeout, and logs omit submitted email addresses and raw database error details.

## Analytics

`src/lib/analytics.ts` sends allow-listed events to `/api/events` (stored in the `events` table), and mirrors them to Plausible or a `dataLayer` if present. The consent banner has been removed. With the default consent requirement, analytics remain off for new visitors; previously saved consent is still respected. No cookies; a random per-tab id lives in `sessionStorage` only after consent.

Events: `page_view`, `cta_click` (with `location`), `waitlist_submit_attempt`, `waitlist_signup_success`, `waitlist_signup_duplicate`, `waitlist_signup_error`, `survey_completed` (interest, intent, price, role), `survey_skipped`, `faq_open`. First-touch UTM parameters, referring domain and variant are attached to events and stored with each signup.

### Optional Meta Pixel preparation

`src/lib/meta-pixel.ts` is retained as dormant preparation, separate from first-party analytics. The Cookie settings control and consent panel have been removed, and neither the page layout nor the signup form calls the Pixel. Website Meta measurement is therefore disabled, including for previously accepted marketing preferences. Re-enabling this integration requires restoring explicit consent controls as well as tracking entry points. The utility also stays disabled without a numeric `NEXT_PUBLIC_META_PIXEL_ID` in the public build configuration. Its versioned marketing preference does not inherit or change analytics consent. The Meta script is requested only after marketing consent, and only from the homepage. PageView is sent once per document; automatic configuration and SDK history tracking are disabled. Do not enable automatic advanced matching, automatic events, or Event Setup Tool rules in Meta.

`NEXT_PUBLIC_META_LEAD_TRACKING_ENABLED` defaults to false independently of the Pixel ID. Enable it only after reviewing the dataset's category restrictions and permitted events. When enabled, Lead requires HTTP 201, `created`, a returned survey token and current marketing consent. Duplicates, demo responses, errors and signups completed before consent never count. Events carry no custom parameters, submitted email, survey answers or survey token; the browser Pixel still communicates ordinary network/browser/page/cookie data, as explained in the privacy notice. There is no Conversions API integration.

Withdrawal clears pending events, revokes Pixel permission and removes accessible first-party Meta cookies. A rejected or withdrawn event is never replayed after a later grant. `node --test tests/meta-pixel.test.cjs` verifies consent isolation, delayed script loading, revocation races, confirmed-signup gating, data minimization and disabled configuration without contacting Meta. Before activation, complete the public privacy/contact details, configure and review the dataset, and verify requests plus Meta Test Events on the deployed site. Preparing the Pixel does not publish or enable any ads.

## Hosting: Sites

The root checkout remains the Next.js development site. The hosted version uses Vinext on a Cloudflare Worker in a separate, ignored checkout at `sites/cymba`, with Sites project ID `appgprj_6ad8da86c44c8191adebbfb1f67c376f`. The user approved public visibility, and Sites access revision 2 applied it successfully. [The generated Sites URL](https://cymba-one.suvang.chatgpt.site) returned HTTP 200 without authentication, and its homepage loaded in the browser.

The custom domain [trycymba.com](https://trycymba.com) is connected. Native Sites verification confirmed domain, provider and SSL status `active` at 15:48:02 UTC on 21 October 2026. Authoritative DNS (`ns21`) and the `1.1.1.1` resolver return only `162.159.143.30` and `172.66.3.26`, both verification TXT records are saved, and the parked A record is removed. An unauthenticated HTTPS request pinned to the new authoritative address `162.159.143.30` returned the CYMBA homepage with HTTP 200 and valid TLS. The configured public origin and homepage canonical remain `https://trycymba.com`. Some client DNS caches for this root domain may still return the old parking addresses and temporarily cause an SSL error; the local system/browser cache was still stale during verification, so an ordinary local browser visit to the root domain was not yet verified.

[www.trycymba.com](https://www.trycymba.com) is also connected: its CNAME points to `custom-domains.chatgpt.site`, and both verification TXT records are saved. Native verification confirmed domain, provider and SSL status `active` at 15:53:57 UTC on 21 October 2026. An ordinary HTTPS request, without a DNS override, returned HTTP 200; CYMBA branding, updated copy and the root-domain canonical were verified. The root-domain cache caveat above does not apply to this successful `www` check.

For future updates, sync the root `src/` contents into the hosted checkout's root application directories, preserving its Vinext, Worker and Sites configuration. The hosted checkout uses static `app/opengraph-image.png` instead of the original `src/app/opengraph-image.tsx`, which reads a source asset through the filesystem; regenerate that image when sharing-card content changes and retain the static replacement when syncing. Build, save and deploy the hosted checkout through the Sites tooling; changes to the root development site are not published automatically.

Hosted runtime values `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured through native Sites secret settings. No `.env` files are included in the hosted source. A synthetic production waitlist signup returned HTTP 201; its exact row was verified in Supabase and then removed.

## Still needed before launch

- Final product photography to replace the generated concept images once a manufactured product is available. Keep the current concept labels in the meantime.
- An email provider is still needed for confirmation / double opt-in and launch updates; the waitlist currently stores signups without sending mail.
- Legal review of the privacy notice and terms, company details, and data-processor list.
- Confirmed price bands for the survey.

## Scripts

- `npm run dev` — development server
- `npm run dev:reservations` — isolated local Stripe sandbox checkout at port 3015
- `npm test` — all 71 checks, including the local database and launcher safety tests
- `npm run build` / `npm start` — production build and server
- `npm run typecheck` — TypeScript
- `node --test tests/backend.test.cjs` — request validation, storage failures, duplicate handling, survey tokens, secret-key headers, and rate limits using a mocked Supabase response (no credentials or network required)

## Reservations (US$50 refundable deposit)

**Local-only work.** The user clarified on 25 October 2026 that reservations must remain local until they explicitly request publication. The live site was restored to pre-reservation Sites version 9 (`df5f075d8457c5418e96d09dd0d66ad00e43a972`). Do not publish the reservation changes or activate live Stripe payments as part of further local edits. Isolated local Stripe sandbox testing was explicitly requested later the same day.

The reservation journey now supports real **Stripe sandbox Checkout**, with no real money movement, on the local development site. The normal development and hosted configuration remain disabled unless explicitly activated. The live homepage continues offering the original free waitlist, without the reservation page or reservation copy. An isolated, temporary cymba Stripe sandbox was created for local tests; no live Stripe account or production database was modified.

The flow is free signup → optional reservation → hosted Stripe Checkout → reservation status. Visitors may also go directly to `/reserve`. The one-time US$50 deposit is credited against the eventual purchase and refundable in full before shipping. The retail price and shipping date remain unannounced; there is no subscription, automatic balance collection, discount, stock count or promised delivery date. Founder numbers are assigned when payment confirmation is recorded, not strict bank-payment chronology.

`src/config/reservation.ts` is the single source of truth for the amount, currency, CTA and terms version. The form requires agreement to the reservation terms. Paying a deposit does not opt the person into marketing. Post-signup email prefill uses short-lived browser session storage rather than a URL query parameter.

### Local reservation checkout

Run `npm run dev:reservations`, then open <http://127.0.0.1:3015/reserve>. Internet access and the installed Stripe CLI are required. The command starts signed Stripe webhook forwarding first, passes the signing secret privately to Next.js, and serves only on loopback port 3015. Ctrl+C stops both services. Keep the launcher running while making sandbox payments or refunds so their events can reach localhost. Do not run a second reservation server against the same database.

- The exact US$50 deposit is created server-side, with adaptive currency conversion disabled. The browser never receives the secret key or card data; cards are entered only on Stripe's hosted Checkout.
- The launcher selects only the isolated CLI configuration `.data/stripe-local/config.toml`, profile `default`, and checks its account against `.data/stripe-local/manifest.json`. Only sandbox keys are accepted. Existing `.env.local` values are preserved, but Supabase credentials are explicitly cleared for the child server.
- Reservation records and signed-event receipts persist in `.data/reservations-test-db`, a local PostgreSQL-compatible PGlite database using the same migration and atomic transaction as production. The free waitlist also uses local files. No production database requests are made. These files and credentials are git-ignored.
- The separate build directory `.next-reservations` avoids interfering with the normal development server. Analytics and Meta Pixel are disabled for this test instance.
- The reservation and confirmation pages clearly label Stripe test mode. Test transactions do not reserve a real shipping place, and confirmation emails are not sent. A production email service and launch review remain separate work.

The temporary sandbox is `acct_1UUNLUBuZ3AcrbGJ`, created 25 October 2026 using the public support address. **Claim it before 1 November 2026** to retain it. The private claim link is stored in `.data/stripe-local/manifest.json` and also appears on sandbox Checkout. Run `stripe --config .data/stripe-local/config.toml --project-name default sandbox claim` to open it. After claiming, run `stripe --config .data/stripe-local/config.toml --project-name default login` and select that same sandbox. Verify the account ID using `stripe --config .data/stripe-local/config.toml --project-name default whoami`. Then set `claimed` to `true` and `sandbox_expires_at` to `null` in the ignored local manifest. The launcher requires both this explicit ownership marker and a permanent `sk_test_`/`rk_test_` key before removing the temporary expiry; a claimable `rkcs_test_` key cannot bypass it. Do not switch this configuration to a live account. Claiming and permanent credentials require the account owner's action; they are not silently enabled by this setup.

For interactive testing, use only [Stripe's official test cards](https://docs.stripe.com/testing): `4242 4242 4242 4242`, a future expiry such as `12/34`, CVC `123`, and synthetic contact details. Leave “Save my information” unchecked. No real card is needed. Test partial/full refunds in the same sandbox and reload the confirmation page to see the recorded result.

Validation: all 71 automated checks pass, including the actual PostgreSQL transaction, signed webhook validation, payment/refund ordering, retries, concurrency, persistence, live-key rejection, and isolation from configured Supabase credentials. Real hosted sandbox Checkout creation and loading have been verified. The user completed the hosted sandbox test payment. The signed Stripe completion event returned HTTP 200 and the local page confirmed founder #001. Actual US$10 partial and US$40 remaining sandbox refunds both succeeded; signed refund events updated the local page through partial to full refund, with US$0 remaining. No real money was charged. The tested record remains in the local database for inspection and was verified after a complete server restart. A second checkout verified the cymba branding, loopback-only return URLs, exact USD price and session reuse on retry; its unused session was then expired in the sandbox.

### Future live activation (not authorized by this local setup)

The user selected **Frame Wearable, Inc.** as the business receiving cymba reservation deposits on 25 October 2026. Its selected live Stripe account is `acct_1U2U1BCayZz7QEuo`, confirmed in the authenticated Dashboard on 25 October 2026. The default local CLI currently identifies a different account labelled “Frame” (`acct_1U0P5v2WBYpT3ouE`) with test access only; do not substitute that account or overwrite the isolated reservation sandbox. The local reservation terms now identify Frame Wearable, Inc. as the deposit recipient. This selection does not authorize publication or switching the local test server to live payments. The live Account status page shows Payments and Payouts active, with no active verification tasks, also verified after the authorized branding changes below. A default USD Mercury payout account is linked. Successful-payment and refund emails are both enabled.

The user explicitly authorized replacing this account's customer-facing Mura branding with **cymba** on 25 October 2026. The live Dashboard now has public business name `cymba`, business website and support URL `https://trycymba.com`, support email `support@muraband.com` (the user-selected interim inbox), terms URL `https://trycymba.com/terms`, and privacy URL `https://trycymba.com/privacy`. Both statement descriptor and shortened descriptor are `CYMBA`. The existing cymba wordmark and square site icon replace the Mura images; the default brand colour is `#ffffff` and accent is `#202023`, with the logo preferred over the icon. Checkout now uses those brand colours, with its existing Inter font and rounded controls. Saved images and settings were verified after refresh; the receipt preview reads “Receipt from cymba”. No test email or live payment was sent. The legal entity remains Frame Wearable, Inc.; bank, ownership, public support phone and business/support address were not changed. The verified public business/support address is 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States. These Stripe branding changes do not authorize publishing the local reservation site or activating live checkout.

1. The reservation database migration in `supabase/migrations/` is applied to the existing Supabase project. Production requires Supabase; local JSON storage is never a production fallback.
2. The selected Frame Wearable, Inc. live account is connected through the protected server-only restricted key `STRIPE_SECRET_KEY`; keep the existing isolated sandbox for tests. Never place credentials in a public environment variable or source control.
3. The mandatory snapshot webhook at `https://trycymba.com/api/stripe/webhook` is active for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated` and `refund.failed`. Its signing secret is stored as `STRIPE_WEBHOOK_SECRET` in the hosting environment. The account and live mode match the API key.
4. In the sandbox, verify payment, delayed confirmation, cancellation, webhook retry, duplicate delivery and full/partial refund handling. Successful-payment and refund receipts are already enabled on the selected live account; verify the customer-facing receipt and its branding before launch; this code does not send a separate marketing or confirmation email.
5. Configure the live key and live webhook secret, confirm the business/contact/refund details, and set `RESERVATIONS_ENABLED=true`. Without the explicit flag, key, webhook secret and durable storage, checkout stays closed. Connecting a key alone cannot open reservations.

Payment confirmation belongs to signed webhooks. The return page only reads the stored reservation and distinguishes processing, confirmed, refunded and unavailable states; visiting a success URL cannot mark a payment paid. Refunds are initiated in the Stripe Dashboard and reflected by the webhook. A failed, canceled or returned refund enters a persistent `refund_review` state that requires support investigation; later payment notifications cannot hide that problem. Support requests go to `support@muraband.com`.

### Production preparation — 25 October 2026

The user requested the production setup, initially keeping checkout disabled, and selected `support@muraband.com` as the interim support/refund inbox. Stripe's customer-facing support email was saved and verified; the root site's default contact and `.env.example` match it. The Mura domain has a Microsoft 365 MX record. Mailbox delivery has not been verified. `trycymba.com` has no MX record, so do not switch support back until email routing and mailbox delivery work.

The user subsequently explicitly approved “prepare production with checkout disabled” and initially deferred Stripe key setup. That approval resolved the earlier automatic-review block. The migration was applied to the existing `cymba-waitlist` project (`rgepubiwuafdjsnksapi`): all 48 then-existing free-waitlist records were preserved, both reservation tables had RLS enabled, and anon/authenticated roles could not read reservations. Sites public version **13** was deployed with runtime environment revision **2**, `RESERVATIONS_ENABLED=false` and `NEXT_PUBLIC_CONTACT_EMAIL=support@muraband.com`. The existing Supabase secrets were preserved. The following 26 October connection supersedes the deferred key/webhook steps.

The local terms and privacy notice now identify Frame Wearable, Inc. and its verified public business address; refund requests use the interim support inbox. Privacy copy distinguishes Stripe's operational payment/refund receipts from marketing emails. The existing US$50/full-refund-before-shipping terms are preserved. The handling of deposits without an announced shipping date still needs launch review; calling the payment a reservation does not itself establish exemption from applicable merchandise-order rules. References: [FTC order/shipping guidance](https://www.ftc.gov/legal-library/browse/rules/mail-internet-or-telephone-order-merchandise-rule), [ICO privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/).

The restricted key named `cymba reservations production` has Checkout Sessions **Write**, Payment Intents **Read**, Charges and Refunds **Read**, all other resource permissions **None**. These permissions were verified against the actual Checkout creation/retrieval/expiration and payment/refund read operations on 26 October. The runtime key does not need payout, webhook-management, refund-write or account-management access. The user completed key creation in the browser. Never paste the key into chat or commit it; it is stored as the protected Sites secret `STRIPE_SECRET_KEY`.

For the production snapshot webhook, select the eight event types listed above and API version `2026-09-30.endive`, matching the installed Stripe SDK. Store its signing secret in Sites as `STRIPE_WEBHOOK_SECRET`. The first release must use `RESERVATIONS_ENABLED=false`; leave `RESERVATIONS_PREVIEW` and `RESERVATIONS_LOCAL_TEST` unset. Webhooks remain active while new checkout is closed so existing payments/refunds can still be recorded. Confirm the deployed checkout rejects new attempts before any later activation.

Validation: the root local app passed all 71 automated tests and TypeScript checking. The reservation pages, payment/refund routes, legal updates and “Reserve yours” hero link have been ported into the hosted checkout while preserving its homepage and Sites/Vinext integration. Hosted TypeScript checking, production build and 25 reservation/database tests pass. Desktop and 390px mobile layout checks pass. Live https://trycymba.com/reserve shows “Reservations open soon”; POST `/api/reserve` returns 503 before writing; preview payment routes return 404. The live homepage retains the free waitlist without demonstration mode. Terms and privacy pages return 200 and show Frame Wearable, Inc. and the support address.

### Live Stripe connection — 26 October 2026

The user completed the authenticator challenge and live key creation, and explicitly approved delivery of the eight selected Checkout/refund event types to the cymba webhook. The active destination is `we_1UUhdSCayZz7QEuostK057yc` on Frame Wearable, Inc. (`acct_1U2U1BCayZz7QEuo`), with API version `2026-09-30.endive`. Both Stripe credentials are saved as protected Sites server secrets; no credential was committed or printed. Existing Mura/Frame destinations were left unchanged.

Sites public version **14** is deployed from commit `ba95616f49af6fd61e5451f3bf2c8588a5996c3c`, using environment revision **3**, still with `RESERVATIONS_ENABLED=false`. Deployment ID: `appgdep_6adef93fbda8819195cdf376b46b279d`. The hosted webhook now uses `await constructEventAsync(...)`; the previous synchronous method fails with the hosted Web Crypto provider. A regression test reproduced that failure before the fix. All **72** root tests, **26** hosted tests, both TypeScript checks and the hosted production build pass.

A controlled live Checkout session for exactly US$50 was created, retrieved, and immediately expired **unpaid**, using synthetic details and metadata excluded from reservation processing. Stripe delivered its real signed `checkout.session.expired` event (`evt_1UUhluCayZz7QEuooWCnxeJi`) to the deployed endpoint and received **HTTP 200**, shown as **Delivered / Recovered** in Stripe. The earlier pre-deployment 503 delivery was successfully retried. This verifies real Stripe delivery and hosted signature validation; it does not verify a live charge, receipt or refund. Database checks found zero reservations, zero reservation webhook records and 50 free-waitlist records. The probe did not create a reservation or take money.

Post-deployment checks: `/reserve` returns 200 and “Reservations open soon”; POST `/api/reserve` returns 503; an unsigned webhook returns 400; POST `/api/reserve/preview` returns 404. Public checkout remains closed pending the user's instruction to open reservations.

Correction verified against [Stripe's testing guidance](https://docs.stripe.com/testing) on 26 October: do not perform a real-card live payment/refund merely to test the integration. The Stripe Services Agreement prohibits live-mode testing with real payment details. The successful sandbox payment, partial/full refunds and durable records already cover the payment walkthrough; the live unpaid Checkout and signed expiration event cover live connectivity. Monitor the first genuine customer reservation and any genuine refund for operational confirmation instead. Live successful-payment and refund receipt switches were rechecked as enabled, with replies directed to `support@muraband.com`. Actual mailbox delivery has not been independently verified. A manual sandbox receipt is the supported option if a receipt-delivery test is requested. The previous recommendation to make a live test purchase was withdrawn before any charge or new checkout was created.

### Paid reservations open — 26 October 2026

The user explicitly answered **“Yes—open paid reservations”**, approving public US$50 reservations and refunds via support@muraband.com. Sites public version **15** is deployed from commit `74684ff7a537f70ecab85b4029a1b06204eca48c`, with runtime environment revision **4** and `RESERVATIONS_ENABLED=true`. Deployment ID: `appgdep_6adf0189cad48191875e7c0956364d44`; URL: https://trycymba.com/reserve. Existing protected Stripe and Supabase secrets were preserved. This supersedes the earlier closed-checkout state.

Post-launch checks confirmed HTTP 200, the US$50 offer, email field, reservation-terms checkbox and “Reserve yours” payment button. An incomplete submission returns 422 before creating an attempt; missing or invalid webhook signatures return 400; the preview payment endpoint remains 404. No new Checkout session or charge was created during these checks. Successful-payment and refund receipts are enabled in the correct live Stripe account. Payment/refund processing was verified in the sandbox and live webhook delivery was verified before launch; a genuine live customer payment and mailbox delivery have not yet been independently observed. To pause new reservations, set `RESERVATIONS_ENABLED=false` in Sites and redeploy, preserving webhook processing.

Published source: `f69cc8bbc0d563d80bb91f41516261d95a807db2`; saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_7871a64b7b1c8191be909e2d6fb6e642`; deployment `appgdep_6ade65ad34fc8191a96eabf1ad87c336`. Deployment succeeded at https://cymba-one.suvang.chatgpt.site and the custom domain https://trycymba.com serves the same release. Paid checkout must stay disabled until the remaining Stripe setup, live verification and user instruction to open reservations.

### Local demonstration

Use synthetic details only. Start a separate development instance with `RESERVATIONS_PREVIEW=true WAITLIST_STORAGE=file` and explicitly empty `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY`. The stand-in checkout is labelled as a simulation, never collects card data, and stores only local demo records. It cannot run in production.

`node --test tests/reservations.test.cjs` checks reservation safety without live credentials or network access. The existing backend and Meta consent tests should also pass before deployment. Live checkout is now enabled with the user's explicit approval; payment/refund testing stays in the sandbox, and receipt delivery is not independently verified.

Reservation release validation (25 October 2026): 56 automated checks passed, including nine PostgreSQL checks in an isolated PGlite runtime, plus root/hosted typechecks, the hosted production build, and a desktop/mobile local demo walkthrough. The production database migration and live Stripe payments remain deferred. See the local sandbox validation above for subsequent work.

The earlier reservation publication (Sites versions 10–11) was rolled back at the user’s request. The rollback restored Sites version 9 (`df5f075d8457c5418e96d09dd0d66ad00e43a972`) through deployment `appgdep_6ade1158da908191befdcecc6982fb56`. The current live release is Sites version 12, source `17e1f014a4ffa0b45d38a2584848aaf7531613a5`, deployment `appgdep_6ade19264aac819181b1659beca342aa`: the same pre-reservation site with the product name changed to lowercase `cymba` and its sharing image regenerated. Runtime environment revision 1 is unchanged. Reservation source remains local; the reservation checkout and saved reservation versions must not be published without an explicit request. Base future live-only changes on version 12 or its successor, rather than syncing the local reservation work.


### Image caption cleanup — 26 October 2026

Removed product, lifestyle, sound and similar visualisation labels from the site, including the reservation image caption, footer image statement and terms imagery section. The same cleanup is applied to the root development site, including its 3D-stage captions. Descriptive image alternatives, model attribution, existing product-development copy and reservation behavior are preserved. The terms display date is 26 October 2026.

Sites public version **16** was deployed from commit `bec05560e91d611e48cab3ae232e13f45b6577cc`, deployment `appgdep_6adf7d97a52c8191b4d9e356924387ab`. Runtime environment revision **4** is unchanged. Both TypeScript checks and the hosted production build passed.

Live browser verification confirmed the homepage, `/reserve` and `/terms` no longer contain the removed labels. The reservation form remains available.

### Hero waitlist pill styling — 26 October 2026

The hero form now uses a single outlined capsule, inset white button and centered “Unsubscribe anytime. Privacy” line in both the development and hosted source. The light site palette and existing signup behavior are preserved. Local desktop/mobile layout and empty-email validation checks passed, as did both TypeScript checks and the hosted production build.

Sites version **17** was saved but not deployed at the time of this styling change: `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_bce73dfbb2688191a85fe040ce1e1263`, source commit `3369dd356ea65844476e16e3678d8a9394645283`. The complete local-site publication below supersedes this pending release.

### Complete local site publication — 26 October 2026

The user explicitly requested publishing the local site and committing/pushing the project to GitHub. Sites public version **18** is now deployed at [trycymba.com](https://trycymba.com), also available at [the generated Sites URL](https://cymba-one.suvang.chatgpt.site). It includes the current scroll-driven 3D homepage, earbuds and neural mannequin models, mobile layouts, portrait sequence, signup capsule, section copy, assets and refreshed sharing card.

- Hosted source: `77a1bbebd272eea1bda12dc1010f678b13b64aa8`.
- Saved version: `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_a890580e9a308191b036fb82ed57d23e`.
- Deployment: `appgdep_6adf8c12b73481918f2239d108654296`, successful at 17:21:46 UTC.
- Production environment revision **4** is preserved, including active paid reservations and protected Stripe/Supabase configuration.

The hosted copy preserves the Sites/Vinext/Worker configuration and production payment/storage adapters. Its homepage uses verified public model URLs instead of a local filesystem probe, and its sharing card is exported from the local Next.js route into the hosted static image. Local sandbox databases and development routes are not deployed.

Validation: **83** root automated tests, root and hosted TypeScript checks, **26** hosted reservation tests, and the hosted production build passed. Browser checks verified the 3D scroll scene and a 390px mobile layout. The live custom domain shows the latest homepage, a rendered 3D canvas, no browser errors and no demonstration-mode warning; `/reserve` still presents the active US$50 offer. No payment or signup was created during publication checks.

GitHub includes the application, tests, scripts, source images and editable design/model assets. Private account-administration records/screenshots, local credentials/data, generated deployment bundles and dependency/build caches remain ignored. The separate hosted checkout continues to use the Sites source repository.


### Cookie settings removed — 26 October 2026

Removed the global Cookie settings button and consent panel in both the development and hosted site. Disconnected the page-view and signup Meta Pixel entry points, so previous marketing preferences cannot trigger website advertising tracking. The privacy notice now describes this disabled state. The Pixel utility remains dormant.

Both TypeScript checks, all 20 existing Meta utility tests and the hosted production build passed. Sites public version **19** deployed successfully from `f9cff4cdd30296feafae75e7de867a1ed643171d`; saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_2ef26d1049e88191826f4e8b4c558ad7`, deployment `appgdep_6adf8d276dac8191a8db689ee71465c8`. Runtime environment revision **4** is unchanged. Live browser verification confirmed https://trycymba.com loads without the Cookie settings control. This is the current deployed version and supersedes the earlier version 17 saved-only note.
