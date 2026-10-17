import { ImageResponse } from "next/og";
import { site, heroVariants, defaultVariant } from "@/config/site";
import { HeroPair } from "@/components/visuals/HeroPair";

export const alt = `${site.product}: concept render of premium wired earphones`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Placeholder social card. Replace with a real product render when available. */
export default async function OgImage() {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const svg = renderToStaticMarkup(<HeroPair p="og" />)
    .replace(/var\(--accent\)/g, "#cfa28e")
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const v = heroVariants[defaultVariant];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#141516", color: "#eeeae1", padding: 64 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 34, letterSpacing: -1 }}>
            {site.brand.toLowerCase()}
            <div style={{ width: 11, height: 11, borderRadius: 11, background: "#cfa28e", marginLeft: 6, marginTop: 8 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 62, lineHeight: 1.02, letterSpacing: -2.5 }}>
            {v.headline.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          <div style={{ fontSize: 20, color: "rgba(238,234,225,0.6)", letterSpacing: 2, textTransform: "uppercase" }}>
            Concept in development · Join early access
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={560} height={583} style={{ marginLeft: "auto", marginTop: -10 }} alt="" />
      </div>
    ),
    size,
  );
}
