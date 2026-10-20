import Link from "next/link";
import { Bracelet } from "@/activities/charm-builder/bracelet";
import { placeAtDefaults } from "@/activities/charm-builder/picks";
import { CharmStrip } from "@/components/charm-strip";
import { charms, event } from "@/lib/content";

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-5xl items-center gap-10 px-6 pt-10 pb-12 sm:pt-16 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose">
            {event.theme} &middot; {event.cohort}
          </p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.02] tracking-tight [font-variation-settings:'SOFT'_100] sm:text-6xl">
            {event.name}
          </h1>
          <p className="mt-4 max-w-prose text-lg leading-8 text-muted">{event.summary}</p>

          {/* Key facts: above the fold on a 360 px phone (SRS F-01) */}
          <dl className="mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-5 gap-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
            {[
              { term: "When", value: `${event.dateLabel}, ${event.timeLabel}` },
              { term: "Where", value: event.venue },
            ].map((fact) => (
              <div key={fact.term} className="contents">
                <dt className="font-semibold text-rose">{fact.term}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/make"
              className="inline-flex items-center rounded-full bg-rose px-5 py-3 text-sm font-semibold text-rose-ink shadow-sm hover:opacity-90"
            >
              Make your bracelet
            </Link>
            <Link
              href="/activity"
              className="inline-flex items-center rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold hover:border-ink"
            >
              How it works
            </Link>
          </div>
          <p className="mt-4 max-w-prose text-sm text-muted">{event.status}</p>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div aria-hidden className="absolute inset-[8%] rounded-full bg-blush blur-2xl" />
          <Bracelet picks={placeAtDefaults(charms.heroCharms)} spin label="A sample bracelet" />
        </div>
      </section>

      <CharmStrip />

      {/* Timeline */}
      <section className="mx-auto w-full max-w-5xl px-6 pt-14">
        <h2 className="font-display text-2xl font-semibold [font-variation-settings:'SOFT'_100]">
          Road to 19 November
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {event.timeline.map((step, i) => (
            <li
              key={i}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${
                step.done ? "border-line bg-surface" : "border-dashed border-line"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done ? "bg-rose text-rose-ink" : "border border-line text-muted"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="text-sm text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
