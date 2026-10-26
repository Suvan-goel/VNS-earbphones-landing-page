import { getFaqGroups } from "@/config/faq";
import { Container, Headline } from "../ui";

const answerLinkClass = "text-ivory underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-ivory";

export function Faq({ reservations = false }: { reservations?: boolean }) {
  const faqGroups = getFaqGroups(reservations);
  return (
    <section id="faq" aria-labelledby="faq-title" className="section scroll-mt-20">
      <Container className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:sticky lg:top-28 lg:col-span-4">
          <Headline id="faq-title" lines={["FAQ"]} className="reveal text-[clamp(2.25rem,3.4vw,3rem)]" />
        </div>
        <div className="min-w-0 space-y-9 lg:col-span-8">
          {faqGroups.map((group) => (
            <section key={group.id} aria-labelledby={`faq-group-${group.id}`}>
              <h3 id={`faq-group-${group.id}`} className="mb-3 px-1 text-sm font-medium text-ivory-soft">
                {group.title}
              </h3>
              <div className="space-y-3">
                {group.items.map((f) => (
                  <details key={f.id} id={`faq-${f.id}`} data-faq={f.id} className="group panel scroll-mt-24 !rounded-[22px] px-5 transition-colors open:bg-surface sm:px-7">
                    <summary className="flex cursor-pointer items-center justify-between gap-5 py-5 text-left text-[1.0625rem] font-normal leading-snug tracking-[-0.02em] text-ivory transition-colors hover:text-ivory-soft sm:text-lg">
                      {f.q}
                      <span className="faq-icon relative size-4 shrink-0 text-rose transition-transform duration-500 ease-out-expo" aria-hidden="true">
                        <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
                        <span className="absolute left-1/2 top-0 h-4 w-px bg-current" />
                      </span>
                    </summary>
                    <div className="faq-body">
                      <div className="overflow-hidden">
                        <div className="max-w-2xl pb-6">
                          <p className="leading-relaxed text-muted">{f.a}</p>
                          {f.links && (
                            <div className="mt-4 text-sm leading-relaxed">
                              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                                {f.links.map((link) => (
                                  <li key={link.href}>
                                    <a
                                      href={link.href}
                                      className={answerLinkClass}
                                    >
                                      {link.label}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </section>
  );
}
