"use client";

import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { Wordmark } from "./Wordmark";

const links = [
  { href: "#sound", label: "Sound" },
  { href: "#technology", label: "Technology" },
  { href: "#research", label: "Research" },
  { href: "#faq", label: "Questions" },
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
      className="fade-in fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter] duration-500 data-[scrolled=true]:bg-black/40 data-[scrolled=true]:backdrop-blur-xl"
    >
      <nav aria-label="Primary" className="mx-auto flex max-w-[1330px] items-center justify-between px-5 py-4 sm:px-8 sm:py-6 lg:px-12">
        <a href="#top" aria-label={`${site.brand}, back to top`}>
          <Wordmark />
        </a>
        <div className="flex items-center gap-[22px] rounded-full border border-[var(--line)] bg-black/45 py-[5px] pr-[5px] pl-[22px] text-sm backdrop-blur-[18px]">
          <ul className="hidden items-center gap-[22px] md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="text-ivory transition-colors hover:text-[#faf7f0]">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="-mr-2 inline-flex h-9 items-center text-ivory md:hidden"
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
          <a
            href="#early-access"
            data-cta="nav"
            className="inline-flex items-center rounded-full bg-ivory px-[18px] py-[9px] text-sm font-medium text-[#141414] transition-colors hover:bg-[#faf7f0]"
          >
            {cta}
          </a>
        </div>
      </nav>
      <div id="mobile-menu" hidden={!open} className="md:hidden">
        <ul className="mx-auto flex max-w-[1330px] flex-col px-5 pb-5 sm:px-8">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)} className="block py-3 text-2xl tracking-[-0.03em] text-ivory">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
