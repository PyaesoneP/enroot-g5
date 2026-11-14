import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { moduleById } from "@/activities";
import { DeleteOwnButton } from "@/components/delete-own-button";
import { event, gallery } from "@/lib/content";
import { listMyOutputs, listOutputs, outputActivities, type SavedOutput } from "@/lib/db";
import { GUEST_COOKIE } from "@/lib/guest";
import { ownerFromCookie } from "@/lib/identity";

export const metadata: Metadata = {
  title: `${gallery.title} - ${event.name}`,
  description: gallery.intro,
};

const SHOWN = 48;
// The database clamps both lists at 200. Reaching 200 own entries takes
// 20 hours of sharing at the per-guest limit (10 / hour), so "Your
// bracelets" is complete in practice, not by construction.
const MINE_MAX = 200;
const LIST_MAX = 200;

// Renders a stored row with the module named in its own activity_id
// (ADR-005), not the live one, so a module swap leaves old entries
// readable. Rows whose module is gone, or whose payload no longer parses,
// are skipped.
function renderable(rows: SavedOutput[]) {
  return rows.flatMap((row) => {
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
}

function Cards({ cards }: { cards: ReturnType<typeof renderable> }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li
          key={card.id}
          className={`flex flex-col gap-3 rounded-3xl border p-4 [content-visibility:auto] [contain-intrinsic-size:auto_300px] ${
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
  );
}

const sectionHeading = "font-display text-2xl font-semibold [font-variation-settings:'SOFT'_100]";

// Saved outputs gallery (F-06, #16). "Your bracelets" lists the entries
// this device shared (up to 200, each with Remove); "Everyone's" is the
// newest page of everyone else's.
export default async function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  const owner = ownerFromCookie((await cookies()).get(GUEST_COOKIE)?.value);
  const requested = (await searchParams).activity;
  const activities = await outputActivities();
  const filter = typeof requested === "string" && activities.includes(requested) ? requested : null;
  const mine = await listMyOutputs(owner, MINE_MAX);
  // Own rows are shown in their own section, so fetch enough to still fill
  // a page of other people's after dropping them (PR #42 re-review).
  const rows = await listOutputs(owner, filter, Math.min(LIST_MAX, SHOWN + (mine?.length ?? 0)));

  const myCards = renderable(mine ?? []);
  // If the own list failed (null), keep own rows in the main grid, where
  // they still carry Remove, instead of hiding them everywhere.
  const others = (rows ?? []).filter((r) => mine === null || !r.mine).slice(0, SHOWN);
  const cards = renderable(others);

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

      {myCards.length > 0 && (
        <section aria-labelledby="mine-heading" className="mt-10">
          <h2 id="mine-heading" className={sectionHeading}>
            Your bracelets
          </h2>
          <p className="mt-1 text-sm text-muted">Shared from this device. Remove any of them here.</p>
          <div className="mt-4">
            <Cards cards={myCards} />
          </div>
        </section>
      )}

      <section aria-labelledby="all-heading" className="mt-10">
        <h2 id="all-heading" className={myCards.length > 0 ? sectionHeading : "sr-only"}>
          Everyone&apos;s
        </h2>
        {activities.length > 1 && (
          <nav aria-label="Filter by activity" className="-mx-6 mt-4 flex gap-2 overflow-x-auto px-6">
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
        <div className="mt-4">
          {rows === null ? (
            <p className="text-sm text-muted" role="alert">
              {gallery.unavailable}
            </p>
          ) : cards.length === 0 ? (
            <p className="text-sm text-muted">{myCards.length > 0 ? "No one else has shared yet." : gallery.empty}</p>
          ) : (
            <Cards cards={cards} />
          )}
          {others.length === SHOWN && (
            <p className="mt-4 text-xs text-muted">Showing the newest {SHOWN}.</p>
          )}
        </div>
      </section>
    </main>
  );
}
