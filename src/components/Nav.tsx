"use client";

import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { Wordmark } from "./Wordmark";

const links = [
  { href: "#sound", label: "Sound" },
  { href: "#technology", label: "Technology" },
  { href: "#research", label: "Research" },
  { href: "#faq", label: "FAQ" },
];

export function Nav({ cta }: { cta: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      data-scrolled={scrolled || open}
      className="fixed inset-x-0 top-0 z-40 text-bone transition-[background-color,backdrop-filter,border-color] duration-500 data-[scrolled=true]:border-b data-[scrolled=true]:border-white/[0.06] data-[scrolled=true]:bg-ink/75 data-[scrolled=true]:backdrop-blur-xl"
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-2" aria-label={`${site.brand}, back to top`}>
          <Wordmark />
        </a>
        <ul className="hidden items-center gap-8 text-[0.85rem] text-bone/70 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-bone">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <a
            href="#early-access"
            data-cta="nav"
            className="inline-flex h-9 items-center rounded-full bg-bone px-4 text-[0.82rem] font-medium text-ink transition-colors hover:bg-white"
          >
            {cta}
          </a>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="relative block h-2.5 w-4">
              <span className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ${open ? "top-1 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ${open ? "top-1 -rotate-45" : "top-2.5"}`} />
            </span>
          </button>
        </div>
      </nav>
      <div id="mobile-menu" hidden={!open} className="border-t border-white/[0.06] md:hidden">
        <ul className="mx-auto flex max-w-[1280px] flex-col px-5 py-3 sm:px-8">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)} className="block py-3 text-lg tracking-tight text-bone/85">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
