import { site } from "@/config/site";
import { Wordmark } from "../Wordmark";
import { Container } from "../ui";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="pt-20 pb-10">
      <Container>
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <Wordmark size="text-[2.25rem]" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">Premium earphones, built to explore how you learn.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-ivory-soft">
            <a href={`mailto:${site.contactEmail}`} className="hover:text-ivory">
              Contact
            </a>
            <a href="/privacy" className="hover:text-ivory">
              Privacy
            </a>
            <a href="/terms" className="hover:text-ivory">
              Terms
            </a>
            {site.social.map((s) => (
              <a key={s.href} href={s.href} className="hover:text-ivory" rel="noopener noreferrer" target="_blank">
                {s.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-16 border-t border-[var(--line)] pt-8 text-xs leading-relaxed text-faint">
          <p className="max-w-3xl">
            {site.brand} is a working name. {site.product} is a concept in development: it is not available for sale, has not been shown
            to improve learning, memory or any other cognitive outcome, and has not been evaluated by any regulator. Nothing on this site is
            medical advice. Product images are concept illustrations, not photographs of a manufactured product.
          </p>
          <p className="mt-4">
            © {year} {site.legalName}
          </p>
        </div>
      </Container>
    </footer>
  );
}
