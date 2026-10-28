import type { AnchorHTMLAttributes } from "react";

/* "Back to site": a quiet text link with a small arrow, styled the same on every page away from the home page. */
export function BackLink({ href = "/", className, children = "Back to site", ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} className={className ? `back-link ${className}` : "back-link"} {...rest}>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m8 5-5 5 5 5M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {children}
    </a>
  );
}
