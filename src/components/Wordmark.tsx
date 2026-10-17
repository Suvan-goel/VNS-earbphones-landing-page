import { site } from "@/config/site";

/** Placeholder wordmark: brand name set in the display face with a signal dot. */
export function Wordmark({ className = "", size = "text-[1.18rem]" }: { className?: string; size?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.18em] font-display ${size} font-medium tracking-[-0.04em] ${className}`}>
      {site.brand.toLowerCase()}
      <span className="inline-block size-[0.32em] translate-y-[-0.05em] rounded-full bg-accent" aria-hidden="true" />
    </span>
  );
}
