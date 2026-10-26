"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/config/site";
import { Wordmark } from "./Wordmark";

const links = [
  { href: "/#idea", label: "Overview" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

/*
 * Some chapters live inside the pinned product stage on desktop and as ordinary
 * sections elsewhere. A link scrolls to whichever target is actually visible.
 */
function goTo(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (window.location.pathname !== "/") return;
  const id = href.split("#")[1];
  if (!id) return;
  if (id === "top") {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    history.replaceState(null, "", href);
    return;
  }
  const candidates = [...document.querySelectorAll<HTMLElement>(`[data-anchor="${id}"], #${CSS.escape(id)}`)];
  const target = candidates.find((el) => el.getClientRects().length > 0);
  if (!target) return;
  e.preventDefault();
  // Measure after the mobile sheet closes so its height is not included.
  requestAnimationFrame(() => {
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 72;
    const top = target.getBoundingClientRect().top + window.scrollY - (target.dataset.anchor ? 0 : headerBottom + 16);
    window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    history.replaceState(null, "", href);
  });
}

export function Nav({ cta, ctaHref = "#signup" }: { cta: string; ctaHref?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
      // The active layout supplies its own start marker. Hidden responsive
      // alternatives cannot change the header, and scrolling back reverses it.
      setDark([...document.querySelectorAll<HTMLElement>("[data-nav-dark-start]")]
        .some((marker) => marker.getClientRects().length > 0 && marker.getBoundingClientRect().top <= 0));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    reducedMotion.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus({ preventScroll: true });
    };
    const onOutside = (e: PointerEvent | FocusEvent) => {
      if (e.target instanceof Node && !header.current?.contains(e.target)) setOpen(false);
    };
    const onBreakpoint = () => {
      if (desktop.matches) setOpen(false);
    };
    onBreakpoint();
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("focusin", onOutside);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open]);

  return (
    /* Wordmark left, links centred, and one clear action on the right. */
    <header ref={header} data-scrolled={scrolled || open} data-theme={dark ? "dark" : "light"} data-menu-open={open || undefined} className="site-header">
      <nav aria-label="Primary" className="site-nav">
        <a href="/#top" className="site-nav__brand" aria-label={`${site.brand}, back to top`} onClick={(e) => { setOpen(false); goTo(e, "/#top"); }}>
          <Wordmark className="site-nav__wordmark" size="text-[1.125rem] sm:text-[1.375rem]" />
        </a>
        <ul className="site-nav__links">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="site-nav__link" onClick={(e) => goTo(e, l.href)}>{l.label}</a>
            </li>
          ))}
        </ul>
        <div className="site-nav__actions">
          <a href={ctaHref} data-cta="nav" onClick={() => setOpen(false)} className="site-nav__cta">{cta}</a>
          <button
            ref={menuButton}
            type="button"
            className="site-nav__menu-button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="site-nav__menu-icon" aria-hidden="true" />
          </button>
        </div>
      </nav>
      <div id="mobile-menu" hidden={!open} className="site-nav__sheet">
        <ul>
          {[...links, { href: ctaHref, label: cta }].map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                data-cta={l.href === ctaHref ? "nav" : undefined}
                onClick={(e) => {
                  setOpen(false);
                  menuButton.current?.focus({ preventScroll: true });
                  goTo(e, l.href);
                }}
                className="site-nav__sheet-link"
              >
                {l.label}
                <svg className="site-nav__sheet-arrow" aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="m7.5 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
