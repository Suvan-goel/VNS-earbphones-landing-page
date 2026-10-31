# Reservation service emails

## Production audit — 30 October 2026

Published as Site version 72, environment revision 13, at 14:34 UTC. Commit: `ab15f164f414f8673bd4eaac00b559e79c2e59c0`. The three production reliability, all-email scheduler and delivery-event migrations are applied. Root validation passed 100 relevant tests; hosted-source validation passed 87; the final focused email suite passed 23. Both TypeScript checks and the production build passed.

A single corrected copy of the existing paid #016 confirmation was accepted at 14:35:01 UTC and reported delivered by the new signed callback at 14:35:02.875 UTC. Gmail independently showed it in Inbox as a separate conversation titled “cymba reservation #016 — confirmed”, with the expected unique grouping header, inline hero, terms attachment and SPF/DKIM/DMARC passes. No Inbox filter, whitelist or move-from-spam action was used. No new charge or refund was created. All three real outbox messages are sent, and the final health check has no attention flags. The two older deliveries predate the new callback; explicit audit-prefixed records reconcile their delivery evidence from the Resend SMTP receipt and Gmail original headers, not fabricated historical webhook callbacks. Full evidence is in `output/reservation-email-production-audit-2026-10-30.json`; Inbox proof is `output/reservation-confirmation-corrected-inbox-2026-10-30.png`.

The real £35 reservation #016 was sent at 12:56 UTC with the subject “Your cymba reservation is confirmed — #016”, without a test prefix or test content. Gmail grouped it with the 11:52 synthetic example, which reused #016, and displayed the older “[TEST]” conversation title. The original real message passed SPF, DKIM and DMARC and arrived at Gmail one second after sending. On inspection, that conversation was in the Inbox; all five 11:56 synthetic status examples were in Spam with Gmail's generic “similar to messages ... identified as spam” explanation. This does not establish where the real message was initially placed.

The correction uses “cymba reservation #016 — confirmed” and a stable, unique X-Entity-Ref-ID per outbox message, distinct subjects/references for previews, and a production check against preview-marked or misaddressed frozen payloads. Future live delivery tests must use explicitly synthetic DEMO references and substantially distinct preview subjects, never a customer reservation number or just a bracketed [TEST] prefix. Prefer local render checks to bursts of live sample messages.

The existing signed minute scheduler now retries every transactional email kind, with the two-minute grace period retained only for processing notices. All outdated queued states, including attempted confirmations and partial refunds, are checked under the reservation lock before retry. Uncertain outdated messages are held for review instead of sending obsolete information.

A dedicated Resend webhook at /api/resend/webhook records sent, delivered, delivery_delayed, bounced, complained, failed and suppressed events. It verifies the original body with the Svix HMAC protocol, enforces timestamp/size limits, deduplicates event IDs and stores only provider references, event types and timestamps. It is independent of the sending enable switch. No open or click tracking is enabled. The private reservation_email_health view gives current delivery evidence and attention flags; out-of-order sent/delayed events cannot erase delivered evidence, and complaints/bounces remain visible. A callback can arrive before the send acknowledgement without being lost.

Authentication passed and Resend's deliverability checks passed except its optional sending-subdomain recommendation. No broken DNS record was found or changed. Provider “delivered” means the receiving server accepted the mail, not guaranteed Inbox placement. A new sending domain and the burst of test messages may contribute to filtering; the evidence does not identify one definitive spam cause. Continue sending only expected transactional messages. Do not bypass provider suppressions or automatically resend to bounced/complaining recipients.

Automated coverage includes all six templates, live/preview separation, stable retry payloads, duplicate/reordered payment events, async success/failure, refunds, claim races, signature tampering/replays, callback-before-ack, and private database permissions. Existing refund_review remains a deliberate operator-review state: a failed/returned refund is not silently declared successful by a later ordinary payment event. Inspect Stripe and resolve the case explicitly.

## Earlier production activation — 30 October 2026 (version 69)

Live Site version 69 and environment revision 10 deployed successfully. Resend confirms all six test messages delivered. The pending real reservation confirmation was delivered through a signed Stripe event replay; a second replay returned 200 and left exactly one send attempt and the same provider ID. No pending, sending or review-held messages remain. The retired check endpoint returns 404, and an unsigned webhook request returns 400. No charge or refund was created for testing. The deployment receipt is `output/reservation-email-live-2026-10-30.json`.

The user approved the six templates and production activation. The release source is `sites/cymba-email-activation`, refreshed from live version 67 (`96b8a604bd632bcf9d91a84586586311b18d8d00`) so the current contact form, Q3 launch terms and other published changes are preserved. The older `sites/cymba-transactional-email-release` checkout is superseded and must not be published.

The existing CYMBA Resend account and verified `trycymba.com` domain send from `cymba <reservations@trycymba.com>`, with replies to `support@trycymba.com`. The existing domain-scoped sending key remains a Sites secret. Production delivery is controlled by `RESERVATION_EMAILS_ENABLED=true`. The privacy notice covers Resend's handling of reservation correspondence. No subscription or new provider account is needed.

The approved concise designs use the website's white/charcoal palette, champagne accents and current site hero (`public/models/cymba-earbuds-hero-poster.webp`). Inline image attachments avoid external image requests. Every message has a plain-text alternative. Confirmation includes the complete recorded confirmation and accepted terms as a text attachment. The processing heading is “We're processing your reservation”.

Both database migrations are applied. Existing references #001 and #002 and their benefit eligibility are preserved. New references begin at #016; the independent benefit position begins at 3. The offset does not consume Founding 50 places, and rerunning the migration cannot rewind either sequence. The migration creates no historical customer notifications.

Six explicitly labelled synthetic examples were accepted by the live sending service for the user-approved test inbox on 30 October. Gmail inspection confirmed the reservation email, inline artwork, terms attachment, authenticated `trycymba.com` sender and support reply address. No test charge, refund or reservation was created. The temporary fixed-recipient check route and its temporary secrets are removed from the final release. See `output/reservation-email-live-2026-10-30.json` for final deployment and delivery evidence.

Validation before release: 78 relevant root tests and 77 hosted-source tests passed, covering the database trigger, webhook retries, delivery deduplication, refund statuses, independent benefit eligibility, templates and contact form. Both TypeScript checks and the hosted production build passed. Twelve GBP/USD previews were checked at phone width. Inbox rendering was checked in Gmail; Outlook and other clients have not been independently tested.

## Messages

| Committed status | Message |
| --- | --- |
| paid | Reservation confirmed, recorded deposit and reference, applicable benefits, cancellation instructions; recorded confirmation and available accepted terms attached as a text file |
| processing | Payment still processing; reservation not yet confirmed; avoid paying again |
| failed | Payment unsuccessful; contact support about pending amounts before retrying |
| partially_refunded | Cumulative successful refund total and remaining deposit; partial refund is not a completed full cancellation |
| refunded | Full deposit refunded; reservation no longer active; bank posting may take additional time |
| refund_review | Refund could not be confirmed; customer should contact support; no assertion that funds have arrived |

Expired/abandoned checkouts do not send reminder emails. This does not create marketing, free-waitlist, shipping, launch-delay, subscription or referral-award campaigns. Those require their own confirmed events and workflows.

## Processing email grace period

Published as Site version 71 with environment revision 12 on 30 October. Both core timing and production scheduler migrations are applied, including the signed-request follow-up. The live signed request returned 200 with an empty queue; unsigned and expired requests returned 404. Root and hosted validation passed, including confirmation during the grace period, current Stripe state overriding delayed webhooks, database claim races and retry behavior. See `output/reservation-processing-delay-live-2026-10-30.json`.

Processing notices wait at least two minutes from the recorded processing event. A Supabase database job checks once per minute, so normal dispatch occurs approximately two to three minutes after that event. This is independent of open browser tabs and subsequent Stripe events. Confirmation, unsuccessful-payment and refund messages retain immediate event-driven delivery.

Before claiming a due processing notice, the application retrieves the current Checkout Session and PaymentIntent from Stripe and verifies their reservation metadata, amount, currency and live mode. A successful, failed, cancelled or expired payment suppresses the notice. Unavailable or inconsistent evidence leaves it queued for another check. The database independently enforces the two-minute minimum and rejects a stale processing claim if the reservation has already advanced. A newer event still supersedes any never-attempted old notice. An uncertain prior send is held for reconciliation rather than blindly resent after confirmation.

`20261030_processing_email_delay.sql` supplies the claim guard, suppression function and due index. `20261030_processing_email_scheduler.sql` installs a named one-minute pg_cron job and pg_net dispatcher. The job calls only `https://trycymba.com/api/internal/reservation-emails/run` using a timestamped HMAC signature, valid for 60 seconds, generated with a dedicated secret stored in Supabase Vault and the Sites secret `RESERVATION_EMAIL_CRON_SECRET`. It accepts no caller-supplied recipients or payment changes. The scheduler sends no HTTP request when there is no due work. The platform owns pg_net’s request tables and grants broad database access to them. They therefore contain only short-lived, purpose-specific signatures; the reusable signing secret never enters the request queue. Duplicate requests within the signature window remain protected by database leases and provider deduplication.

The runner handles bounded batches; larger backlogs, network outages or provider failures can delay delivery. A payment can still settle after the final check, once an email is already being handed to the provider. Already-dispatched emails cannot be withdrawn.

Operations: inspect the named job in `cron.job`, recent entries in `cron.job_run_details`, HTTP results in `net._http_response`, and the reservation outbox. The owner can smoke-test the complete network path with `select public.dispatch_due_processing_emails(true);` and inspect that request's HTTP response. Do not log or display Vault values. To disable the background job use `cron.unschedule('cymba-processing-email-delay')`; this does not disable ordinary webhook emails.

References: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).

## Reliability and operations

The database trigger inserts an email snapshot in the same transaction as the reservation change. Only live records enqueue messages. The signed Stripe webhook drains that reservation's queue after commit, including duplicate Stripe deliveries. A delivery failure returns HTTP 500 so Stripe retries without applying the payment twice. A temporarily disabled sender retains messages in the database; it does not block payment processing.

There is one message per reservation state, with one per cumulative successful refund total. A later state supersedes an older, never-attempted notice. Claims serialize concurrent delivery for a reservation and lease for two minutes. The first complete provider payload is frozen for retries, including sender, copy and attachments. `reservation/<outbox UUID>` is the stable Resend idempotency key. Sent rows remain permanently deduplicated by the database.

Resend retains idempotency keys for 24 hours. An attempted message older than 23 hours is held as `needs_review` rather than risking a duplicate. Inspect the matching Resend log before resolving it. If accepted, record the provider ID and mark it sent. If confirmed never accepted, first check that its content is still appropriate for the current reservation; supersede stale messages, or explicitly release an accurate message for a fresh attempt. Never reset uncertain acceptance blindly. The minute scheduler continues retrying queued mail independently of Stripe retries. For a payment event that never committed, replay the original signed Stripe event after resolving its underlying problem.

`sent` means Resend accepted the email, not that it reached the inbox. Check delivery, bounce and suppression status in Resend. Signed provider callbacks now populate reservation_email_events and reservation_email_health. Gmail does not provide an inbox-versus-spam callback. Inspect delivery problems and held messages as part of support operations:

```sql
select * from public.reservation_email_health where needs_attention is true;
select state, kind, count(*) from public.reservation_email_outbox group by state, kind;
select id, reservation_id, kind, state, created_at, first_attempt_at, attempts, provider_id
from public.reservation_email_outbox
where state in ('pending','sending','needs_review') order by created_at;
```

The outbox contains customer correspondence; it has RLS enabled and no public-role access. Preserve it according to the reservation/support retention policy, including when fulfilling verified erasure requests. Error logs contain only internal event/message references, never message bodies, email addresses or credentials.

## Validation and preview

`node --test tests/reservation-emails.test.cjs tests/reservation-numbering.test.cjs tests/reservations.test.cjs tests/reservation-confirmation.test.cjs tests/local-reservations.test.cjs`

`node scripts/preview-reservation-emails.cjs` generates twelve synthetic previews (six messages in GBP and USD), their plain-text versions and sample confirmation attachments under `output/reservation-email-previews/`. Open `index.html` to compare desktop and phone widths. Browser checks are not an Outlook/Gmail delivery test.

References: [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Resend send API](https://resend.com/docs/api-reference/emails/send-email), [Stripe post-payment flow](https://docs.stripe.com/payments/checkout/after-the-payment).
