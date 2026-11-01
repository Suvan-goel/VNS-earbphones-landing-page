import { site } from "@/config/site";
import { Wordmark } from "../Wordmark";
import { Container } from "../ui";

const links = [
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/* One line of footer: wordmark, links, copyright. Small print beneath, in small print. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-studio text-ivory-soft">
      <Container className="py-8">
        <div className="flex flex-col gap-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <Wordmark size="text-[0.9375rem]" />
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((l) => (
              <a key={l.label} href={l.href} className="hover:text-ivory">
                {l.label}
              </a>
            ))}
            {site.social.map((s) => (
              <a key={s.href} href={s.href} className="hover:text-ivory" rel="noopener noreferrer" target="_blank">
                {s.label}
              </a>
            ))}
            <span>© {year} {site.legalName}</span>
          </nav>
        </div>
        <p className="mt-5 max-w-[60rem] text-[0.6875rem] leading-relaxed">
          {site.product} is in development and is not yet shipping. It is not intended to diagnose, treat, cure or prevent disease.
          Benefits for learning or memory have not been independently demonstrated for the finished product.
        </p>
      </Container>
    </footer>
  );
}
