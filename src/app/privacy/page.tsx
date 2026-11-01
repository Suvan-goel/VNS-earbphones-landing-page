import type { Metadata } from "next";
import { reservation, site } from "@/config/site";
import { LegalPage } from "@/components/LegalPage";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";
import { MetaMeasurementDescription } from "@/components/MarketingConsent";

const title = `Privacy notice · ${site.brand}`;
const description = "How cymba handles website, waitlist, reservation and referral information, including cookies, your choices and your privacy rights.";
export const metadata: Metadata = {
  title, description, robots: { index: false },
  alternates: { canonical: "/privacy" },
  openGraph: { title, description, url: "/privacy" },
  twitter: { title, description },
};

const sections = [
  { id: "controller", label: "Who is responsible" },
  { id: "information", label: "What we collect" },
  { id: "instant-forms", label: "Facebook and Instagram forms" },
  { id: "website-analytics", label: "Website analytics" },
  { id: "advertising-cookies", label: "Advertising measurement" },
  { id: "purposes", label: "Why we use information" },
  { id: "providers", label: "Providers and international processing" },
  { id: "browser-storage", label: "Cookies and browser storage" },
  { id: "retention", label: "How long we keep information" },
  { id: "rights", label: "Your rights and contact" },
] as const;

export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="29 October 2026" sections={sections} showTemplateNotice={false}>
      <p>
        This notice explains how {site.brand} handles information through this website, our Facebook and Instagram signup forms,
        and support correspondence as we prepare to launch {site.product}. It covers the website and reservation programme;
        product-specific sensor-data information will be provided before a product or research service collects those readings.
      </p>
      <h2 id="controller">Who is responsible</h2>
      <p>
        {reservation.merchantName}, operating as {site.brand}, is responsible for the personal information described here.
        Our business address is 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States.
        Contact <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> for privacy questions or requests.
      </p>
      <h2 id="information">What we collect</h2>
      <ul>
        <li><strong>Launch-list details:</strong> your email, the signup date and page version, and whether you separately opted in to research invitations. Facebook and Instagram forms also request your first name.</li>
        <li><strong>Reservation details:</strong> your contact email, deposit amount and currency, payment and refund references and status, reservation number, timestamps, page version and the version of the terms you accepted. A reservation does not subscribe you to marketing or research invitations.</li>
        <li><strong>Optional survey answers:</strong> product interests, purchase intentions, price ranges, a broad description of your role and concerns you choose to share. These are stored with your signup.</li>
        <li><strong>Support and referrals:</strong> your messages and contact details, reservation references you provide, the link between a referrer and a referred reservation, and verification and reward records. A referred friend contacts us from their own reservation email; you do not need to send us a friend&rsquo;s email yourself.</li>
        <li><strong>Optional website analytics:</strong> page visits, button clicks, form progress and results, the page version, campaign parameters and the referring website&rsquo;s domain. These are associated with a random analytics session, not your email or payment reference. New signups and reservations do not have campaign attribution attached to their personal records.</li>
        <li><strong>Service and security information:</strong> hosting and payment providers process network and device information to deliver and secure the service. Our server uses request information such as IP addresses to limit abusive requests. A country code supplied by our host selects the displayed currency; this is not precise location tracking.</li>
      </ul>
      <p>We do not collect EEG, pulse or other sensor readings through this website. Please do not include health information or full card details in surveys or support messages.</p>
      <p>
        Your email and the payment information requested by Stripe are needed to administer a paid reservation. Survey answers,
        research invitations, website analytics and advertising measurement are optional. Declining them does not prevent a reservation.
      </p>
      <h2 id="instant-forms">Facebook and Instagram instant forms</h2>
      <p>
        If you join through a {site.brand} instant form, Meta collects your submitted first name, email and consent and makes the
        submission available to authorised {site.brand} Page administrators through its lead tools. With your consent, we use it
        for product-development, launch, pricing and availability updates. These forms do not request health information or sensor readings.
      </p>
      <p>
        The forms are not connected to an automatic transfer into our website database or an automated marketing email service.
        You can withdraw your signup consent by emailing <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
        Joining is free and does not oblige you to buy.
      </p>
      <h2 id="website-analytics">Website analytics</h2>
      <p>
        Website analytics is off until you allow it in <CookieSettingsLink />. It is separate from advertising cookies and email
        updates. Campaign and referrer information is stored in your browser tab only after that permission. We do not send events
        from before you gave permission.
      </p>
      <p>
        Turning analytics off stops new events and clears unsent events and campaign information from your browser. It also requests
        erasure of first-party events associated with the current analytics session. If the request cannot reach our server,
        a minimal request reference is kept in this browser for retry and Cookie settings explains the status. Other open tabs
        also respond to the changed preference. This does not identify every past visit: closing a tab before withdrawal or clearing
        browser storage can prevent us from linking a later request to that session.
      </p>
      <p>
        Contact us for help with older sessions or campaign information previously attached to a signup or reservation.
        We may need information that lets us locate those records. Analytics withdrawal does not cancel your reservation,
        unsubscribe you from separately requested emails or erase transaction information we must retain on another lawful basis.
      </p>
      <h2 id="advertising-cookies">Website advertising measurement</h2>
      <MetaMeasurementDescription />
      <p>
        Meta receives event information and browser, network and cookie information, including IP address, browser information,
        page address and advertising identifiers. Cookies such as <code>_fbp</code> and <code>_fbc</code> help connect a website action
        with an ad visit or Meta account. We do not send your email, name, survey answers, health information, card details or private
        reservation references through the Pixel. Automatic advanced matching and automatic form-event collection are disabled.
      </p>
      <p>
        Meta&rsquo;s advertising script loads only after you allow advertising cookies. You can withdraw through <CookieSettingsLink />.
        Withdrawal stops future Pixel events, sends the Pixel a consent-revocation instruction and removes accessible Meta cookies
        and our browser record used to prevent duplicate purchase events. This does not itself recall data already received by Meta.
        Contact us about erasure of information shared under your consent; we will handle the request and notify relevant recipients
        where required. You can also use the controls described in <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta&rsquo;s Privacy Policy</a>.
      </p>
      <h2 id="purposes">Why we use information</h2>
      <ul>
        <li><strong>Consent:</strong> product-development and launch emails, separately selected research invitations, website analytics and advertising measurement. Each choice is independent, and you can withdraw it at any time without making earlier lawful processing unlawful.</li>
        <li><strong>Contract and steps you request:</strong> preparing and administering reservations, payments, refunds, promised referral benefits and operational updates. Reservation updates are separate from marketing.</li>
        <li><strong>Legitimate interests:</strong> understanding demand through optional surveys, responding to general enquiries, securing the site and preventing abuse. We consider your interests and rights; you may object to this processing.</li>
        <li><strong>Legal obligations:</strong> keeping required transaction and accounting records and responding to lawful requests.</li>
      </ul>
      <h2 id="providers">Providers and international processing</h2>
      <p>
        Website signups, surveys, reservation records and first-party analytics are stored with Supabase, using our London, United
        Kingdom database region. The website is hosted through Sites on Cloudflare. Meta hosts instant forms and advertising measurement.
        Our email service handles correspondence sent to the support address. We have no connected automated marketing email provider
        and do not yet send automated free-waitlist confirmation or launch emails. We do not sell your personal information for money.
      </p>
      <p>
        When you use our contact form, Resend processes your email address, message and any name you provide to deliver the message
        to our support inbox. Resend also delivers reservation and refund updates using your email address, reservation reference,
        payment or refund details and message content, and records delivery status. These service messages are separate from marketing.
        Email contents are not sent to our analytics or advertising tools. Resend retains email data for up to 30 days under our plan;
        our support mailbox and reservation records keep correspondence as explained below.
        See <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Resend&rsquo;s Privacy Policy</a>.
      </p>
      <p>
        Stripe processes reservation payments through Stripe-hosted payment fields on this website or its hosted checkout page.
        Payment details go directly to Stripe; our application does not receive or store your full card number. Stripe also processes
        device and transaction information for payment authentication and fraud prevention. It returns payment references and status
        so we can administer your reservation and sends enabled payment and refund receipts to the checkout email.
        See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe&rsquo;s Privacy Policy</a>.
      </p>
      <p>
        Our business is in the United States. Our providers and their service providers may also process information outside your
        country, including in the United States; selecting a London database does not mean all support, hosting or payment processing
        remains in the UK. Published provider terms describe transfer arrangements, including standard contractual clauses and
        UK transfer provisions where applicable. You can read the <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener noreferrer">Supabase data-processing terms</a>,
        {" "}<a href="https://www.cloudflare.com/cloudflare-customer-dpa/" target="_blank" rel="noopener noreferrer">Cloudflare data-processing terms</a>,
        and the Stripe and Meta privacy policies linked above. Contact us for information about the destinations and safeguards
        relevant to your information or to request a copy of applicable safeguards.
      </p>
      <h2 id="browser-storage">Cookies and browser storage</h2>
      <p>These controls cover browser storage as well as cookies. <CookieSettingsLink /> lets you review your optional choices.</p>
      <ul>
        <li><strong>Consent preferences:</strong> stored in this browser to remember separate analytics and advertising choices. New choices include their date and notice version. Grants expire after 180 days or when a new notice version requires fresh permission; refusals remain respected until you change them. These records do not identify your reservation.</li>
        <li><strong>Analytics session and campaign information:</strong> used only with analytics consent and kept in the tab. A session credential expires for new events after 24 hours; continuing analytics replaces it and requests erasure of the previous session. Withdrawal removes the active credential and campaign information. Pending erasure references remain in this browser until their requests succeed. An older identifier that cannot authorise automatic erasure may be kept locally as a reference for support; you can clear browser storage, but this can prevent us from locating its records.</li>
        <li><strong>Advertising:</strong> Meta controls the lifetime of its cookies as described in its policy. Our duplicate-purchase record holds up to 100 event references until advertising consent is withdrawn or browser storage is cleared. Browser storage can also be removed through your browser settings.</li>
        <li><strong>Reservation receipt:</strong> an essential secure cookie, readable only by our server, lasts up to 30 days and lets you view or download the reservation confirmation in the browser where you paid.</li>
        <li><strong>Reservation form:</strong> after a free signup, an email can be kept in the tab to prefill the reservation form. It is used only if saved within the last 30 minutes and removed when the form reads it. A checkout-attempt reference linked to the email is kept in tab storage so retrying a connection failure can resume the same checkout.</li>
        <li><strong>Payment and security:</strong> Stripe and our host may use storage needed to provide the payment or protect the service. This is separate from optional website analytics and Meta advertising.</li>
      </ul>
      <h2 id="retention">How long we keep information</h2>
      <p>
        Launch-list details, manually accessed Meta signup information and survey answers are kept until you unsubscribe or request
        deletion, or the early-access programme ends, whichever is first. We may retain the minimum suppression or consent evidence
        needed to respect your choice and demonstrate compliance.
      </p>
      <p>
        First-party analytics is used to evaluate the early-access website and campaign performance during the programme. We remove
        identifiable session records when an applicable erasure request is fulfilled and delete or anonymise remaining analytics
        when the programme ends. A minimal withdrawal record may be retained to prevent delayed events from recreating a withdrawn session.
        Anonymous totals that can no longer identify a visitor may be retained.
      </p>
      <p>
        Reservation, payment and refund records are kept while a reservation is active and afterwards for applicable accounting,
        tax and dispute-handling requirements. Referral records are kept while the reward remains available and as needed to document
        its fulfilment. Support correspondence is kept while resolving the enquiry and for relevant follow-up or dispute periods;
        correspondence forming part of a reservation or refund follows that record&rsquo;s retention requirements. The relevant legal
        obligation, unresolved dispute and outstanding benefit determine whether a record must be kept longer. You can ask us which
        criteria apply to your records.
      </p>
      <h2 id="rights">Your rights and contact</h2>
      <p>
        Depending on the applicable law and processing, you may ask to access, correct or erase your personal information, restrict
        its use, receive a portable copy of information you supplied, or object to processing based on legitimate interests.
        You may object to direct marketing at any time. You can withdraw any consent without affecting the lawfulness of earlier processing.
        These rights have conditions and exceptions, including where transaction records must be retained by law.
      </p>
      <p>
        Email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> to make a request, unsubscribe, or ask about this notice.
        We may ask for proportionate information to verify and locate your records; please do not send full card details or health
        information. Where UK GDPR applies, we normally respond within one month and explain any permitted extension.
        You may complain to your local data-protection authority, including the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">UK Information Commissioner&rsquo;s Office</a>.
      </p>
    </LegalPage>
  );
}
