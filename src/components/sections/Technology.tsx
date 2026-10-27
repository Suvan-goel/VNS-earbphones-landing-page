import Image from "next/image";
import outerDetailImage from "@/assets/earbuds/site-imagery-v2/06-outer-detail.webp";
import innerDetailImage from "@/assets/earbuds/site-imagery-v1/07-inner-detail.webp";
import { site } from "@/config/site";
import { Container, Eyebrow, Headline } from "../ui";

/*
 * The specification table. Every value marked TBC is a PLACEHOLDER
 * until the engineering numbers are confirmed; edit this list only.
 */
const specs: { label: string; values: string[] }[] = [
  { label: "Audio", values: ["Dynamic driver, size TBC", "Frequency response TBC"] },
  { label: "Stimulation", values: ["Two conductive contacts on the inner housing", "Low-current pulses with a fixed ceiling", "20-minute sessions, one button to start and stop"] },
  { label: "Fit", values: ["Shaped housing with soft support wing", "Silicone tips in three sizes", "Weight per bud TBC"] },
  { label: "Cable and controller", values: ["Braided cable, length TBC", "Inline controller with three buttons and an indicator light", "USB-C connector"] },
  { label: "In the box", values: [`${site.product} earbuds`, "Three sizes of silicone tips", "Carry pouch (TBC)"] },
];

const productDetails = [
  {
    image: outerDetailImage,
    label: "Housing detail",
    alt: `An extreme close-up of the champagne rim joining ${site.product}'s textured black faceplate to its smoked translucent housing.`,
  },
  {
    image: innerDetailImage,
    label: "Inner contacts",
    alt: `Close-up of the inner side of ${site.product}, showing two conductive contacts on the housing, the silicone tip and plain support wing.`,
  },
];

/* Complementary product details beside the provisional specifications. */
export function Technology() {
  return (
    <section id="technology" aria-labelledby="tech-title" className="section scroll-mt-14">
      <Container>
        <div className="max-w-[40rem]">
          <Eyebrow className="reveal">Design and specifications</Eyebrow>
          <Headline id="tech-title" lines={["Designed to be", "worn all day."]} className="reveal mt-5 text-[clamp(2rem,3.6vw,3.25rem)]" />
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
          <div className="reveal lg:sticky lg:top-24">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {productDetails.map((detail) => (
                <figure key={detail.label}>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-studio">
                    <Image
                      src={detail.image}
                      alt={detail.alt}
                      fill
                      sizes="(min-width: 1330px) 300px, (min-width: 1024px) 23vw, calc((100vw - 56px) / 2)"
                      className="object-cover object-center"
                    />
                  </div>
                  <figcaption className="mt-3 text-xs font-medium text-muted">{detail.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>

          {/* Label on the left, values on the right, a hairline between rows. */}
          <div className="reveal">
            <dl className="border-t border-line">
              {specs.map((row) => (
                <div key={row.label} className="grid gap-2 border-b border-line py-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] sm:gap-8">
                  <dt className="text-sm font-medium text-ivory">{row.label}</dt>
                  <dd className="space-y-1 text-[0.9375rem] leading-relaxed text-muted">
                    {row.values.map((v) => (
                      <p key={v}>{v}</p>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-faint">Specifications are provisional and will be confirmed before launch.</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
