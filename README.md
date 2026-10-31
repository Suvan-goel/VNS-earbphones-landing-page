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

`src/components/three/EarbudExperience.tsx` controls the scroll transition from the floating pair onto the user-supplied Meshy neural head bust, then rotates the head and fitted earbuds together through only 45 degrees in total and holds that pose. `Mannequin.tsx` loads `public/models/cymba-neural-mannequin-premium.glb`: opaque honed ivory marble baked in Blender, with purple surface neural highlights and additional fine branches across the sides and back. A short brainstem motif and continuous neck curves replace the former glass cutaway and pink internal network. The earbud landing positions fit the new ear spacing. The neural pattern is traced into smooth, connected 3D filaments in Blender, with clean marble underneath and finer posterior/neck curves. As scroll advances, a softened wave spreads from the ears through the network and settles into a violet glow. `NeuralGlow.tsx` adds selective HDR bloom at two blur scales, preserving the transparent canvas and keeping the marble and earbuds out of the glow. They hold steady when scrolling stops and dim when scrolling back; these remain schematic artistic projections, not anatomical or measured brain activity. The editable Blender source, baked textures, source checksum and export report are in `output/neural-mannequin`. The original supplied download is unchanged. The previous attributed scan is retained outside public output in `source-assets/legacy-models`, with its credits in `source-assets/model-documentation/credits.txt`. Framing fits desktop and phone canvases, loading/unavailable 3D uses the existing earbuds poster, and reduced-motion layouts retain still imagery. Viewers activate only when visible and pause offscreen.

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
| Launch window, retail price, software subscription and reservation deposit per currency | `src/config/pricing.ts` (`launch`, `markets`); the market detection order is in `src/lib/market.ts` |
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

The public brand is `cymba`. `Wordmark.tsx` pairs the existing transparent charcoal Flow symbol from `src/assets/brand` with the current brand name as live text. The public support address is `support@trycymba.com` (updated by the user on 29 October 2026); historical logo exports remain alongside the standalone symbols. The browser icon uses the same symbol. The original concept, transparent ImageGen master and export provenance are in `assets/brand/logo-concepts-v3` and `assets/brand/flow-v1`. These exports are PNGs.

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

The “For the work that matters to you” section covers solving complex problems, learning difficult material and developing ideas. It uses the existing generated images `breakthrough-natural-v1/deep-work.webp`, `breakthrough-natural-v1/study.webp` and `cognition-ideas-v2.webp` from `src/assets/earbuds`: a computer workspace, a study notebook and a woman developing ideas. Desktop uses three columns with 4:3 images; mobile uses compact rows with square thumbnails, shorter descriptions and tighter spacing. Original still-life masters and prompts remain in `assets/breakthrough-natural-v1` and `site-imagery-v2`.

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

### Meta Pixel measurement

**Live activation, 27 October 2026 at 13:44 UTC:** Site version 28, source `5cc9bc5b39eb7b716a16499e1fd269bf358266f6`, successfully published Lead and Purchase tracking plus the consent-resume fix. Deployment `appgdep_6ae0aaace0848191bc0624b800c2b187` succeeded at 13:44:30 UTC. The live `trycymba.com` consent notice now includes new waitlist signups and confirmed paid reservations; accepting loaded both the Pixel SDK and this dataset's configuration script. All 43 Meta/receipt tests, TypeScript, and the production build passed. No live payment was attempted, and category/support settings were not changed.

**Live signup verification, 27 October 2026:** The user supplied an email for one genuine consented homepage signup. Its new Supabase row was verified with `created_at` `2026-10-27 13:56:26.731961+00`; the signup was not repeated or removed. The browser's original declined marketing-cookie choice was restored afterward. At the final check around 14:38 UTC, Meta Overview had increased from 8 to 14 PageView events but still showed no Lead, more than 40 minutes after the signup. Lead receipt and ad attribution remain unverified. Meta still reports data-sharing restrictions and some website data blocked; the UI has not identified a rejected Lead or Purchase specifically. Absence in a delayed report does not establish the cause. The dataset is shared with CYMBA Ads (`29287216384300955`). The current campaign collects Meta instant-form leads, which are separate from website Lead events; its settings were inspected without changes.

The earlier 43.63 MB archive repeatedly timed out during upload. Twelve unused older graphics were preserved in `sites/cymba/source-assets/legacy-models/` outside public output, reducing the upload to 20.20 MB. All active model URLs, posters, textures and credits were verified present; active GLBs are self-contained. The normal source/build/package workflow produced `output/cymba-meta-conversions-compact.tar.gz`, which saved successfully as `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_ffad58941fcc8191a5f147d31b6c5d27` before deployment.

`src/lib/meta-pixel.ts` connects to the CYMBA Website dataset (`1898337111486951`). `MarketingConsent` supplies separate, explicit advertising-cookie choices and a persistent Cookie settings control. PageView is supported on the homepage, reservation page and clean reservation receipt, only at `https://trycymba.com` and `https://www.trycymba.com`. Local and generated Sites preview origins cannot send Meta events. Declining or withdrawing consent clears pending events, revokes SDK permission and removes accessible Meta cookies. Automatic matching and automatic events remain off.

**Account restriction verified 27 October 2026:** Meta labels both the dataset and `trycymba.com` as **Health & wellness provider**, with **core setup** and **restrictions on certain standard events**. Diagnostics additionally reports some website data blocked. PageView receipt is confirmed; the UI has not identified a rejected Lead or Purchase event. Both conversion flags are now `true` in the published hosted build. This enables website dispatch; it does not establish that Meta accepts or attributes either conversion. The category and Meta's restrictions remain unchanged. The privacy notice and consent text reflect the enabled features. Meta traffic permissions allow `trycymba.com` and all its subdomains; the code restricts actual events to the two verified HTTPS origins. Do not misclassify the business or rename restricted conversions to bypass Meta controls.

Conversion flags are build-time values in `sites/cymba/vite.config.ts` or the build environment; runtime environment changes alone do not change the public client bundle. After publishing, verify Meta receipt using a genuine consented signup and paid reservation before claiming end-to-end attribution. Lead counts only a newly saved HTTP 201 / `created` waitlist response with a survey token and existing marketing consent. The form awaits dispatch for at most 800ms before its reservation redirect; duplicates, demo results and failures do not count. Purchase counts only a server-recorded live paid, unrefunded deposit, with its actual value/currency and an opaque SHA-256 event ID. Browser persistence prevents ordinary refresh duplicates. Test/demo, processing, failed and refunded records do not count. No email, survey answers, raw checkout references or card data are sent through these events.

Receipt return links exchange the private checkout reference for an essential HttpOnly cookie and an opaque receipt handle before any advertising SDK can run. This keeps the Stripe reference out of Meta's automatically collected page URL while retaining independent status pages for different reservations. Original checkout return links remain supported. No Conversions API or ad-campaign changes are included.

Run `node --test tests/meta-pixel.test.cjs tests/reservation-receipt.test.cjs` for consent, delayed loading, navigation, revocation, purchase deduplication, clean receipt and paid-status checks without contacting Meta.

## Hosting: Sites

Latest publication: **version 64**, deployed 29 October 2026 at 21:04 UTC to https://trycymba.com. Source `c4596708a62657aaceeeb1efa7fcf3353930a8dd` changes the current launch date to Q3 2027 across visible pages, metadata, FAQ structured data and current terms. New terms version `2026-10-29-launch-q3` preserves the accepted contact-email terms in an immutable archive. The concurrent v63 contact-form update is retained. Sixty-six hosted checks, 27 local checks, production build and typecheck passed; live homepage, reservation page and terms were verified. Deployment uses the existing environment revision 8. Receipt: `output/q3-launch-release-2026-10-29.json`.

Previous publication: **version 62**, deployed 29 October 2026 at 15:48 UTC to https://trycymba.com (provider: https://cymba-one.suvang.chatgpt.site). Source `620c1b8338fd6b4f8792ad30b99267683c8dd290` publishes the local neural material and glow updates: softer violet fibres, shorter tip fade and scroll-driven activation that stops requesting frames once settled. This release starts from v61 and preserves its legal, contact, analytics and payment updates. The in-progress contact form and related privacy edits remain outside this release until email delivery is connected. Twenty-five scene, scroll and neural-rendering tests, the production build and typecheck passed; desktop and mobile previews and the live neural scene were verified without browser errors. Runtime environment revision 6 is unchanged. Receipt: `output/neural-update-release-2026-10-29.json`.

Previous publication: **version 56**, deployed 29 October 2026 at 12:58 UTC to https://trycymba.com (provider: https://cymba-one.suvang.chatgpt.site). Source `625c79c132028318db1cda0344049029386cec6d` increases the lower Join button horizontal padding to 32px per side. Production build and 320px layout check passed; live computed padding was verified. Runtime environment revision 5 was unchanged.

Previous publication: **version 55**, deployed 29 October 2026 at 12:51 UTC to https://trycymba.com (provider: https://cymba-one.suvang.chatgpt.site). Source `28909241b18e7eb7e473f34af11eec2931c6d262` shortens the lower waitlist button to “Join”. Production build passed and the live button text was verified. Runtime environment revision 5 is unchanged.

Previous publication: **version 54**, deployed 29 October 2026 at 12:49 UTC to https://trycymba.com (provider: https://cymba-one.suvang.chatgpt.site). Source `273381e8cb1af4f48a8a4fe11387d500d42a3110` removes “free” from the lower waitlist heading/button and “paid” from its Founders Edition reservations label. Production build passed, and the exact updated copy was verified on the published page. Runtime environment revision 5 is unchanged.

Previous publication: **version 53**, deployed 29 October 2026 at 12:48 UTC to https://trycymba.com. Source `1a5d67ec6a806df3f0c5d674407cf85609347597` makes cookie settings overlay the page by removing the banner-height measurement, signup-form lift and 3D-area scaling. Hosted TypeScript and production build passed; at 320px, 390px and 834px, opening and dismissing settings preserves content geometry and scroll position. Runtime environment revision 5 is unchanged. Details: `output/cookie-overlay-release.json`.

Previous publication: **version 52**, deployed 29 October 2026 at 12:27 UTC to https://trycymba.com. Source `76437f1a3d521d7be20b982cc415e8e9cff5a13e` publishes the local portrait expansion, full-height backdrop, mobile model resolution and framing refinements. Hosted TypeScript, production build, 18 scene/scroll tests, and desktop/390px mobile expansion alignment checks passed. Native mobile browser chrome was not tested. Runtime environment revision 5 is unchanged. Details: `output/local-release-v52.json`.

Previous publication: **version 48**, deployed 29 October 2026 at 11:26 UTC to https://trycymba.com (provider: https://cymba-one.suvang.chatgpt.site). Source `b206ccf9a7974da1d010365ea0684bf01a3b91a9` enables `viewport-fit=cover`, removes the fixed white browser theme color, and adds safe-area spacing to the mobile headings and navigation so the page can extend behind mobile browser bars. Both TypeScript checks and the hosted production build passed; portrait/landscape layout and menu checks passed in the desktop browser, and the published viewport metadata was verified. Native phone browser chrome was not available for visual verification. The live environment remains revision 5.

Previous publication: **version 47**, deployed 29 October 2026 at 11:06 UTC. At the user's request, source `777cc3abeb1af596a2fd76f82ca970dfa307ec0b` adds the remaining local 3D loading, demand rendering, scene recovery and mobile compositing improvements, plus the smaller desktop mannequin. Hosted TypeScript, the production build, 18 scene/scroll tests, source/asset parity and desktop/390px mobile browser checks passed. Release details: `output/local-release-2026-10-29.json`.

Previous complete publication: **version 46**, deployed 28 October 2026 at 22:23 UTC. Source `f542b7fc10e7fbcb17a45b693e4bec7767d4bbc7` includes the current headers/menu, copy, reservation offer and layout, automatic currency selection, and 3D materials, textures and posters. These publications supersede the pending-draft notes below.

Validation: 135 local tests, 45 hosted reservation/market tests, both TypeScript checks, the hosted production build, and the source/asset parity audit passed. Release details are in `output/full-local-release-state.json`; the deployment archive is `output/cymba-all-local-2026-10-28.tar.gz`.

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
- `npm test` — all 98 checks, including the local database and launcher safety tests
- `npm run build` / `npm start` — production build and server
- `npm run typecheck` — TypeScript
- `node --test tests/backend.test.cjs` — request validation, storage failures, duplicate handling, survey tokens, secret-key headers, and rate limits using a mocked Supabase response (no credentials or network required)

## Pricing and currencies

`src/config/pricing.ts` holds the planned launch (Q3 2027), the retail price (£400 / US$449), the software subscription (£15 / US$15 a month) and the reservation deposit (£35 / US$50), all in minor units, with one `markets` entry per currency. The same numbers drive the Price and Launch cards in the homepage's At a glance grid, the reservation page, the FAQ, the terms, the metadata and the Stripe checkout amount; nothing is hard-coded in copy. The user asked for the pricing to stay subtle: there is deliberately no separate pricing section.

A visitor's currency is chosen server-side once per request in `src/lib/market.ts`: a `cymba_market` cookie saved by the currency switch wins, then the country reported by the host (`cf-ipcountry` on Cloudflare, with `x-vercel-ip-country`, `cloudfront-viewer-country`, `x-country-code` and `x-geo-country` also read), otherwise US dollars. The UK and its Crown Dependencies see pounds; the US and its territories see dollars; everyone else sees dollars until they switch. `MarketProvider` carries the choice to the client, `MarketToggle` (reservation page) and `MarketSwitchLink` (homepage footnote) switch it in place and save the cookie, and `Price` renders any amount. The hosted Worker copies `request.cf.country` into `cf-ipcountry` so detection does not depend on zone settings.

The reservation page sends the market it displayed to `/api/reserve`; the server prices the deposit from `markets` and never from the request. An attempt retried in a different currency is a changed-details conflict, and the payment components verify Stripe's live total against the displayed currency and amount. The currency switch is disabled while a checkout is being prepared or confirmed. Reservation terms version `2026-10-28` names both deposits; attempts started under the US-dollar-only wording must be refreshed and re-accepted.

## Reservations (£35 / US$50 refundable deposit)

**Current status.** Paid reservations opened on the live site with the user's explicit approval on 26 October 2026, as recorded below. Subsequent design and inline-payment work is local only; do not publish it or change live payment settings without an explicit request. Keep payment testing in the isolated Stripe sandbox.

**Historical setup — 25 October 2026.** Reservations initially remained local, and the live site was restored to pre-reservation Sites version 9 (`df5f075d8457c5418e96d09dd0d66ad00e43a972`). The user then requested isolated sandbox testing. An isolated, temporary cymba Stripe sandbox was created without modifying the live Stripe account or production database. The later approved production launch supersedes that closed-site state.

The flow is free signup → optional reservation → Stripe payment → reservation status. Visitors may also go directly to `/reserve`. In the current local source, an open checkout uses inline Stripe Elements when `STRIPE_PUBLISHABLE_KEY` contains the matching account's publishable key and its test/live mode matches `STRIPE_SECRET_KEY`. The server passes only the publishable key to the page; private credentials stay server-side. Without a valid matching-mode publishable key, new sessions retain hosted Stripe Checkout. Existing hosted sessions keep their original checkout when retried. The one-time US$50 deposit is credited against the eventual purchase and refundable in full before shipping. The retail price and shipping date remain unannounced; there is no subscription, automatic balance collection, discount, stock count or promised delivery date. Founder numbers are assigned when payment confirmation is recorded, not strict bank-payment chronology.

`src/config/reservation.ts` is the single source of truth for the amount, currency, CTA and terms version. The form requires agreement to the reservation terms. Paying a deposit does not opt the person into marketing. Post-signup email prefill uses short-lived browser session storage rather than a URL query parameter.

### Local reservation checkout

Run `npm run dev:reservations`, then open <http://127.0.0.1:3015/reserve>. Internet access and the installed Stripe CLI are required. The command starts signed Stripe webhook forwarding first, passes the signing secret privately to Next.js, and serves only on loopback port 3015. Ctrl+C stops both services. Keep the launcher running while making sandbox payments or refunds so their events can reach localhost. Do not run a second reservation server against the same database.

- The exact US$50 deposit is created server-side, with adaptive currency conversion disabled. Payment details are entered in Stripe-hosted Elements inside the reservation page, or on hosted Checkout when inline payment is unavailable. The application never receives raw card data or exposes its private Stripe key. A checkout client secret is kept only in browser memory and is not logged or stored in the reservation database.
- The launcher selects only the isolated CLI configuration `.data/stripe-local/config.toml`, profile `default`, and checks its account against `.data/stripe-local/manifest.json`. It requires a test API key and `test_mode_pub_key` from that profile, then supplies `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to the local server. Only sandbox keys are accepted. Existing `.env.local` values are preserved, but Supabase credentials are explicitly cleared for the child server.
- Reservation records and signed-event receipts persist in `.data/reservations-test-db`, a local PostgreSQL-compatible PGlite database using the same migration and atomic transaction as production. The free waitlist also uses local files. No production database requests are made. These files and credentials are git-ignored.
- The separate build directory `.next-reservations` avoids interfering with the normal development server. Analytics and Meta Pixel are disabled for this test instance.
- The reservation and confirmation pages clearly label Stripe test mode. Test transactions do not reserve a real shipping place, and confirmation emails are not sent. A production email service and launch review remain separate work.

The temporary sandbox is `acct_1UUNLUBuZ3AcrbGJ`, created 25 October 2026 using the public support address. **Claim it before 1 November 2026** to retain it. The private claim link is stored in `.data/stripe-local/manifest.json` and also appears on sandbox Checkout. Run `stripe --config .data/stripe-local/config.toml --project-name default sandbox claim` to open it. After claiming, run `stripe --config .data/stripe-local/config.toml --project-name default login` and select that same sandbox. Verify the account ID using `stripe --config .data/stripe-local/config.toml --project-name default whoami`. Then set `claimed` to `true` and `sandbox_expires_at` to `null` in the ignored local manifest. The launcher requires both this explicit ownership marker and a permanent `sk_test_`/`rk_test_` key before removing the temporary expiry; a claimable `rkcs_test_` key cannot bypass it. Do not switch this configuration to a live account. Claiming and permanent credentials require the account owner's action; they are not silently enabled by this setup.

For interactive testing, use only [Stripe's official test cards](https://docs.stripe.com/testing): `4242 4242 4242 4242`, a future expiry such as `12/34`, CVC `123`, and synthetic contact details. Leave “Save my information” unchecked. No real card is needed. Test partial/full refunds in the same sandbox and reload the confirmation page to see the recorded result.

Validation: all 71 automated checks pass, including the actual PostgreSQL transaction, signed webhook validation, payment/refund ordering, retries, concurrency, persistence, live-key rejection, and isolation from configured Supabase credentials. Real hosted sandbox Checkout creation and loading have been verified. The user completed the hosted sandbox test payment. The signed Stripe completion event returned HTTP 200 and the local page confirmed founder #001. Actual US$10 partial and US$40 remaining sandbox refunds both succeeded; signed refund events updated the local page through partial to full refund, with US$0 remaining. No real money was charged. The tested record remains in the local database for inspection and was verified after a complete server restart. A second checkout verified the cymba branding, loopback-only return URLs, exact USD price and session reuse on retry; its unused session was then expired in the sandbox.

### Historical live-activation preparation — 25 October 2026

This records preparation before the approved 26 October launch below. Its closed-checkout instructions describe that earlier stage; local test setup alone still does not authorize changes to live payments.

The user selected **Frame Wearable, Inc.** as the business receiving cymba reservation deposits on 25 October 2026. Its selected live Stripe account is `acct_1U2U1BCayZz7QEuo`, confirmed in the authenticated Dashboard on 25 October 2026. The default local CLI currently identifies a different account labelled “Frame” (`acct_1U0P5v2WBYpT3ouE`) with test access only; do not substitute that account or overwrite the isolated reservation sandbox. The local reservation terms now identify Frame Wearable, Inc. as the deposit recipient. This selection does not authorize publication or switching the local test server to live payments. The live Account status page shows Payments and Payouts active, with no active verification tasks, also verified after the authorized branding changes below. A default USD Mercury payout account is linked. Successful-payment and refund emails are both enabled.

The user explicitly authorized replacing this account's customer-facing Mura branding with **cymba** on 25 October 2026. The live Dashboard now has public business name `cymba`, business website and support URL `https://trycymba.com`, support email `support@muraband.com` (the user-selected interim inbox), terms URL `https://trycymba.com/terms`, and privacy URL `https://trycymba.com/privacy`. Both statement descriptor and shortened descriptor are `CYMBA`. The existing cymba wordmark and square site icon replace the Mura images; the default brand colour is `#ffffff` and accent is `#202023`, with the logo preferred over the icon. Checkout now uses those brand colours, with its existing Inter font and rounded controls. Saved images and settings were verified after refresh; the receipt preview reads “Receipt from cymba”. No test email or live payment was sent. The legal entity remains Frame Wearable, Inc.; bank, ownership, public support phone and business/support address were not changed. The verified public business/support address is 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States. These Stripe branding changes do not authorize publishing the local reservation site or activating live checkout.

1. The reservation database migration in `supabase/migrations/` is applied to the existing Supabase project. Production requires Supabase; local JSON storage is never a production fallback.
2. The selected Frame Wearable, Inc. live account is connected through the protected server-only restricted key `STRIPE_SECRET_KEY`; keep the existing isolated sandbox for tests. Never place credentials in a public environment variable or source control.
3. The mandatory snapshot webhook at `https://trycymba.com/api/stripe/webhook` is active for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `refund.created`, `refund.updated` and `refund.failed`. Its signing secret is stored as `STRIPE_WEBHOOK_SECRET` in the hosting environment. The account and live mode match the API key.
4. In the sandbox, verify payment, delayed confirmation, cancellation, webhook retry, duplicate delivery and full/partial refund handling. Successful-payment and refund receipts are already enabled on the selected live account; verify the customer-facing receipt and its branding before launch; this code does not send a separate marketing or confirmation email.
5. Configure the live key and live webhook secret, confirm the business/contact/refund details, and set `RESERVATIONS_ENABLED=true`. Without the explicit flag, key, webhook secret and durable storage, checkout stays closed. Connecting a key alone cannot open reservations.

Payment confirmation belongs to signed webhooks. The return page only reads the stored reservation and distinguishes processing, confirmed, refunded and unavailable states; visiting a success URL cannot mark a payment paid. Refunds are initiated in the Stripe Dashboard and reflected by the webhook. A failed, canceled or returned refund enters a persistent `refund_review` state that requires support investigation; later payment notifications cannot hide that problem. Support requests go to `support@trycymba.com`.

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

Historical pre-activation snapshot: source `f69cc8bbc0d563d80bb91f41516261d95a807db2`; saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_7871a64b7b1c8191be909e2d6fb6e642`; deployment `appgdep_6ade65ad34fc8191a96eabf1ad87c336`. That deployment served https://cymba-one.suvang.chatgpt.site and https://trycymba.com with paid checkout disabled pending Stripe setup and approval. The paid-reservations launch above supersedes that state.

### Local demonstration

Use synthetic details only. Start a separate development instance with `RESERVATIONS_PREVIEW=true WAITLIST_STORAGE=file` and explicitly empty `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY`. The stand-in checkout is labelled as a simulation, never collects card data, and stores only local demo records. It cannot run in production.

`node --test tests/reservations.test.cjs` checks reservation safety without live credentials or network access. The existing backend and Meta consent tests should also pass before deployment. Live checkout is now enabled with the user's explicit approval; payment/refund testing stays in the sandbox, and receipt delivery is not independently verified.

Historical reservation release validation (25 October 2026): 56 automated checks passed, including nine PostgreSQL checks in an isolated PGlite runtime, plus root/hosted typechecks, the hosted production build, and a desktop/mobile local demo walkthrough. The production database migration and live Stripe payments were deferred at that stage and completed in the later preparation and launch recorded above.

Historical rollback: the earlier reservation publication (Sites versions 10–11) was rolled back at the user’s request. The rollback restored Sites version 9 (`df5f075d8457c5418e96d09dd0d66ad00e43a972`) through deployment `appgdep_6ade1158da908191befdcecc6982fb56`. Sites version 12 then followed, source `17e1f014a4ffa0b45d38a2584848aaf7531613a5`, deployment `appgdep_6ade19264aac819181b1659beca342aa`: the same pre-reservation site with the product name changed to lowercase `cymba` and its sharing image regenerated, using runtime environment revision 1. Reservations remained local at that point. The later approved production releases supersede this snapshot.


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


### Local design work — 26 October 2026

The user requested local-only website work from this point; do not publish subsequent edits unless explicitly asked. The hero “Reserve yours” action is now a centered 14px muted text link with a small arrow, replacing its full-width dark pill. Its destination, 44px tap target and visible keyboard focus are preserved. Browser-verified in the local mobile preview; hosted source and deployment were not changed.

Navigation now uses the same borderless, edge-to-edge 48px glass bar and smaller wordmark on desktop and mobile. Desktop retains its visible links and a compact signup button; mobile uses an unboxed two-line menu icon. Its translucent light/dark fills and 20px backdrop blur let page colours show through. The mobile menu expands down into a full-screen surface with staggered 28px links, a plain close icon and no dividers or chevrons. The cymba logo and wordmark remain visible and linked at the top while the menu is open. Background scrolling and interaction pause, keyboard focus stays within the menu, and Escape or a section selection closes it; reduced-motion preferences disable the animation. Mobile safe-area padding and 44px menu tap targets are preserved, with opaque backgrounds for browsers without backdrop blur or users who prefer reduced transparency. The portrait's desktop/tablet centering accounts for the shorter bar. Verified locally at phone, tablet and desktop widths, including focus wrapping, scroll locking, short-screen overflow, menu dismissal and section navigation; TypeScript checks pass.

The sculpture's grey-veined treatment has been replaced locally with uniform warm white stone. Downloaded displacement and roughness maps from [Poly Haven's Marble 01](https://polyhaven.com/a/marble_01), by Rob Tuytel under CC0, supply the fine surface detail. A patch inside a tile is adapted and baked to the original head UVs so no tile joints appear. The runtime uses normal and roughness maps without an albedo map, preserving the existing cavity shading, geometry, earbuds and neural fibres. Downloads and source metadata are retained in `assets/sculpture-surface/marble_01`; attribution is also in the public 3D credits.

### Reservation page refinement — 27 October 2026

The local reservation page now uses a pure white background, a compact header, the existing earbud product image on mobile and desktop, and a single deposit/action area. The configured checkout form uses the explicit “Reserve for US$50” button. Refundability, credit toward the final purchase, no automatic balance charge, and the final price/shipping clarification remain visible. When reservations are deliberately closed, the page leads with availability and provides an inline free-waitlist form.

Live reservations were verified open at `https://trycymba.com/reserve`. An otherwise unconfigured development instance now links to that canonical page rather than incorrectly announcing that reservations have not opened. This handoff preserves the selected variant, collects no email locally, and never enables the local payment API. Production, explicit closure, and configured preview/sandbox instances retain their existing availability checks. No live credentials, production configuration, or waitlist storage were changed by this refinement.

Validation: TypeScript and all 29 reservation tests passed. Browser checks covered desktop, 390px and 320px mobile layouts, the local live-page link, and email/terms validation in the existing isolated Stripe sandbox. No payment session or charge was created. These design changes are local and have not been published.

### Inline reservation payment — 27 October 2026

The local reservation page now uses a compact centered layout and Stripe Checkout with `ui_mode: "elements"` for inline payment. After email and reservation-terms consent, it shows Stripe's Payment Element and eligible express-payment methods, the verified US$50 total, and the final reservation button. Hosted Checkout remains the fallback when no matching publishable key is configured. Retry recovery preserves the original session and idempotency key across checkout modes; only signed webhooks confirm payment and update refunds. The sandbox launcher supplies the selected test profile's publishable key without modifying `.env.local` or live settings.

Validation: TypeScript, the production build and all 98 automated tests pass, including session recovery, origin checks, payment guards and launcher isolation. Browser checks covered 320px and 390px phones and a 1280px desktop, inline payment loading, email correction before confirmation, a declined test card with an in-page error, and successful sandbox payments recorded by signed webhooks (founders #034 and #035). The second payment reached the confirmed page automatically without a manual refresh. No real money was charged. These changes remain local and have not been published.

The confirmation page briefly refreshes pending/processing records every two seconds for up to 30 seconds, pausing when hidden; it never infers payment from browser state. The manual status link remains. Email editing is available only before payment confirmation begins. Stripe payment styles load with the parent form while the payment JavaScript stays lazy-loaded.

Before publishing inline payment, configure the live account's matching `STRIPE_PUBLISHABLE_KEY` on the hosted runtime. Apple Pay and Google Pay require an eligible browser/device, HTTPS and the appropriate registered payment domain; localhost HTTP tests do not verify those wallets. Stripe may show additional sandbox-only payment methods that are not activated for live use. Preserve the current live checkout until an explicitly requested deployment and its payment configuration are ready.

The reservation layout was subsequently simplified locally at the user's request: one borderless, compact column with the existing product image, headline, deposit/refund copy, and email-to-payment form. The separate price section, reassurance badges, marketing helper and duplicate Stripe reassurance were removed. Purchase credit, final pricing/shipping disclosure and no automatic balance charge remain in one short note. The test-mode label remains explicit. TypeScript, 320px/390px mobile and 1280px desktop checks, email/terms validation and the inline payment transition pass. No new payment was made for this presentation-only change, and it has not been published.

### Site release — 27 October 2026

The user requested committing the current site to GitHub and publishing it. The homepage now leads with “The earbuds for deep work”, groups desktop copy and actions, and preserves centered mobile copy around a consistent model area. The sculpture uses the refined stone surface and a contact shadow. The new Cymba app section scrolls normally between the model story and the closing portrait; it uses the paired laptop/phone render with champagne-gold UI accents and additional vertical spacing on mobile. App-image originals and generation provenance are retained in `src/assets/app`.

The reviewed release includes the current homepage, navigation, model assets, reservation UI, source artwork, and reproducible model-generation scripts. Local test data, credentials, private administration captures, deployment bundles, and optional review screenshots are excluded. All 103 root automated tests, TypeScript checking and the Next.js production build passed. The hosted copy retains its Worker/storage adapters, production runtime settings and static sharing card. Without a configured matching live publishable key, reservations continue through the existing hosted Stripe Checkout fallback.

GitHub release commit `bb51f908873149edcdd734c0f5eb69f514473545` is pushed to `claude/landing-page`. Sites public version **20** deployed successfully at 02:07:23 UTC on 27 October 2026 and is live at [trycymba.com](https://trycymba.com), also available at [the generated Sites URL](https://cymba-one.suvang.chatgpt.site). Hosted source: `5b5d52a71cc6a14fdd30a76b56d6682c1a3764c1`; saved version: `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_bef51af0b7808191ad75df8b270d1598`; deployment: `appgdep_6ae0074af5188191a38f9ce1a65b5136`. Runtime environment revision **4** is unchanged.

The hosted TypeScript check, 38 hosted reservation tests and production build passed. Live browser checks confirmed the updated hero, loaded 3D canvas, gold app render, mobile layout without horizontal overflow, and active US$50 reservation form. No homepage browser errors were observed. A deliberately empty same-origin reservation request was rejected with HTTP 400 by the submission guard before storage or Stripe session creation. No signup, payment session or charge was created during publication checks.

### Compact phone animation fix — 27 October 2026

The user reported missing sticky animations on a Samsung Galaxy S22 in Chrome and approved fixing and publishing the compact layout. The phone-specific fallback previously disabled the story below 700px of viewport height. Portrait viewports from 640px now retain the pinned animation, with a shared 35svh model frame, smaller text and adjusted spacing. Screens below 640px and reduced-motion preferences retain the normal-flow fallback.

GitHub fix commit `9e16fa5` is pushed to `claude/landing-page`. Public Sites version **21** deployed successfully at 05:50:58 UTC from hosted source `31d7dbec9f33752454220db43980028612377a10`; saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_76b718ba95d4819191ae2b640505c8e6`, deployment `appgdep_6ae03bb485fc8191b6cc2de6cfbcd033`. Runtime environment revision **4** is unchanged. This release contains only the two layout CSS files.

Validation: both TypeScript checks and production builds passed, alongside 14 scroll and scene-health tests. Browser checks covered 360×672, 320×640, the 639px fallback and the existing 390×844 layout. The live site retains the pinned, loaded model at 360×672 as scrolling advances through the chapters. This was viewport-based verification, not a physical-device test.

### Direct signup-to-reservation flow — published 27 October 2026

Successful new and existing waitlist submissions now navigate straight to `/reserve`, carrying the normalized email through short-lived session storage rather than the URL. Homepage redirects do not depend on payment availability. The duplicate-specific confirmation and upsell panel are removed. The closed reservation page explicitly opts out of redirecting to itself and uses the ordinary saved confirmation; errors and unsaved demonstration submissions stay on the form.

Validation: root and hosted TypeScript checks, all 11 backend tests and the hosted production build passed. Local browser checks verified both signup placements, existing-member navigation, email prefill, invalid-email handling, Back navigation and unchecked reservation terms. No payment was started. The user explicitly approved publishing this update. Sites public version **22** deployed successfully at 06:05:34 UTC from source `3a3354d86bb0edbbbbdf81b4f593efe382121f72`, archive `output/waitlist-direct-reservation-release.tar.gz`; saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_13475b0b33bc81918e1a78b0f236fbf5`, deployment `appgdep_6ae03f203af0819195d5afb5d4413d54`. The native deployment result confirmed success at https://cymba-one.suvang.chatgpt.site, serving the connected https://trycymba.com domain. Runtime environment revision **4** is unchanged. Unrelated in-progress model-performance edits were not included in the hosted release.

### Reservation card information — local, 27 October 2026

The single white reservation card now explains that the deposit records a place in line for one pair, shows the configured US$50 amount due today, and puts refundability, full purchase credit, development status, unconfirmed price/shipping date, and no automatic balance charge above the form. The checkout action says “Continue to payment” with a quiet Stripe reassurance; preview and live-site handoff labels remain distinct. A native “What happens next?” disclosure explains confirmation, the later purchase decision, and cancellation through the configured contact address. No email-confirmation, launch-date, pricing or shipping-priority promises were added.

Validation: TypeScript and whitespace checks passed. Browser checks covered 320px and 390px mobile widths, a 1280px desktop, keyboard disclosure toggling, invalid-email feedback and required terms consent. Payment/session creation, the closed reservation fallback, and existing prefill behavior were not changed. No payment was started. Preview: http://127.0.0.1:3015/reserve?v=learn. These card changes are local only and have not been published.

The card subsequently received a warmer visual treatment: a champagne product backdrop, larger existing earbuds, a “Founding supporter” label, “Be part of cymba from the beginning” introduction, and a compact deposit/refund summary. The exact incentive is still undecided, so no limited-edition reward, first-50 eligibility, or inventory claim is displayed. The existing amount and purchase/refund disclosures remain intact. TypeScript and whitespace checks passed; mobile at 320px/390px, desktop at 1280px, the checkout-form layout, and the keyboard disclosure were checked locally. Payment behavior is unchanged and no payment was started. This visual update remains local only.

The champagne-gold finish now spans the entire card, with a softer translucent deposit inset and warm separators. Secondary copy, checkout notes and payment labels use darker warm text for legibility across the gold surface. The dark CTA and white payment inputs are preserved. Mobile and desktop previews and TypeScript checks passed; this remains a local styling change.

### Live inline payment activation — 27 October 2026

The user explicitly approved activating payment inside the reservation card. The matching live Stripe account's `STRIPE_PUBLISHABLE_KEY` is now configured in the hosted runtime. Existing saved Sites version **22** was redeployed with environment revision **5**, deployment `appgdep_6ae040bfc60c8191a3ba86d47f6d22c3`, confirmed successful at 06:12:29 UTC. This runtime-only activation did not publish unrelated working-tree changes or change the deposit amount, private credentials, storage or webhook handling. It supersedes the earlier notes that inline payment was local-only or awaiting its live publishable key.

Stripe payment-method domains `trycymba.com`, `www.trycymba.com` and `cymba-one.suvang.chatgpt.site` were registered and verified as enabled in the live account. Wallet availability still depends on the customer's eligible browser/device and payment method configuration.

Live browser verification confirmed the US$50 offer and “Continue to payment” action, with no browser errors. The inline Stripe fields were verified in the isolated sandbox before activation. No live reservation, payment session or charge was created during these checks; a complete live payment was not tested. Existing sessions created with hosted Checkout retain that flow for safe retry recovery. Screenshot: `output/reserve-inline-live.jpg`.


### Meta measurement repair — 27 October 2026

Published Sites version **25** from source `1f5b701574dbb504d5181d2210e69db4c5aba058`. Saved version: `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_b8050e46ecd8819195190b84329a48eb`; deployment: `appgdep_6ae08b7144a48191bfe8b4b064dc5cc5`. Native deployment succeeded at 11:31:13 UTC, with runtime environment revision **5** unchanged. Consent-controlled PageView is restored. New Lead and paid-deposit Purchase integration is implemented but both build flags remain **false** because Meta's current dataset restrictions have not been resolved. No campaign budget, objective, category or terms acknowledgement was changed.

Meta's traffic allowlist was updated and verified: `trycymba.com` and all subdomains are allowed. Automatic website matching and automatic events were verified off. The complete root suite passed 125 tests before the receipt isolation improvement; the final receipt suite passes 10 tests, both project TypeScript checks pass, and the final hosted build succeeds. Browser checks covered accept/decline/reopen/withdraw, a 390px mobile layout, accurate disabled-conversion privacy copy and the receipt redirect with a synthetic reference. No real payment or signup was created for testing. Receipt credentials are isolated by opaque handle in secure, server-readable cookies lasting up to 30 days; the original checkout return link can restore access.

Live verification: the deployed CYMBA homepage shows Cookie settings; accepting loads `https://connect.facebook.net/en_US/fbevents.js`, with no pixel console error. Meta Test Events did not display an event during the check, so receipt/attribution by Meta is **not verified**. The original browser preference was restored to Decline afterward. Account categorisation and standard-event restrictions remain unresolved.

Follow-up after explicit user approval: accepted the Manage event blocking “I acknowledge” agreement. Event statuses contains no events awaiting action and no individually blocked events; this did not remove the data-source restriction. The website category UI offers Edit category, not a category-review submission. Meta's official [category management guidance](https://www.facebook.com/business/help/467621355878794) associates that editable flow with self-categorisation; its [category definitions](https://www.facebook.com/business/help/1402913027039332) include health-related products. No category was changed. A repeat consented homepage/reservation visit loaded both the SDK and the dataset-specific configuration script but produced no Test Events entry; today's overview also showed no received activity (Meta notes up to 30 minutes processing delay). Consent was restored to Decline. Root, hosted source and built bundle were rechecked with no confirmed bootstrap defect. Lead and Purchase flags remain false.

A support inquiry was drafted in Events Manager asking Meta to confirm appropriate categorisation, Lead/Purchase eligibility and investigate missing PageView test events. It was **not submitted**, and the user subsequently explicitly asked not to send it. No support submission or additional Beta Product Testing/AI terms acceptance is authorised. Screenshot of the unsent draft: `output/facebook-setup/meta-support-request-draft.jpg`.

Further verification at approximately 12:50 UTC supersedes the earlier receipt uncertainty: CYMBA's refreshed overview for 27 October shows **6 PageView events received through Meta pixel**, with the latest about 59 minutes earlier. PageView is therefore reaching Meta despite the category restriction; the empty Test Events view did not establish a tracking failure. Ad-attributed signup/reservation conversions remain unverified. Their absence currently follows from our deliberately disabled build flags, not an observed rejection of those specific events. Screenshot: `output/facebook-setup/cymba-pageviews-received.jpg`.

Read-only comparison with Mura Health's Frame Website Purchases dataset (`1755414338830151`) found recent PageView/ViewContent activity and both Pixel and Conversions API integrations. Its dataset category is None, while `muraband.com` has Meta-assigned Health & wellness condition: the details warn that European-region data sharing may be blocked, and certain events/core setup may be restricted elsewhere. CYMBA's category offers Edit category rather than Request review and appears self-assigned. Meta's [self-categorisation documentation](https://www.facebook.com/business/help/1666235380728268) explicitly makes self-categorisation optional and allows removing/replacing self-assigned categories; Meta-assigned restrictions remain independently applicable. No category was changed.

Consent edge-case repair: after Accept → Decline → Accept on an already-measured page, PageView deduplication previously skipped the SDK's renewed consent grant. The library now synchronises the ready SDK on the deduplicated path without emitting another PageView. This also covers accepting on Privacy and returning to an already-measured public funnel page. Root and hosted checks pass 33 Meta tests and TypeScript; the hosted production build passes. This issue did not establish the cause of the earlier empty Test Events view.

The consent edge-case repair is **not deployed**. Source was refreshed to preserve version 26's unrelated model-loading improvements, then pushed as `5b15463b644d240d289e24556b5b490afd0a010a`. Two uploads of the locally built archive timed out (the confirmed second error was an OpenAI blob upload timeout after 300001ms). A source-build fallback saved version **27**, `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_24ef6dd3db548191a94c70fece424609`, but deployment `appgdep_6ae0a14f69ac8191970f092b0582cc9d` failed with a package.json/npm lockfile mismatch report. Local `npm install --package-lock-only --ignore-scripts` made no changes and `npm ci --dry-run --ignore-scripts` succeeds, so the remote-build mismatch is not reproduced locally. The live site retains the previously successful publication. Preserve the archive at `output/cymba-meta-consent-resume.tar.gz` for a later upload retry; do not describe the extra consent fix as live.

### Charcoal reservation card — local, 27 October 2026

The user selected the Charcoal design from the reservation comparison. The local reservation page now uses a charcoal card, compact existing product image, left-aligned introduction, an open deposit summary, subtle gold accents and a light action button. The nested deposit box and “Founding supporter” eyebrow were removed. The exact incentive is still undecided; no edition, first-50 eligibility or inventory claim was added. Deposit amount, refund and purchase disclosures, consent and checkout behavior are unchanged.

The email, consent, error/loading, closed-waitlist and embedded Stripe surfaces use matching readable colors. Stripe uses its night appearance and light Apple/Google wallet button themes. TypeScript and whitespace checks pass. Local browser checks covered 320px/390px mobile, desktop, email/terms validation, keyboard disclosure and test-mode embedded card fields. One isolated test checkout was opened to inspect payment fields; no payment was submitted. Wallet availability was not verified over localhost HTTP. This design remains local and has not been published. Preview: http://127.0.0.1:3000/reserve?v=learn.

The dark treatment now extends across `/reserve`: near-black page/header, a light brand mark, muted footer and navigation, gold keyboard-focus outlines, and matching cookie controls. The charcoal card remains slightly lighter than its surroundings. Root and cookie colors are scoped to the reservation card page; the homepage and confirmation layouts keep their existing styling. Mobile and desktop previews, cookie-settings open/close, TypeScript and whitespace checks passed. Consent, reservation and payment behavior are unchanged. This update is local only.

### Compact cookie settings — 27 October 2026 (local only)

The advertising-cookie notice now uses a small frosted card, one sentence matching the enabled measurements, a direct link to the advertising section of the privacy notice, and equally styled Accept/Decline buttons. The saved choice sits beside the title; the closed control is a quiet pill with its 44px tap target preserved. Consent storage, tracking gates, keyboard focus and revocation behavior are unchanged.

The ignored `.env.development.local` mirrors the published public Meta configuration so this notice is visible in the local preview. The production-origin guard still prevents all Meta dispatch on localhost. TypeScript and all 43 Meta/receipt checks passed; browser verification covered fresh and saved choices, keyboard/close behavior, the privacy anchor, and 320px, 390px and desktop layouts. These visual edits have not been copied to the hosted checkout or published.

The reservation page now shares the homepage’s post-lifestyle `.on-scene` palette: neutral white text, muted translucent copy, champagne accents, a white 8% card surface, 12% borders and the same headline weight/tracking. Its static, dimmed and blurred studio backdrop reuses the existing wide lifestyle artwork, with a translucent header and white CTA. The product spotlight and heavy opaque-card treatment were removed. Mobile and desktop previews show no horizontal overflow, all images load, and TypeScript/whitespace checks pass. This is a local visual update; checkout and consent behavior remain unchanged and it has not been published.

### Mobile background blur restoration — 27 October 2026 (local only)

The 11:18 mobile performance change (`0940a63`, mirrored in Sites source `c01f051`) bypassed the portrait backdrop filter below 1024px while retaining its dark overlay. Restored the existing 0→18px blur over the half-screen transition after the closing portrait, including the mobile filter compositing hint. The portrait remains sharp during its own section, then stays blurred behind Research, At a glance and the following content. Other mobile mask, shading and model optimizations are preserved. TypeScript and whitespace checks passed; the local phone preview confirmed both the sharp portrait and blurred background. The hosted source and live site remain unchanged.

### Mobile background blur — published 27 October 2026

At the user's request, the focused mobile-blur correction was published as Sites version **29**, source `1933c1750228dec21ae8e59db50c6b2f6486918e`. Only `components/ProductStage.tsx` and `components/ProductStage.module.css` changed in the hosted source. The hosted TypeScript check, production build and independent release review passed. Saved version: `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_22cf8a5afc80819184cb7923223c293a`. Deployment `appgdep_6ae0c2b6a3e08191ade9e2c96cd36593` succeeded at 15:27:04 UTC, serving https://cymba-one.suvang.chatgpt.site and the connected https://trycymba.com domain with environment revision **5**. No environment settings were changed for this release. Local cookie-panel and reservation styling changes were not included.

### Cookie settings icon — published 27 October 2026

Replaced the persistent Cookie settings text launcher with a 20px cookie SVG in a quiet 32px circle at the bottom left. The button keeps a 44px tap target, accessible name/tooltip, keyboard focus and the existing consent panel behavior. Applied the launcher change to local and hosted components; the unpublished compact-panel and reservation designs remain local. Both TypeScript checks, the hosted production build and independent accessibility/scope review passed. Local mobile checks verified opening, Escape, focus restoration and control dimensions.

Sites version **30** deployed successfully at 16:48:20 UTC from source `e6dc692db65995b59fb02fbea97722fdcbf137c3`; saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_4ffe946cdbd8819195cd6908fa6d8a88`, deployment `appgdep_6ae0d5c5161c8191932f3478134720e6`. Environment revision **5** is unchanged. Live at https://trycymba.com and https://cymba-one.suvang.chatgpt.site.


### Full local site release — 27 October 2026

At the user’s request, the current local website changes were published as Sites version **31**, including the dark reservation page, matching slim header with Back to site, Founders Buds copy, compact consent panel, and updated app-section copy. Existing live-only Worker/storage adapters, assets, receipt privacy, model improvements, and Meta settings were preserved. The user explicitly chose manual tracking and fulfillment of the first 50 paid reservations; this release does not add an automated edition allocation, live counter, or checkout cap.

All 128 root tests, root TypeScript and production build, plus hosted TypeScript, reservation/receipt/Meta tests and production build passed. Hosted source: `8e4771db8f296e6294c6e54f1c3723f8b216294c`; saved version: `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_fbc4ef60a8608191b26789cc56906564`; archive: `output/cymba-full-local-release.tar.gz`. Deployment `appgdep_6ae0dbc22cd88191b72781f94ba776be` succeeded at 17:13:55 UTC, with runtime environment revision **5** unchanged. Live at https://trycymba.com and https://cymba-one.suvang.chatgpt.site. Browser verification confirmed the live offer wording, dark reservation design, Back to site header and active email/terms payment form. No live payment or checkout session was created.


### Reservation CTA — published 27 October 2026

Changed the reservation form’s normal action label from “Continue to payment” to “Reserve now”, as requested. Loading and preview labels and payment behavior remain unchanged. The same text is present locally and in the hosted source. Hosted TypeScript, whitespace checks and production build passed. Sites version **32**, source `a8d97b23b13af8767b643551914736a9b5ed932c`, saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_ef5acbd1d230819189ff0a8ffe9ec646`, deployed successfully at 17:19:36 UTC via `appgdep_6ae0dd17906c819186927d0f37ca0bc2`; environment revision **5** unchanged. The live reservation form displays “Reserve now”. No checkout session or payment was created during verification.


### Payment methods visible on arrival — 27 October 2026

At the user’s request, the reservation card now displays Stripe’s eligible express wallets and expandable payment methods immediately, alongside email and terms, with a single “Reserve now” payment action. Generic Elements collects a PaymentMethod only after validation; the existing consented, durable Checkout Session is then prepared and confirmed with that method. The exact server-priced US$50 total, attempt reuse, hosted recovery, receipt exchange, signed-webhook payment status and manual Founders offer handling remain unchanged. Payment details remain in Stripe-hosted fields; client secrets stay in memory. Wallets are shown only when eligible. Unsupported Amazon Pay/Klarna manual Express buttons are excluded; the Payment Element keeps its eligible methods. Duplicate wallet signup fields inside the card accordion are hidden. Browser Back restores temporary busy state without unlocking an uncertain payment identity.

Validation: all 128 root tests, root TypeScript and production build, and hosted TypeScript, reservation/receipt/Meta tests and final production build passed. Isolated sandbox browser checks covered email/terms rejection, wallet validation, decline then same-session success (founder #067), and a successful 3DS authentication challenge (founder #068), both recorded through signed webhooks. Mobile layouts were checked at 320px and 390px. No real charge was made; wallet payment completion was not tested. Live read-only verification found the integrated methods present and no browser errors, without creating a live Checkout Session.

Published Sites version **33**, source `fbd9c44d0c95e1d3fe390d00b5fbdd16ffa0b9ad`, saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_17549e616154819195c738b297d79aa4`. Deployment `appgdep_6ae0e30c2aa4819194299f336d4c0bd6` succeeded at 17:45:00 UTC; runtime environment revision **5** is unchanged. Live at https://trycymba.com/reserve and https://cymba-one.suvang.chatgpt.site/reserve. Proof: `output/reserve-upfront-live.jpg`.

### Desktop reservation layout — published 27 October 2026

At 1024px and above, the reservation card now uses two columns: a larger product image, headline and existing Founders offer on the left, with deposit disclosures, email, terms and integrated payment options on the right. A subtle divider separates the columns. The image fade and responsive image size match its larger display. Smaller screens retain the stacked layout; payment behavior and copy are unchanged.

Root and hosted TypeScript, whitespace checks, hosted production build and independent review passed. Browser checks covered 1440px, the 1024px breakpoint, expanded card fields and 390px mobile without horizontal overflow. Live read-only verification confirmed the split layout and loaded payment methods; no live Checkout Session or payment was created.

Published Sites version **34**, source `bfdb5dea63f28f2a0840101674fabc693ec5925e`, saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_2a52d6b125a081918b3b32a33b573f02`. Deployment `appgdep_6ae0e59ead308191afa0d42c219d50d4` succeeded at 17:55:59 UTC; environment revision **5** is unchanged. Live at https://trycymba.com/reserve. Proof: `output/reservation-desktop-split-live.jpg`.


### Reservation details moved left — published 27 October 2026

Moved the deposit, refund benefits and development disclosure beneath the Founders offer in the left column. Desktop headline maximum is now 44px (previously 56px), with 15px offer copy (previously 17px). The right column begins with email and payment; mobile retains the existing type sizes and offer → deposit → payment order. No payment logic or copy changed.

Root and hosted TypeScript, whitespace checks, hosted build and independent review passed. Desktop and 390px mobile browser checks confirmed the new placement, unchanged mobile spacing and no horizontal overflow. Published Sites version **35**, source `0acef9818ca4d69ee4e3edfd548e53f5bb9f9609`, saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_244bc172b57c8191a3ab55742bf12aaf`. Deployment `appgdep_6ae0e9514f108191920f27f640c73acd` succeeded at 18:11:44 UTC with environment revision **5** unchanged. Live at https://trycymba.com/reserve. Proof: `output/reservation-left-details-live.jpg`. No checkout session or payment was created during verification.

### Pricing, launch window and currencies — local, 28 October 2026

Added the planned launch pricing to the site: £400 / US$449 for the earbuds, £15 / US$15 a month for the software subscription, and a reservation deposit of £35 / US$50, with the Q4 2027 launch window stated alongside. `src/config/pricing.ts` is the single source for these amounts. Price and Launch cards join the At a glance grid, with a one-line currency switch beneath it (a bolder stand-alone pricing section was tried and removed at the user's request); the reservation page shows the deposit, a currency switch, the launch prices and the balance due at launch; the FAQ, terms (now version `2026-10-28`, updated 28 October 2026), metadata and signup copy name both currencies or follow the visitor's currency.

UK visitors see pounds and US visitors see dollars, chosen server-side from the host's country header (`cf-ipcountry`; the hosted Worker now copies `request.cf.country` into it); everyone else sees dollars; a `cymba_market` cookie remembers a manual switch. `/api/reserve` prices the deposit from the market the page displayed and still never trusts an amount from the browser; a retry in another currency is a changed-details conflict, the payment components verify Stripe's live total against the displayed currency, and the switch is disabled while a checkout is being prepared or confirmed. Pound deposits are presented in GBP on the existing US-dollar Stripe account.

Validation: all 133 root checks (including new market tests), root TypeScript and production build; hosted TypeScript and hosted reservation, receipt, Meta and market tests. Browser checks covered the homepage and reservation page with GB, US, DE and absent country headers, the switch, the saved cookie across a reload, and 390px mobile layouts. The hosted source in `sites/cymba` is synced but not yet published; no payment or checkout session was created.


### Founders offer and manual referral rewards — saved 28 October 2026

The first 50 paid reservations now receive £50 / US$50 off launch RRP, three software subscription months free from activation of the delivered product, and limited-edition Founders Buds. The full reservation deposit is credited in addition to the discount. At the current planned prices, the UK founder price/balance are £350/£315 after a £35 deposit; US values are US$399/US$349 after a US$50 deposit. The homepage hero has a compact offer line, the closing signup area has a full offer card with a secondary free waitlist, and reservation, confirmation, FAQ and terms explain the same benefits. No live counter or checkout cap was introduced; first-50 allocation and cancellation promotions remain manually fulfilled. Original paid reservation numbers 1–50 get explicit benefit confirmation; later numbers are told support will confirm any place that becomes available.

The user chose manual referral claims through support. Every additional friend who completes a paid reservation earns the referrer one free software subscription month. After paying, the friend emails support@muraband.com from their reservation email, naming the referrer’s reservation number. Support verifies and records the reward once per friend; verified months add to the free period at product activation. Referral rewards are available to all paid reservation holders, independently of first-50 eligibility. No automated referral links or subscription billing were added. Terms version is `2026-10-28-founders-referrals`; old recorded contracts remain accepted by payment/refund processing.

Validation: all 134 root tests, root and hosted TypeScript checks, 54 hosted reservation/receipt/market tests, hosted production build, and independent wording/eligibility review passed. Browser checks covered desktop, 390px and 320px layouts, both currencies and the manual claim links. No payment or live Checkout Session was created.

Saved Sites version **43**, source `cef763b042a2dabda7d712cddea720027f980d5e`, saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_6791883a4db8819195f086dff6113a1b`, archive `output/cymba-founders-referrals.tar.gz`. Automatic approval review rejected production deployment because implementation authorization did not explicitly authorize publication. Publication approval was requested; the live site remains unchanged pending that approval. The existing preview at http://localhost:3000/reserve is available for review.


### Shorter referral copy and automatic currency — saved 28 October 2026

The reservation referral box now contains only “Get a month free per friend who reserves” and a Share reservation link action. The action shares the canonical public reservation URL through the native share sheet, falls back to copying with confirmation, and shows a usable URL if clipboard access fails. Cancellation leaves the action usable. Manual claim instructions remain under the existing collapsed Reservation details and in the FAQ/terms/receipt. The highlighted development/taxes/shipping/no-automatic-balance paragraph was removed from the main reservation summary as requested; the existing detailed terms remain available.

Removed currency-selection controls from reservation and homepage, their components and cookie persistence. Currency comes from visitor country headers: GBP for UK/Crown dependencies, USD for the US and other locations (including unknown). Old `cymba_market` cookies are ignored, even malformed ones. The market stays stable through the current page/payment attempt; server-side deposit amounts and retry protections remain intact. The hosted Worker prefers authoritative `request.cf.country` when available. FAQ and terms no longer promise manual currency switching.

Root and hosted TypeScript checks, 55 reservation/receipt/market checks in each checkout, hosted production build and independent share/geo review passed. Actual local page requests with GB, US and DE country headers and conflicting old cookies verified the expected currency and balances. Browser verification confirmed the exact concise text, absent selector/disclosure, no narrow-screen overflow and native-share cancellation. No payment or live checkout was created.

Saved Sites version **44**, source `3784a175fad7ac9ac8caa57e395570d30fd5b541`, saved version `appgprj_6ad8da86c44c8191adebbfb1f67c376f~appgver_387384b4d08081918e415c595edeeec2`, archive `output/cymba-simple-offer-auto-currency.tar.gz`. This replaces version 43 as the latest draft; publication remains pending the explicit approval required by the previous automatic approval-review rejection. Preview: http://localhost:3000/reserve. Localhost has no host-provided country and therefore uses the USD fallback; production uses the hosting edge’s country detection.


### Compact reservation summary — local preview, 28 October 2026

Removed the referral card styling; the requested sentence and share action now sit as quiet centered text directly after the reserve button. The reservation summary removes the marketing subtitle, numbered benefit explanations, separate deposit checklist and nested five-row pricing card. Three short benefit lines precede three pricing rows: refundable deposit today, planned Founders price (with the planned retail price struck through), and balance at launch. Short lines retain full deposit credit, refund timing, planned subscription price and launch window. Longer activation and claim explanations remain under Reservation details. Currency detection and checkout behavior are unchanged.

Changed `src/app/reserve/page.tsx`, `src/app/reserve/page.module.css` and `src/components/ShareReservationLink.module.css`, and synced only these three files to `sites/cymba`. Root and hosted TypeScript checks, hosted production build, and desktop/390px/320px browser layout checks passed; expandable details remain usable and no horizontal overflow was found. This revision is saved in the local source and preview, not a new Sites version. Concurrent separate BackLink/header edits were observed in both checkouts and preserved without bundling or publishing them. Public deployment approval remains pending.

## Contact email update — 29 October 2026

The current website support address is `support@trycymba.com`. The existing Mura mailbox was renamed in GoDaddy, and GoDaddy confirmed correct DNS routing. This supersedes the earlier interim-address and missing-MX notes above. Current terms use version `2026-10-29-contact-email`; original terms are archived unchanged, and downloaded historical copies explicitly disclose their updated support contact address.
