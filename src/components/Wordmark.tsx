import Image from "next/image";
import flowMark from "@/assets/brand/cymba-flow-mark-charcoal.png";
import { site } from "@/config/site";

/** Flow symbol with the current public brand rendered as a lowercase wordmark. */
export function Wordmark({ className = "", size = "text-[1.125rem] sm:text-[1.25rem]" }: { className?: string; size?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-[0.3em] ${size} leading-none ${className}`}>
      <Image
        src={flowMark}
        alt=""
        aria-hidden="true"
        unoptimized
        className="block h-[1.1em] w-auto sm:h-[1.3em]"
      />
      <span className="text-[1.6em] font-medium tracking-[-0.065em]">{site.brand}</span>
    </span>
  );
}
