export type SceneHealth = {
  lastDrawAt: number;
  loadingSince: number;
  ready: boolean;
  /** When a frame was requested that has not been drawn yet; null while nothing is waiting. */
  pendingSince: number | null;
};

/** The first load has 30 s; a slow connection, where the models alone can take longer, gets 90 s. */
export const LOADING_BUDGET_MS = 30000;
export const SLOW_LOADING_BUDGET_MS = 90000;

export function loadingBudgetMs(downlinkMbps: number | null) {
  return downlinkMbps !== null && downlinkMbps < 2 ? SLOW_LOADING_BUDGET_MS : LOADING_BUDGET_MS;
}

/** The browser's own estimate where it offers one, otherwise the fastest large transfer so far. */
export function estimateDownlinkMbps(): number | null {
  if (typeof navigator === "undefined" || typeof performance === "undefined") return null;
  const connection = (navigator as Navigator & { connection?: { downlink?: number } }).connection;
  if (typeof connection?.downlink === "number" && connection.downlink > 0) return connection.downlink;
  let best: number | null = null;
  for (const entry of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
    const ms = entry.responseEnd - entry.responseStart;
    if (entry.transferSize < 100000 || ms <= 0) continue;
    const mbps = (entry.transferSize * 8) / ms / 1000;
    if (best === null || mbps > best) best = mbps;
  }
  return best;
}

/** Only count time while the viewer is on screen and the document is active. */
export function sceneRecoveryReason(health: SceneHealth, now: number, active: boolean, loadingBudget = LOADING_BUDGET_MS) {
  if (!active) return null;
  if (!health.ready && now - health.loadingSince > loadingBudget) return "loading";
  // Frames are drawn on demand, so a quiet scene is healthy; a requested frame
  // that never completes means the renderer has stopped. First shader
  // compilation and model preparation need more time than a running scene.
  if (health.pendingSince !== null && now - health.pendingSince > (health.ready ? 3000 : 10000)) return "stalled";
  return null;
}
