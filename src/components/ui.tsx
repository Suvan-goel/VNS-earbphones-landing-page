import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1330px] px-5 sm:px-8 lg:px-[var(--desktop-gutter)] ${className}`}>{children}</div>;
}

/**
 * Two-tone headline: the statement in ivory, the response in a softer tone.
 */
export function Headline({
  as: Tag = "h2",
  lines,
  id,
  className = "",
}: {
  as?: "h1" | "h2" | "h3";
  lines: [string, string?];
  id?: string;
  className?: string;
}) {
  const [first, second] = lines;
  return (
    <Tag id={id} className={`headline ${className}`}>
      <span className="block">{first}</span>
      {second && <span className="soft block">{second}</span>}
    </Tag>
  );
}

export function CtaButton({
  href = "#signup",
  children,
  location,
  className = "",
}: {
  href?: string;
  children: ReactNode;
  location: string;
  className?: string;
}) {
  return (
    <a href={href} data-cta={location} className={`btn-primary ${className}`}>
      {children}
    </a>
  );
}

export function SecondaryButton({ href, children, className = "", cta }: { href: string; children: ReactNode; className?: string; cta?: string }) {
  return (
    <a href={href} data-cta={cta} className={`btn-secondary ${className}`}>
      {children}
      <span aria-hidden="true">↓</span>
    </a>
  );
}

const statusStyle = {
  core: { label: "Core direction", dot: "bg-rose" },
  research: { label: "Research stage", dot: "bg-faint" },
  future: { label: "Possible future", dot: "border border-current bg-transparent" },
} as const;

export function StatusTag({ status, className = "" }: { status: keyof typeof statusStyle; className?: string }) {
  const s = statusStyle[status];
  return (
    <span className={`tag text-muted ${className}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

/** Centred section opener: eyebrow, two-tone headline and an optional lede. */
export function SectionHead({
  eyebrow,
  lines,
  id,
  children,
  aside,
  className = "",
}: {
  eyebrow: ReactNode;
  lines: [string, string?];
  id: string;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto flex max-w-[52rem] flex-col items-center text-center ${className}`}>
      <div className="reveal flex flex-wrap items-center justify-center gap-3">
        <Eyebrow>{eyebrow}</Eyebrow>
        {aside}
      </div>
      <Headline id={id} lines={lines} className="reveal mt-5 text-[clamp(2.25rem,4.4vw,3.75rem)]" />
      {children && <div className="reveal mt-6 max-w-[40rem] space-y-4 text-[1.0625rem] leading-relaxed text-ivory-soft">{children}</div>}
    </div>
  );
}
