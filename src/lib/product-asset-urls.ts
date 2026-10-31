// Kept free of 3D imports so the initial HTML can start fetching hero assets.
// Version keys change when an optimized model or map is regenerated.
// Compact delivery copies (scripts/build-compact-models.mjs): the same meshes and textures,
// re-encoded for size; the version keys come from scripts/compact-models-report.json.
export const EARBUD_MOBILE_MODEL_URL = "/models/cymba-earbuds-hero-mobile-compact.glb?v=53b40e2d";
// The original sculpture with the internal cortex and illustrative neural activity.
// Bake cortical arbors after the original cortex with build-neural-activation.mjs.
export const MANNEQUIN_MODEL_URL = "/models/cymba-stimulated-mannequin-desktop-compact.glb?v=dccbfec0";
export const MANNEQUIN_MOBILE_MODEL_URL = "/models/cymba-stimulated-mannequin-mobile-compact.glb?v=71a0880c";
// Cavity occlusion is loaded on every device; the grain and roughness maps
// only on desktop, where the head is large enough for them to reach a pixel.
export const MANNEQUIN_AO_URL = "/models/cymba-sculpture-ao.webp?v=5f78635c";
export const MANNEQUIN_STONE_NORMAL_URL = "/models/cymba-sculpture-stone-normal.webp?v=f943ea63";
export const MANNEQUIN_STONE_ROUGHNESS_URL = "/models/cymba-sculpture-stone-roughness.webp?v=f35ec6ce";
