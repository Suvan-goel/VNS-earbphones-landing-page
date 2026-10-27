// The model and closing portrait use separate tracks, measured in stage heights.
export const STORY_SCROLL_SCREENS = 5.2;
export const PORTRAIT_ENTRY_START = 0.85;
export const PORTRAIT_ENTRY_SCREENS = 1;
export const MODEL_SCROLL_SCREENS = STORY_SCROLL_SCREENS * PORTRAIT_ENTRY_START;
export const CLOSING_SCROLL_SCREENS = STORY_SCROLL_SCREENS * (1 - PORTRAIT_ENTRY_START);

function stageDistance(distance: number) {
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
}

/** Preserve the original model timing and hold its last pose as its track exits. */
export function productStageProgress(distance: number) {
  return Math.min(PORTRAIT_ENTRY_START, stageDistance(distance) / STORY_SCROLL_SCREENS);
}

/** Native scroll plus resize-observed geometry avoids layout reads per frame. */
export function measuredProductStageProgress(scrollY: number, trackTop: number, stageHeight: number) {
  if (!Number.isFinite(stageHeight) || stageHeight <= 1 || !Number.isFinite(trackTop)) return null;
  return productStageProgress((scrollY - trackTop) / stageHeight);
}

/** Read the current layout, including restored scroll and responsive changes. */
export function readProductStageProgress(
  track: Pick<HTMLElement, "getBoundingClientRect"> | null,
  stage: Pick<HTMLElement, "clientHeight"> | null,
) {
  if (!track || !stage || stage.clientHeight <= 0) return null;
  return productStageProgress(-track.getBoundingClientRect().top / stage.clientHeight);
}
