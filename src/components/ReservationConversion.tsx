"use client";

import { useEffect } from "react";
import { trackMetaPurchase } from "@/lib/meta-pixel";

type Props = { eventId: string; value: number; currency: string };

/** The server mounts this only after a live, paid reservation is recorded. */
export function ReservationConversion({ eventId, value, currency }: Props) {
  useEffect(() => {
    trackMetaPurchase({ eventId, value, currency });
  }, [eventId, value, currency]);

  return null;
}
