import { useGLTF, useTexture } from "@react-three/drei";

import { EARBUD_MOBILE_MODEL_URL, MANNEQUIN_MODEL_URL, MANNEQUIN_MOBILE_MODEL_URL, MANNEQUIN_AO_URL, MANNEQUIN_STONE_NORMAL_URL, MANNEQUIN_STONE_ROUGHNESS_URL } from "@/lib/product-asset-urls";
export { EARBUD_MOBILE_MODEL_URL, MANNEQUIN_MODEL_URL, MANNEQUIN_MOBILE_MODEL_URL, MANNEQUIN_AO_URL, MANNEQUIN_STONE_NORMAL_URL, MANNEQUIN_STONE_ROUGHNESS_URL };

function mannequinAssets(mobile: boolean): [url: string, kind: "model" | "map"][] {
  const assets: [string, "model" | "map"][] = [[mobile ? MANNEQUIN_MOBILE_MODEL_URL : MANNEQUIN_MODEL_URL, "model"], [MANNEQUIN_AO_URL, "map"]];
  // Phones never sample the grain or roughness maps, so they are not fetched there.
  if (!mobile) assets.push([MANNEQUIN_STONE_NORMAL_URL, "map"], [MANNEQUIN_STONE_ROUGHNESS_URL, "map"]);
  return assets;
}

const hinted = new Set<string>();

/**
 * Start downloading the head and its maps as soon as the earbuds have
 * arrived, without parsing anything yet: the hero keeps the main thread for
 * its first frames, and the bytes are already cached when preloadMannequin
 * asks for them a moment later. The hints match the loaders' own requests
 * (CORS, anonymous), so the browser reuses the preloaded responses.
 */
export function hintMannequinAssets(mobile = false) {
  if (typeof document === "undefined") return;
  for (const [href, kind] of mannequinAssets(mobile)) {
    if (hinted.has(href)) continue;
    hinted.add(href);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = kind === "model" ? "fetch" : "image";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

export function preloadMannequin(mobile = false) {
  for (const [url, kind] of mannequinAssets(mobile)) {
    if (kind === "model") useGLTF.preload(url, "/draco/");
    else useTexture.preload(url);
  }
}

/** A retry must discard a rejected or pending loader entry, not reuse it. */
export function clearProductAssets(modelUrl: string | null) {
  if (modelUrl) useGLTF.clear(modelUrl);
  useGLTF.clear(EARBUD_MOBILE_MODEL_URL);
  useGLTF.clear(MANNEQUIN_MODEL_URL);
  useGLTF.clear(MANNEQUIN_MOBILE_MODEL_URL);
  useTexture.clear(MANNEQUIN_AO_URL);
  useTexture.clear(MANNEQUIN_STONE_NORMAL_URL);
  useTexture.clear(MANNEQUIN_STONE_ROUGHNESS_URL);
}
