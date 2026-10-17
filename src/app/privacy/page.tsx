import type { Metadata } from "next";
import { site } from "@/config/site";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Privacy notice · ${site.brand}`, robots: { index: false } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="October 2026">
      <p>
        This notice explains what {site.legalName} (&ldquo;we&rdquo;) collects through this website while {site.product} is in development,
        why, and what you can do about it. We collect as little as we can.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your email address</strong>, when you join early access, so we can send development updates and availability news.
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
          <strong>Anonymous usage events</strong>, only if you allow analytics: page visits, button clicks and form progress, tied to a random
          identifier that lasts for your browser tab session. No cookies, no advertising identifiers, no cross-site tracking.
        </li>
      </ul>
      <p>We do not collect any health, biometric, EEG or physiological data through this website.</p>
      <h2>Why we use it</h2>
      <p>
        To run the waitlist you asked to join (your request), to understand demand for the product and improve this page (our legitimate
        interests, or your consent for analytics), and to contact you about research only if you opted in (your consent).
      </p>
      <h2>Who processes it</h2>
      <p>
        Signup data is stored with our database provider [Supabase, region: to be confirmed]. Emails may be sent through [email provider, to
        be confirmed]. We do not sell your data.
      </p>
      <h2>How long we keep it</h2>
      <p>Until you unsubscribe or ask us to delete it, or until the early-access programme ends, whichever comes first.</p>
      <h2>Your rights</h2>
      <p>
        You can ask to access, correct or delete your data, withdraw consent, or object to processing at any time by emailing{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>. You may also complain to your local data-protection authority.
      </p>
    </LegalPage>
  );
}
