import Link from "next/link";
import { event } from "@/lib/content";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10 sm:py-16">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
        {event.name}
      </h1>
      <p className="mt-3 max-w-prose text-base leading-7 text-zinc-600 dark:text-zinc-400">
        {event.summary}
      </p>

      {/* Key facts: above the fold on a 360 px phone (SRS F-01) */}
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {[
          { term: "When", value: `${event.dateLabel}, ${event.timeLabel}` },
          { term: "Where", value: event.venue },
          { term: "Theme", value: event.theme },
        ].map((fact) => (
          <div key={fact.term} className="contents">
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">{fact.term}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <Link
          href="/activity"
          className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          How it works
        </Link>
      </div>
      <p className="mt-4 max-w-prose text-sm text-zinc-500 dark:text-zinc-400">
        {event.status}
      </p>

      {/* Timeline */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Timeline
        </h2>
        <ol className="mt-4 space-y-4">
          {event.timeline.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  step.done
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer note */}
      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Built with Next.js + Tailwind. Deployed on Vercel. The full event site
        is in progress.
      </footer>
    </main>
  );
}