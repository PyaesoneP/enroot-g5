import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { moduleById } from "@/activities";
import { DeleteOwnButton } from "@/components/delete-own-button";
import { event, gallery } from "@/lib/content";
import { listOutputs, outputActivities } from "@/lib/db";
import { GUEST_COOKIE } from "@/lib/guest";
import { ownerFromCookie } from "@/lib/identity";

export const metadata: Metadata = {
  title: `${gallery.title} - ${event.name}`,
  description: gallery.intro,
};

const SHOWN = 48;

// Saved outputs gallery (F-06, #16). Each entry renders through the module
// named in its own activity_id (ADR-005), not the live one, so a module
// swap leaves old entries readable. Rows whose module is gone, or whose
// payload no longer parses, are skipped.
export default async function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  const owner = ownerFromCookie((await cookies()).get(GUEST_COOKIE)?.value);
  const requested = (await searchParams).activity;
  const activities = await outputActivities();
  const filter = typeof requested === "string" && activities.includes(requested) ? requested : null;
  const rows = await listOutputs(owner, filter, SHOWN);

  const cards = (rows ?? []).flatMap((row) => {
    const mod = moduleById(row.activityId);
    const preview = mod?.preview(row.payload);
    if (!preview) {
      console.warn(
        `[gallery] skipped ${row.id}: ${mod ? "payload does not parse" : "no module"} for "${row.activityId}"`,
      );
      return [];
    }
    return [{ ...row, preview }];
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pt-10 sm:pt-16">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose">{event.name}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight [font-variation-settings:'SOFT'_100] sm:text-5xl">
        {gallery.title}
      </h1>
      <p className="mt-3 max-w-prose text-lg leading-8 text-muted">{gallery.intro}</p>
      <div className="mt-5">
        <Link
          href="/make"
          className="inline-flex items-center rounded-full bg-rose px-5 py-3 text-sm font-semibold text-rose-ink shadow-sm hover:opacity-90"
        >
          Make your bracelet
        </Link>
      </div>

      {activities.length > 1 && (
        <nav aria-label="Filter by activity" className="-mx-6 mt-8 flex gap-2 overflow-x-auto px-6">
          {[null, ...activities].map((id) => (
            <Link
              key={id ?? "all"}
              href={id ? `/gallery?activity=${encodeURIComponent(id)}` : "/gallery"}
              aria-current={filter === id ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                filter === id ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {id ? (moduleById(id)?.name ?? id) : "All"}
            </Link>
          ))}
        </nav>
      )}

      <section aria-label="Shared bracelets" className="mt-8">
        {rows === null ? (
          <p className="text-sm text-muted" role="alert">
            {gallery.unavailable}
          </p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted">{gallery.empty}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <li
                key={card.id}
                className={`flex flex-col gap-3 rounded-3xl border p-4 [content-visibility:auto] [contain-intrinsic-size:auto_260px] ${
                  card.mine ? "border-rose/60 bg-blush/40" : "border-line bg-surface"
                }`}
              >
                {card.preview}
                {card.mine && (
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="font-semibold text-rose">Yours</span>
                    <DeleteOwnButton
                      endpoint={`/api/outputs?id=${encodeURIComponent(card.id)}`}
                      confirmText={gallery.removeConfirm}
                      label="Remove"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
