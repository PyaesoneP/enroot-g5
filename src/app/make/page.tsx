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
    <main className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10 sm:py-16">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{activity.name}</h1>
      <p className="mt-3 max-w-prose text-base leading-7 text-zinc-600 dark:text-zinc-400">
        {charms.intro}
      </p>
      <p className="mt-2 max-w-prose text-sm text-zinc-500 dark:text-zinc-400">{charms.note}</p>
      <div className="mt-8">
        {/* The module reads the URL, so it renders on the client (useSearchParams). */}
        <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Loading the charms...</p>}>
          <activity.Component />
        </Suspense>
      </div>
    </main>
  );
}
