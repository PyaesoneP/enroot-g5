import type { Metadata } from "next";
import { Suspense } from "react";
import { activeActivity } from "@/activities";
import { charms, event } from "@/lib/content";

const activity = activeActivity();

export const metadata: Metadata = {
  title: `${activity.name} - ${event.name}`,
  description: charms.intro,
};

export default function MakePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pt-10 sm:pt-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose">{event.name}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight [font-variation-settings:'SOFT'_100] sm:text-5xl">
        {activity.name}
      </h1>
      <p className="mt-3 max-w-prose text-lg leading-8 text-muted">{charms.intro}</p>
      <p className="mt-2 max-w-prose text-sm text-muted">{charms.note}</p>
      <div className="mt-8">
        {/* The module reads the URL, so it renders on the client (useSearchParams). */}
        <Suspense fallback={<p className="text-sm text-muted">Loading the charms...</p>}>
          <activity.Component />
        </Suspense>
      </div>
    </main>
  );
}
