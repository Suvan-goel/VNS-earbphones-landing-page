import type { Metadata } from "next";
import { launch, reservation, site } from "@/config/site";
import { formatBothMarkets } from "@/config/pricing";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: `Terms · ${site.brand}`, robots: { index: false } };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="28 October 2026" showTemplateNotice={false}>
      <h2>About these terms</h2>
      <p>
        These terms explain how you may use the {site.brand} website, join the {site.product} launch list and make a paid reservation when available. References to
        {" "}&ldquo;{site.brand}&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo; mean {reservation.merchantName}, operating as {site.brand}.
        For questions, contact <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
      <h2>The launch list</h2>
      <p>
        Joining the launch list is free. You are signing up for {site.product} product-development, launch, pricing and availability
        updates. It is not a purchase, preorder, reservation or guarantee of availability, and there is no obligation to buy.
        You can unsubscribe at any time using the instructions in our emails or by contacting
        {" "}<a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
      <h2>Product development and availability</h2>
      <p>
        {site.product} is in development and is not yet available to buy. The website describes the product, its technology and its
        intended use. Design, specifications, compatibility, pricing and launch timing may change as development progresses.
        Final product details and any purchase terms will be provided before orders open.
      </p>
      <h2 id="pricing" className="scroll-mt-24">Planned pricing and launch</h2>
      <p>
        We plan to launch {site.product} in {launch.window}. The planned price of the earbuds is {formatBothMarkets("retail")}, paid once,
        and the {site.product} software subscription is planned at {formatBothMarkets("subscription", " a month")}. The website shows pounds
        sterling to visitors in the United Kingdom and US dollars to visitors elsewhere, and you can switch between the two. Planned prices
        exclude taxes and shipping, which depend on where your pair is delivered. We will confirm final pricing, taxes, shipping and the
        subscription terms before orders open and before asking you to pay anything beyond a reservation deposit.
      </p>
      <h2 id="reservations" className="scroll-mt-24">Paid reservations</h2>
      <p>
        When paid reservations are available, a one-time deposit of {formatBothMarkets("deposit")} records your place in the
        reservation queue for one pair of {site.product}. The deposit is charged in the currency shown at checkout, pounds sterling or
        US dollars, and that is the currency in which it is credited or refunded. {reservation.merchantName} accepts the reservation
        deposit, with payment processed by Stripe. A reservation is separate from the free launch
        list; it is not a purchase of the finished product, a subscription or an obligation to buy. Your founder number is assigned when
        we record confirmation of your successful payment, rather than the moment you start checkout. It is a reservation reference,
        not a guaranteed shipping date.
      </p>
      <p>
        The full deposit will be credited toward the price of the earbuds if you decide to buy; it does not cover the software
        subscription. The final price, specifications, shipping date, shipping cost, applicable taxes and delivery availability are
        not yet confirmed. We will provide these details and the final
        purchase terms before inviting you to pay the remaining balance. The remaining balance will not be charged automatically.
      </p>
      <p>
        <strong>Founders Edition.</strong> The first 50 reservations, counted in the order we record payment confirmations, are offered
        limited-edition Founders Buds at no extra cost when they buy the finished product. If a reservation in that group is cancelled,
        its place passes to the next confirmed reservation. The Founders Edition differs from the standard product in finish only.
      </p>
      <h2>Reservation cancellation and refunds</h2>
      <p>
        You can cancel your reservation for a full refund at any time before your pair ships. Email
        {" "}<a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> from the address used for your reservation and include your
        founder number or payment reference if available. We will return the deposit to the original payment method; your payment
        provider may take additional time to show the refund. Please do not send card details by email.
      </p>
      <p>
        If you decline the final purchase offer, or if we do not ship the product, your deposit will be refunded in full. A reservation
        does not guarantee a particular launch price, product specification or delivery date. Changes to these website terms do not
        remove the refund and deposit-credit commitments accepted when you reserved. Reservation terms version: {reservation.termsVersion}.
      </p>
      <h2>Product information</h2>
      <p>
        {site.product} brings together audio, brain and pulse sensing, and targeted non-invasive ear stimulation for cognition.
        Individual experiences and results can vary. {site.product} is not intended to diagnose, treat, cure or prevent disease.
        Information on this website is not medical advice or a substitute for advice from a qualified healthcare professional.
      </p>
      <h2>Using this website</h2>
      <p>
        Use this website lawfully. Do not interfere with its operation, attempt unauthorised access or submit someone else&rsquo;s
        contact information without permission. Website text, branding and visuals belong to {site.brand} or their respective owners.
        You may view and share links to this website; other use remains subject to applicable intellectual-property rights.
      </p>
      <h2>Privacy</h2>
      <p>
        Our <a href="/privacy">Privacy notice</a> explains how we handle information submitted through this website and our Facebook
        and Instagram signup forms, including your choices about updates, analytics and advertising measurement.
      </p>
      <h2>Updates and your rights</h2>
      <p>
        We may update these terms as the website and product develop. The date above identifies the latest version. Nothing in these
        terms excludes or limits rights or responsibilities that cannot lawfully be excluded or limited.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this website, the launch list or a reservation: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
      <p>{reservation.merchantName}, 2810 North Church Street, STE 89620, Wilmington, DE 19802, United States.</p>
    </LegalPage>
  );
}
