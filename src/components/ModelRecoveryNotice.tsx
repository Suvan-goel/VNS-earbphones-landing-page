"use client";

import { useEffect, useState } from "react";

export function ModelLoadingNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(timer);
  }, []);
  return show ? <p role="status" style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 2, color: "#6e6e73", fontSize: 13, whiteSpace: "nowrap" }}>Loading animation…</p> : null;
}

/** A failed decorative viewer should not become an unexplained frozen image. */
export function ModelRecoveryNotice({ onRetry }: { onRetry: () => void }) {
  return <div style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 2, pointerEvents: "auto", textAlign: "center", whiteSpace: "nowrap" }}>
    <p role="status" style={{ marginBottom: 8, fontSize: 13, color: "#6e6e73" }}>Animation paused</p>
    <button type="button" className="btn-secondary" onClick={onRetry}>Restart animation</button>
  </div>;
}
