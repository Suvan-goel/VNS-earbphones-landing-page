"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Re-read recorded status briefly while the payment webhook catches up. */
export function ReservationStatusRefresh() {
  const router = useRouter();
  const deadline = useRef<number | null>(null);

  useEffect(() => {
    deadline.current ??= Date.now() + 30_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      const remaining = deadline.current! - Date.now();
      if (document.visibilityState !== "visible" || remaining <= 0) return;
      timer = setTimeout(() => {
        if (document.visibilityState !== "visible" || Date.now() >= deadline.current!) return;
        router.refresh();
        schedule();
      }, Math.min(2_000, remaining));
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [router]);

  return null;
}
