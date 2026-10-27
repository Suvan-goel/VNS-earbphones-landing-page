import { useGLTF, useTexture } from "@react-three/drei";

export const MANNEQUIN_MODEL_URL = "/models/cymba-neural-mannequin-organic-detailed.glb";
export const MANNEQUIN_MOBILE_MODEL_URL = "/models/cymba-neural-mannequin-organic-detailed-mobile.glb";
export const EARBUD_MOBILE_MODEL_URL = "/models/cymba-earbuds-hero-mobile.glb";
export const MANNEQUIN_AO_URL = "/models/cymba-sculpture-ao.png";
export const MANNEQUIN_STONE_NORMAL_URL = "/models/cymba-sculpture-stone-normal.png";
export const MANNEQUIN_STONE_ROUGHNESS_URL = "/models/cymba-sculpture-stone-roughness.png";

export function preloadMannequin(mobile = false) {
  useGLTF.preload(mobile ? MANNEQUIN_MOBILE_MODEL_URL : MANNEQUIN_MODEL_URL, "/draco/");
  useTexture.preload(MANNEQUIN_AO_URL);
  useTexture.preload(MANNEQUIN_STONE_NORMAL_URL);
  useTexture.preload(MANNEQUIN_STONE_ROUGHNESS_URL);
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
