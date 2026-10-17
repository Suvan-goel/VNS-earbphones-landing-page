import { site } from "@/config/site";

/** Placeholder wordmark: lowercase brand name with a small rose-gold mark. */
export function Wordmark({ className = "", size = "text-[1.6rem]" }: { className?: string; size?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.16em] ${size} font-medium leading-none tracking-[-0.045em] text-ivory ${className}`}>
      {site.brand.toLowerCase()}
      <span className="inline-block size-[0.22em] rounded-full bg-rose" aria-hidden="true" />
    </span>
  );
}
