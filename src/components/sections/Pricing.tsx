import { launch, reservation, site } from "@/config/site";
import { MarketToggle } from "../MarketToggle";
import { Price } from "../Price";
import { Container, Eyebrow, Headline } from "../ui";

/*
 * Three plain numbers in the visitor's currency: the earbuds, the software and
 * the refundable deposit. The switch above the cards changes every amount on
 * the page, including the reservation call to action.
 */
export function Pricing({ reservations = false }: { reservations?: boolean }) {
  const cardClass = "reveal panel flex flex-col px-5 py-6 sm:px-7 sm:py-7";
  const labelClass = "text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-ivory-soft sm:text-xs";
  const amountClass = "mt-4 text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-ivory sm:text-[2.75rem]";
  const noteClass = "mt-3 text-[0.9375rem] leading-relaxed text-muted";

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="section scroll-mt-14 !pt-12 sm:!pt-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <Eyebrow className="reveal">Pricing</Eyebrow>
            <Headline id="pricing-title" lines={[`Launching ${launch.window}.`, "What it will cost."]} className="reveal mt-5 text-[clamp(2.25rem,3.4vw,3rem)]" />
          </div>
          <MarketToggle className="reveal" />
        </div>

        <div className="mt-8 grid gap-2.5 sm:mt-10 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          <div className={cardClass} style={{ ["--d" as string]: "0ms" }}>
            <p className={labelClass}>Earbuds</p>
            <p className={amountClass}><Price of="retail" /></p>
            <p className={noteClass}>Paid once. Includes the {site.product} earbuds and three sizes of ear tips.</p>
          </div>
          <div className={cardClass} style={{ ["--d" as string]: "50ms" }}>
            <p className={labelClass}>Software</p>
            <p className={amountClass}><Price of="subscription" /><span className="ml-1 text-[1.125rem] font-normal tracking-normal text-muted">/month</span></p>
            <p className={noteClass}>The {site.product} app and software subscription, billed monthly.</p>
          </div>
          <div className={cardClass} style={{ ["--d" as string]: "100ms" }}>
            <p className={labelClass}>Reserve today</p>
            <p className={amountClass}><Price of="deposit" /></p>
            <p className={noteClass}>
              {reservations
                ? <>Fully refundable before shipping, and taken off the <Price of="retail" /> price. The first 50 reservations get limited-edition Founders Buds at no extra cost.</>
                : <>A refundable deposit that comes off the <Price of="retail" /> price. Paid reservations open soon.</>}
            </p>
            <div className="mt-auto pt-6">
              {reservations
                ? <a href={reservation.path} data-cta="pricing_reserve" className="btn-primary w-full sm:w-auto"><span>Reserve for <Price of="deposit" /></span></a>
                : <a href="#signup" data-cta="pricing_signup" className="btn-secondary w-full sm:w-auto">Join the waitlist</a>}
            </div>
          </div>
        </div>

        <p className="reveal mt-5 max-w-[60rem] text-xs leading-relaxed text-muted">
          Prices are shown in pounds for the UK and in US dollars for the US. Final pricing, taxes and shipping are confirmed before you buy, and a reservation deposit is refundable in full until your pair ships.
        </p>
      </Container>
    </section>
  );
}
