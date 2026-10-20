import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { activity, charms, event } from "@/lib/content";

export const metadata: Metadata = {
  title: `How it works - ${event.name}`,
  description: `${activity.tagline} ${event.dateLabel}, ${event.timeLabel}, ${event.venue}.`,
};

const sectionHeading = "font-display text-2xl font-semibold [font-variation-settings:'SOFT'_100]";

export default function ActivityPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pt-10 sm:pt-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose">How it works</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight [font-variation-settings:'SOFT'_100] sm:text-5xl">
        {activity.name}
      </h1>
      <p className="mt-3 max-w-prose text-lg leading-8 text-muted">{activity.tagline}</p>
      <p className="mt-2 text-sm font-medium">
        {event.dateLabel}, {event.timeLabel} &middot; {event.venue}
      </p>

      {/* How it works */}
      <section className="mt-12">
        <ol className="grid gap-4 sm:grid-cols-2">
          {activity.howItWorks.map((step, i) => (
            <li key={i} className="rounded-2xl border border-line bg-surface p-5">
              <span className="font-display text-4xl font-semibold text-rose [font-variation-settings:'SOFT'_100]">
                {i + 1}
              </span>
              <p className="mt-2 leading-7">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">{activity.pairingRule}</p>
      </section>

      {/* Vibes: the pairing groups */}
      <section className="mt-12">
        <h2 className={sectionHeading}>Four vibes, four tables</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {charms.vibes.map((vibe) => (
            <li key={vibe.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex gap-1.5" aria-hidden>
                {charms.charms
                  .filter((c) => vibe.categories.includes(c.category))
                  .slice(0, 3)
                  .map((c) => (
                    <span key={c.id} className="relative block h-9 w-11">
                      <Image src={`/charms/${c.id}.webp`} alt="" fill sizes="44px" unoptimized className="object-contain" />
                    </span>
                  ))}
              </div>
              <p className="mt-3 font-display text-xl font-semibold [font-variation-settings:'SOFT'_100]">{vibe.label}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{vibe.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Materials + schedule */}
      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className={sectionHeading}>What you get</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {activity.materials.map((item, i) => (
              <li key={i} className="rounded-full bg-blush px-4 py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className={sectionHeading}>Schedule</h2>
          <dl className="mt-4 space-y-3">
            {event.schedule.map((item, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4">
                <dt className="text-sm font-semibold text-rose">{item.time}</dt>
                <dd className="mt-1 text-sm">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="mt-12 rounded-3xl bg-blush p-6 sm:flex sm:items-center sm:justify-between sm:p-8">
        <p className="font-display text-xl font-semibold [font-variation-settings:'SOFT'_100]">
          Not sure which charms are you?
        </p>
        <Link
          href="/make"
          className="mt-4 inline-flex rounded-full bg-rose px-5 py-3 text-sm font-semibold text-rose-ink hover:opacity-90 sm:mt-0"
        >
          Try them on first
        </Link>
      </div>
    </main>
  );
}
