import { Container, SectionHead } from "../ui";

const moments = [
  { time: "08:10", t: "Morning review", s: "Yesterday’s lecture notes, a coffee and the playlist that gets you going." },
  { time: "10:30", t: "Exam season", s: "Flashcards and past papers, with the room quietly shut out." },
  { time: "13:45", t: "Deep work", s: "Three hours inside a hard problem. Comfortable enough to forget they’re in." },
  { time: "17:20", t: "Learning something new", s: "A dense paper, a new language, a skill you’re finally making time for." },
  { time: "22:00", t: "Just music", s: "Stimulation off. One album, start to finish. Still a pair you’ll love." },
];

export function Life() {
  return (
    <section aria-labelledby="life-title" className="section overflow-hidden">
      <Container>
        <SectionHead eyebrow="06 / Everyday" id="life-title" lines={["Fits the day", "you already have."]}>
          <p>
            No headset, no ritual, no new habit to build. The same earphones you&rsquo;d wear to study, code or listen, designed to slip
            into the routine you already have.
          </p>
        </SectionHead>
      </Container>
      <div className="mt-16">
        <ol
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] sm:scroll-px-8 sm:px-8 lg:mx-auto lg:grid lg:max-w-[1330px] lg:grid-cols-5 lg:overflow-visible lg:px-12 [&::-webkit-scrollbar]:hidden"
          aria-label="A day with the earphones"
        >
          {moments.map((m, i) => (
            <li
              key={m.time}
              className="panel flex min-h-[260px] w-[72vw] max-w-[300px] shrink-0 snap-start flex-col justify-between p-6 lg:w-auto lg:max-w-none"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm tabular-nums text-faint">{m.time}</span>
                <span className={`size-2 rounded-full ${i === 4 ? "border border-faint" : "bg-rose"}`} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-normal tracking-[-0.03em] text-ivory">{m.t}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{m.s}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
