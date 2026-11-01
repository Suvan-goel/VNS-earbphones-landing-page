import { EARBUD_MOBILE_MODEL_URL } from "@/lib/product-asset-urls";

/**
 * Fetch alongside the page, instead of after hydration and the 3D chunk. The
 * models are large, so they take the low lane: the page's own scripts, which
 * hydrate the page and start the scene, must not queue behind a megabyte of
 * geometry on a slow connection. The small decoder keeps the default priority.
 */
export function ProductAssetHints({ modelUrl }: { modelUrl: string }) {
  return <>
    <link rel="preload" href="/draco/draco_wasm_wrapper.js" as="fetch" crossOrigin="anonymous" />
    <link rel="preload" href="/draco/draco_decoder.wasm" as="fetch" crossOrigin="anonymous" />
    <link rel="preload" href={EARBUD_MOBILE_MODEL_URL} as="fetch" crossOrigin="anonymous" fetchPriority="low" media="(max-width: 1023px)" />
    <link rel="preload" href={modelUrl} as="fetch" crossOrigin="anonymous" fetchPriority="low" media="(min-width: 1024px)" />
  </>;
}
