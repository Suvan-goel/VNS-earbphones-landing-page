import { useGLTF, useTexture } from "@react-three/drei";

import { EARBUD_MOBILE_MODEL_URL, MANNEQUIN_MODEL_URL, MANNEQUIN_MOBILE_MODEL_URL, MANNEQUIN_AO_URL, MANNEQUIN_STONE_NORMAL_URL, MANNEQUIN_STONE_ROUGHNESS_URL } from "@/lib/product-asset-urls";
export { EARBUD_MOBILE_MODEL_URL, MANNEQUIN_MODEL_URL, MANNEQUIN_MOBILE_MODEL_URL, MANNEQUIN_AO_URL, MANNEQUIN_STONE_NORMAL_URL, MANNEQUIN_STONE_ROUGHNESS_URL };

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
