"use client";

import { useEffect, useRef, useState } from "react";

/** Announce a refreshed outcome without moving focus or rereading the receipt. */
export function ReservationStatusAnnouncement({ message }: { message: string }) {
  const previousMessage = useRef(message);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (message === previousMessage.current) return;
    previousMessage.current = message;
    setAnnouncement(message);
  }, [message]);

  return <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>;
}
