import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site, heroVariants, defaultVariant } from "@/config/site";

/* The share card: the page's light studio, headline on the left, the pair on the right. */

export const alt = `${site.product} — The earbuds for cognition. Coming soon.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#1d1d1f";
const paper = "#f5f5f7";
const muted = "#6e6e73";

export default async function OgImage() {
  const photo = await readFile(join(process.cwd(), "src/assets/earbuds/hero-premium-pair-v2.png"));
  const src = `data:image/png;base64,${photo.toString("base64")}`;
  const v = heroVariants[defaultVariant];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: paper, color: ink, padding: "56px 64px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(135deg, #ffffff 0%, #f5f5f7 55%, #e8e8ed 100%)" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: 620 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600, letterSpacing: -1.5 }}>{site.brand}</div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 18, fontWeight: 500, color: muted, letterSpacing: 0.5 }}>{v.eyebrow}</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 68, lineHeight: 1.05, fontWeight: 600, letterSpacing: -3 }}>
              <span>{v.headline[0]}</span>
              <span style={{ color: muted }}>{v.headline[1]}</span>
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 22, lineHeight: 1.4, color: muted, maxWidth: 560 }}>{v.subhead}</div>
            <div style={{ display: "flex", marginTop: 32 }}>
              <div style={{ display: "flex", borderRadius: 12, padding: "14px 26px", background: ink, color: paper, fontSize: 18, fontWeight: 500 }}>{v.primaryCta}</div>
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", right: 24, top: 15, display: "flex", width: 600, height: 600 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={600} height={600} alt="" />
        </div>
      </div>
    ),
    size,
  );
}
