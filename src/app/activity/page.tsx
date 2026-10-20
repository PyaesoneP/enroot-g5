import type { Metadata } from "next";
import { activity, event } from "@/lib/content";

export const metadata: Metadata = {
  title: `How it works - ${event.name}`,
  description: `${activity.tagline} ${event.dateLabel}, ${event.timeLabel}, ${event.venue}.`,
};

const sectionHeading =
  "text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export default function ActivityPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10 sm:py-16">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {event.dateLabel}, {event.timeLabel} - {event.venue}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
        {activity.name}
      </h1>
      <p className="mt-3 max-w-prose text-base leading-7 text-zinc-600 dark:text-zinc-400">
        {activity.tagline}
      </p>

      {/* How it works */}
      <section className="mt-10">
        <h2 className={sectionHeading}>How it works</h2>
        <ol className="mt-4 space-y-4">
          {activity.howItWorks.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {i + 1}
              </span>
              <p className="text-sm leading-6">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {activity.pairingRule}
        </p>
      </section>

      {/* Materials */}
      <section className="mt-10">
        <h2 className={sectionHeading}>What you get</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 marker:text-zinc-400">
          {activity.materials.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      {/* Schedule */}
      <section className="mt-10">
        <h2 className={sectionHeading}>Schedule</h2>
        <dl className="mt-4 space-y-3">
          {event.schedule.map((item, i) => (
            <div key={i} className="sm:flex sm:gap-6">
              <dt className="text-sm font-medium sm:w-40 sm:shrink-0">{item.time}</dt>
              <dd className="text-sm text-zinc-500 dark:text-zinc-400">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
