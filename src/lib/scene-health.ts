export type SceneHealth = {
  lastDrawAt: number;
  loadingSince: number;
  ready: boolean;
};

/** Only count time while the viewer is on screen and the document is active. */
export function sceneRecoveryReason(health: SceneHealth, now: number, active: boolean) {
  if (!active) return null;
  if (!health.ready && now - health.loadingSince > 30000) return "loading";
  // First shader compilation and model preparation need more time than an
  // already running scene; do not restart a healthy but slow initial load.
  if (now - health.lastDrawAt > (health.ready ? 3000 : 10000)) return "stalled";
  return null;
}
