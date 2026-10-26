import type { Metadata } from "next";
import { reservation, site } from "@/config/site";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Privacy notice · ${site.brand}`, robots: { index: false } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="25 October 2026" showTemplateNotice={false}>
      <p>
        This notice explains what {site.brand} (&ldquo;we&rdquo;) collects through this website and our Facebook and Instagram signup forms
        as we prepare to launch {site.product}, why, and what you can do about it.
      </p>
      <h2>Who is responsible</h2>
      <p>
        {reservation.merchantName}, operating as {site.brand}, is responsible for handling the personal information described in this notice.
        Our business address is 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States.
        For privacy questions, contact <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your email address</strong>, when you sign up for product-development and launch updates, including pricing and availability.
        </li>
        <li>
          <strong>Reservation information</strong>, when you make a paid reservation: your contact email, deposit amount and currency,
          checkout and payment references, payment and refund status, founder number, timestamps, and the version of the reservation
          terms you accepted. We also record the campaign source and page version associated with the reservation. Reserving does
          not automatically subscribe you to marketing or research invitations.
        </li>
        <li>
          <strong>Your first name</strong>, when you join through our Facebook or Instagram instant form, so we can address our updates to you.
        </li>
        <li>
          <strong>Whether you opted in to research invitations</strong> (prototype testing and studies). This is optional and separate.
        </li>
        <li>
          <strong>Optional survey answers</strong>: what interests you, how likely you would be to buy, price ranges you would consider, a
          broad description of your role and any concerns you choose to share. These are stored with your signup.
        </li>
        <li>
          <strong>How you found us</strong>: campaign (UTM) parameters in the link you followed, the referring website&rsquo;s domain, and
          which version of the page you saw. Stored with your signup.
        </li>
        <li>
          <strong>First-party usage events</strong>, only if you allow analytics: page visits, button clicks and form progress, tied to a random
          identifier that lasts for your browser tab session. This separate analytics system does not use advertising cookies.
        </li>
      </ul>
      <p>We do not collect EEG, pulse or other sensor readings through this website. Please do not include health information in the optional survey.</p>
      <h2>Facebook and Instagram instant forms</h2>
      <p>
        If you join through a {site.brand} instant form on Facebook or Instagram, Meta collects the first name and email address you submit and the consent
        recorded on the form, and makes that submission available to us. We use it, with your consent, to send {site.product} development,
        launch, pricing and availability updates. These forms request your first name, email and consent, not health information or sensor readings.
      </p>
      <p>
        Authorised {site.brand} Page administrators can access submissions manually through Meta&apos;s lead tools. We have not connected
        these forms to an automatic transfer into our website database or an automated email service. You can withdraw your consent and
        ask us to stop sending updates at any time by emailing <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
        Joining is free and is not a preorder or an obligation to buy.
      </p>
      <h2>Optional Meta advertising measurement</h2>
      <p>
        We ask for separate marketing consent before loading Meta Pixel on <a href="https://trycymba.com">trycymba.com</a>. With your consent,
        it records a homepage visit (PageView) to help us understand our ads. Completed-signup tracking is disabled. Declining has no
        effect on your ability to sign up. We do not send your email address, survey answers, research preferences, sensor readings or
        survey access token as Pixel data, and do not enable advanced matching or automatic event collection in our integration.
      </p>
      <p>
        The Pixel communicates with Meta and can share your IP address, browser and device information, page URL, referring page and
        advertising cookie identifiers. Meta may associate these events with your Meta account and use them to measure and personalise
        advertising. This is not anonymous tracking. Meta may process information outside the United Kingdom under its own privacy
        terms. See the <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Meta Privacy Policy</a>.
      </p>
      <p>
        Your marketing choice is stored in your browser, separately from first-party analytics permission. If accepted, Meta may set
        advertising cookies; their duration depends on your browser and Meta&apos;s settings. Use <strong>Cookie settings</strong> on any
        page to reject or withdraw marketing consent. We stop
        future Pixel events, discard unsent events and remove these first-party Meta cookies where accessible. Withdrawal cannot recall
        information already sent to Meta. If your browser prevents preference storage, your choice applies for the current page only.
      </p>
      <h2>Why we use it</h2>
      <p>
        We rely on your consent to send the product-development and launch updates you sign up for, whether on our website or through
        Facebook and Instagram. We use optional survey answers for our legitimate interest in understanding product demand. Website
        analytics and advertising measurement each require your separate consent. Research invitations also require a separate opt-in.
        You can withdraw consent at any time without affecting processing that took place before withdrawal.
      </p>
      <p>
        We use reservation information to take the steps you request before reserving, perform the reservation agreement, provide
        payment and product-availability updates relating to your reservation, and arrange refunds. We retain transaction records where
        needed to meet applicable accounting and legal obligations. These operational messages are separate from optional marketing updates.
      </p>
      <h2>Who processes it</h2>
      <p>
        Website signup data and optional survey answers are stored with Supabase in London, United Kingdom. The website is hosted through
        Sites on Cloudflare. Meta hosts the Facebook and Instagram forms and makes their submissions available in its lead tools; those
        submissions are not automatically copied to Supabase. Contact emails are handled through the support address above. We are not
        sending automated free-waitlist confirmation or launch emails yet, and no marketing email provider is connected. We do not sell your data.
      </p>
      <p>
        When payments are enabled, Stripe processes reservation payments on its hosted checkout page. Card details go directly to
        Stripe; our website does not receive or store your full card number. Stripe sends payment and refund receipts to the email
        address provided at checkout. Stripe returns payment references and status information
        so we can administer your reservation and refunds. Our reservation records are stored with Supabase. Stripe processes
        information under its <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and
        may process it internationally.
      </p>
      <h2>Reservation details in your browser</h2>
      <p>
        If you choose to reserve after joining the free list, we temporarily keep your email in your browser tab to fill in the
        reservation form. It is removed when the form reads it and only used if it was saved within the last 30 minutes. We also keep
        a random checkout-attempt identifier linked to your email in that tab&rsquo;s session storage so retrying after a connection
        problem can return to the same checkout. This storage lasts for the browser tab session; an attempt is removed when it needs
        to be replaced. These details are not added to the reservation link or used for advertising.
      </p>
      <h2>How long we keep it</h2>
      <p>We keep launch-list and survey information until you unsubscribe or ask us to delete it, or until the early-access programme ends, whichever comes first.</p>
      <p>
        Reservation and transaction records are kept as needed to administer your reservation, payments and refunds and to meet
        applicable record-keeping requirements. Unsubscribing from the free list does not cancel a paid reservation or erase records
        we still need for those purposes. Contact us to cancel a reservation, request deletion or ask about the records we retain.
      </p>
      <h2>Your rights</h2>
      <p>
        You can ask to access, correct or delete your data, withdraw consent, or object to processing at any time by emailing{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>. You may also complain to your local data-protection authority, including the UK
        <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer"> Information Commissioner&apos;s Office</a>.
      </p>
    </LegalPage>
  );
}
