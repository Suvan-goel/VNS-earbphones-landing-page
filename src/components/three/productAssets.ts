import { useGLTF } from "@react-three/drei";

export const MANNEQUIN_MODEL_URL = "/models/cymba-neural-mannequin-organic.glb";

export function preloadMannequin() {
  useGLTF.preload(MANNEQUIN_MODEL_URL, "/draco/");
}

/** A retry must discard a rejected or pending loader entry, not reuse it. */
export function clearProductAssets(modelUrl: string | null) {
  if (modelUrl) useGLTF.clear(modelUrl);
  useGLTF.clear(MANNEQUIN_MODEL_URL);
}
