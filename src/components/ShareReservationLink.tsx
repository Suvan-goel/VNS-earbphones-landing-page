"use client";

import { useState } from "react";
import { reservation, site } from "@/config/site";
import styles from "./ShareReservationLink.module.css";

type ShareState = "idle" | "sharing" | "copied" | "fallback";

/** Share the public reservation page, never a personal checkout or receipt URL. */
export function ShareReservationLink() {
  const [state, setState] = useState<ShareState>("idle");

  async function share() {
    if (state === "sharing") return;
    setState("sharing");

    if (navigator.share) {
      try {
        await navigator.share({ title: `Reserve your ${site.brand} earbuds`, url: reservation.hostedUrl });
        setState("idle");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setState("idle");
          return;
        }
        // A blocked share sheet can still fall back to copying the public link.
      }
    }

    try {
      await navigator.clipboard.writeText(reservation.hostedUrl);
      setState("copied");
    } catch {
      setState("fallback");
    }
  }

  return (
    <div className={styles.share}>
      <button type="button" onClick={share} disabled={state === "sharing"} className={styles.link}>
        {state === "copied" ? "Link copied" : "Share reservation link"}
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M10 12V3m0 0L6.5 6.5M10 3l3.5 3.5M5 10v6h10v-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <span className="sr-only" role="status">{state === "copied" ? "Reservation link copied to clipboard." : ""}</span>
      {state === "fallback" && <p className={styles.fallback} role="status">Copy this link: <a href={reservation.hostedUrl}>{reservation.hostedUrl}</a></p>}
    </div>
  );
}
