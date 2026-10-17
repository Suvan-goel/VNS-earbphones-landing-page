import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-12 ${className}`}>{children}</div>;
}

type Tone = "dark" | "light";

export function CtaButton({
  href = "#early-access",
  children,
  tone = "dark",
  location,
  className = "",
}: {
  href?: string;
  children: ReactNode;
  tone?: Tone;
  location: string;
  className?: string;
}) {
  const palette =
    tone === "dark" ? "bg-bone text-ink hover:bg-white" : "bg-ink text-bone hover:bg-ink-3";
  return (
    <a
      href={href}
      data-cta={location}
      className={`group inline-flex h-12 items-center gap-3 rounded-full pl-6 pr-5 text-[0.95rem] font-medium tracking-[-0.01em] transition-colors duration-300 ${palette} ${className}`}
    >
      {children}
      <span className="relative inline-flex size-6 items-center justify-center overflow-hidden rounded-full bg-accent text-white">
        <Arrow className="size-3.5 transition-transform duration-500 ease-out-expo group-hover:translate-x-5" />
        <Arrow className="absolute size-3.5 -translate-x-5 transition-transform duration-500 ease-out-expo group-hover:translate-x-0" />
      </span>
    </a>
  );
}

export function TextLink({ href, children, className = "", cta }: { href: string; children: ReactNode; className?: string; cta?: string }) {
  return (
    <a
      href={href}
      data-cta={cta}
      className={`group inline-flex h-12 items-center gap-2 text-[0.95rem] font-medium tracking-[-0.01em] ${className}`}
    >
      <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-out-expo group-hover:bg-[length:100%_1px]">
        {children}
      </span>
      <Arrow className="size-3.5 rotate-90 opacity-60" />
    </a>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
      <path d="M2 8h11M9 3.5 13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const statusStyle = {
  core: { label: "Core direction", dot: "bg-accent" },
  research: { label: "Research stage", dot: "bg-ti" },
  future: { label: "Possible future", dot: "border border-current bg-transparent" },
} as const;

export function StatusTag({ status, className = "" }: { status: keyof typeof statusStyle; className?: string }) {
  const s = statusStyle[status];
  return (
    <span className={`tag ${className}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/** Labels a visual as a concept, so illustrations are never mistaken for product photos. */
export function ConceptCaption({ children = "Concept render. Industrial design in development.", className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <p className={`eyebrow flex items-center gap-2 !text-[0.64rem] opacity-60 ${className}`}>
      <span className="inline-block size-1 rounded-full bg-current" aria-hidden="true" />
      {children}
    </p>
  );
}
