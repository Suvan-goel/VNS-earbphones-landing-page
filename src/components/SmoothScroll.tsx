"use client";

import { useEffect } from "react";

/**
 * Weighted wheel scrolling: each wheel tick moves a target, and the page eases
 * toward it, so scrolling feels heavy and settles rather than snapping.
 * Touch, keyboard, scrollbar and anchor scrolling stay native, and the effect
 * is skipped entirely when the visitor prefers reduced motion.
 *
 * The hero copy also drifts down and fades as it leaves, so the first scroll
 * reads as the page gaining momentum.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const root = document.scrollingElement ?? document.documentElement;
    const EASE_RATE = 5.2; // lower is heavier
    const LINE_HEIGHT = 16;
    let target = window.scrollY;
    let current = window.scrollY;
    let frame = 0;
    let last = 0;
    const menuHeader = document.querySelector<HTMLElement>(".site-header");
    const menuIsOpen = () => menuHeader?.dataset.menuOpen === "true";
    const stopGlide = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      current = target = window.scrollY;
    };
    const menuObserver = new MutationObserver(stopGlide);
    if (menuHeader) menuObserver.observe(menuHeader, { attributes: true, attributeFilter: ["data-menu-open"] });

    const maxScroll = () => root.scrollHeight - window.innerHeight;

    // Nested scrollable areas (an open menu, a long select) keep their own scrolling.
    const canScrollInside = (node: EventTarget | null, deltaY: number) => {
      for (let el = node as Element | null; el && el !== document.body && el !== root; el = el.parentElement) {
        if (!(el instanceof Element)) continue;
        if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY) || el.scrollHeight <= el.clientHeight) continue;
        if (deltaY < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
      }
      return false;
    };

    const step = (now: number) => {
      if (menuIsOpen()) {
        stopGlide();
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
      last = now;
      current += (target - current) * (1 - Math.exp(-EASE_RATE * dt));
      if (Math.abs(target - current) < 0.5) current = target;
      window.scrollTo({ top: current, behavior: "instant" });
      frame = current === target ? 0 : requestAnimationFrame(step);
    };

    const onWheel = (event: WheelEvent) => {
      if (menuIsOpen()) {
        stopGlide();
        return;
      }
      if (event.ctrlKey || event.defaultPrevented) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (document.querySelector("dialog[open]") || canScrollInside(event.target, event.deltaY)) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? LINE_HEIGHT : event.deltaMode === 2 ? window.innerHeight : 1);
      if (!frame) {
        current = window.scrollY;
        target = current;
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
      target = Math.max(0, Math.min(maxScroll(), target + delta));
    };

    // Any other scrolling (keys, scrollbar, anchors) takes over from a glide in progress.
    const onScroll = () => {
      if (frame && Math.abs(window.scrollY - current) > 2) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (!frame) current = target = window.scrollY;
    };
    const onResize = () => {
      target = Math.min(target, maxScroll());
    };
    // A header link or in-page anchor scrolls the page itself; a glide still
    // settling after the last wheel tick would otherwise snap it back each frame.
    const onLinkClick = (event: MouseEvent) => {
      const node = event.target instanceof Element ? event.target : null;
      if (node?.closest('a[href*="#"]')) stopGlide();
    };

    // Hero parallax: copy drifts and fades while the picture settles.
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    const copy = hero?.querySelector<HTMLElement>("[data-hero-copy]");
    const media = hero?.querySelector<HTMLElement>("[data-hero-media]");
    const desktopHero = window.matchMedia("(min-width: 1024px)");
    let heroFrame = 0;
    const scrubHero = () => {
      heroFrame = 0;
      if (!hero || !copy || !media) return;
      const scrolled = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / hero.offsetHeight));
      copy.style.translate = scrolled ? `0 ${(scrolled * 6).toFixed(2)}vh` : "";
      copy.style.opacity = scrolled ? Math.max(0, 1 - scrolled * 0.9).toFixed(3) : "";
      media.style.scale = scrolled && desktopHero.matches ? (1 + scrolled * 0.03).toFixed(4) : "";
    };
    const scheduleHero = () => {
      if (!heroFrame) heroFrame = requestAnimationFrame(scrubHero);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", scheduleHero, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("resize", scheduleHero);
    window.addEventListener("click", onLinkClick, true);
    scrubHero();

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(heroFrame);
      menuObserver.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", scheduleHero);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("resize", scheduleHero);
      window.removeEventListener("click", onLinkClick, true);
    };
  }, []);

  return null;
}
