// Scroll distances are in sticky-stage heights, including the portrait entry.
export const STORY_SCROLL_SCREENS = 5.2;
export const PORTRAIT_ENTRY_START = 0.85;
export const PORTRAIT_ENTRY_SCREENS = 1;

export function productStageProgress(distance: number) {
  if (!Number.isFinite(distance)) return 0;
  const travelled = Math.max(0, distance);
  const entry = Math.min(PORTRAIT_ENTRY_SCREENS, Math.max(0, travelled - STORY_SCROLL_SCREENS * PORTRAIT_ENTRY_START));
  return Math.min(1, (travelled - entry) / STORY_SCROLL_SCREENS);
}

/** Read the current layout, including restored scroll and responsive changes. */
export function readProductStageProgress(
  track: Pick<HTMLElement, "getBoundingClientRect"> | null,
  stage: Pick<HTMLElement, "clientHeight"> | null,
) {
  if (!track || !stage || stage.clientHeight <= 0) return null;
  return productStageProgress(-track.getBoundingClientRect().top / stage.clientHeight);
}
