"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { reservation, site } from "@/config/site";
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
  // Wait for the menu's scroll lock to release; only the compact bar is an offset.
  requestAnimationFrame(() => {
    const headerBottom = document.querySelector(".site-nav")?.getBoundingClientRect().bottom ?? 48;
    const top = target.getBoundingClientRect().top + window.scrollY - (target.dataset.anchor ? 0 : headerBottom + 16);
    window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    history.replaceState(null, "", href);
  });
}

export function Nav({ cta, ctaHref = "#signup" }: { cta: string; ctaHref?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
      // The hero carries its own black button; the header's turns black once the hero has gone.
      setPastHero(window.scrollY > window.innerHeight * 0.6);
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

  useLayoutEffect(() => {
    if (!open) return;
    const headerElement = header.current;
    if (!headerElement) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    if (desktop.matches) {
      setOpen(false);
      return;
    }

    // Keep the document at its current position while the panel scrolls independently.
    const overflowStyles = [document.documentElement, document.body].map((element) => ({
      element,
      x: element.style.getPropertyValue("overflow-x"),
      xPriority: element.style.getPropertyPriority("overflow-x"),
      y: element.style.getPropertyValue("overflow-y"),
      yPriority: element.style.getPropertyPriority("overflow-y"),
    }));
    const rootStyle = document.documentElement.style;
    const scrollbarGutter = rootStyle.getPropertyValue("scrollbar-gutter");
    const scrollbarGutterPriority = rootStyle.getPropertyPriority("scrollbar-gutter");
    if (!getComputedStyle(document.documentElement).getPropertyValue("scrollbar-gutter").includes("stable")) {
      rootStyle.setProperty("scrollbar-gutter", "stable");
    }
    window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: "instant" });
    for (const { element } of overflowStyles) element.style.setProperty("overflow", "hidden");

    // Inert every branch outside the dialog, including when a layout wraps the header.
    const backgroundElements = new Map<HTMLElement, boolean>();
    let branch: HTMLElement = headerElement;
    while (branch.parentElement) {
      const parent = branch.parentElement;
      for (const sibling of parent.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
        backgroundElements.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      if (parent === document.body) break;
      branch = parent;
    }

    const focusableElements = () => [...headerElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.tabIndex >= 0
      && !element.closest('[inert], [aria-hidden="true"]')
      && element.getClientRects().length > 0
      && getComputedStyle(element).visibility !== "hidden");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        menuButton.current?.focus({ preventScroll: true });
        return;
      }
      if (e.key !== "Tab") return;
      const controls = focusableElements();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && (document.activeElement === first || !headerElement.contains(document.activeElement))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (document.activeElement === last || !headerElement.contains(document.activeElement))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof Node && !headerElement.contains(e.target)) {
        menuButton.current?.focus({ preventScroll: true });
      }
    };
    const onBreakpoint = () => {
      if (desktop.matches) setOpen(false);
    };
    menuButton.current?.focus({ preventScroll: true });
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      desktop.removeEventListener("change", onBreakpoint);
      for (const [element, inert] of backgroundElements) element.inert = inert;
      for (const { element, x, xPriority, y, yPriority } of overflowStyles) {
        element.style.removeProperty("overflow");
        if (x) element.style.setProperty("overflow-x", x, xPriority);
        if (y) element.style.setProperty("overflow-y", y, yPriority);
      }
      rootStyle.removeProperty("scrollbar-gutter");
      if (scrollbarGutter) rootStyle.setProperty("scrollbar-gutter", scrollbarGutter, scrollbarGutterPriority);
      if (desktop.matches && headerElement.contains(document.activeElement)) {
        headerElement.querySelector<HTMLAnchorElement>(".site-nav__brand")?.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return (
    /* Wordmark left, links centred, and one clear action on the right. */
    <header ref={header} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? "Navigation menu" : undefined} data-scrolled={scrolled || open} data-past-hero={pastHero || open || dark} data-theme={dark ? "dark" : "light"} data-menu-open={open || undefined} className="site-header">
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
      <div id="mobile-menu" inert={!open} aria-hidden={!open} className="site-nav__sheet">
        <ul>
          {[
            ...links,
            { href: ctaHref, label: cta },
            ...(ctaHref === reservation.path ? [] : [{ href: reservation.path, label: "Reserve yours" }]),
          ].map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                data-cta={l.href === ctaHref || l.href === reservation.path ? "nav" : undefined}
                onClick={(e) => {
                  setOpen(false);
                  menuButton.current?.focus({ preventScroll: true });
                  goTo(e, l.href);
                }}
                className="site-nav__sheet-link"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
