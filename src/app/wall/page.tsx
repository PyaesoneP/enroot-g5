import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/auto-refresh";
import { DeleteOwnButton } from "@/components/delete-own-button";
import { WallForm } from "@/components/wall-form";
import { event, wall } from "@/lib/content";
import { listWall, wallOpen } from "@/lib/db";
import { GUEST_COOKIE } from "@/lib/guest";
import { ownerFromCookie } from "@/lib/identity";

export const metadata: Metadata = {
  title: `${wall.title} - ${event.name}`,
  description: wall.intro,
};

const SHOWN = 100;
const REFRESH_SEC = 30;

const when = new Intl.DateTimeFormat("en-SG", {
  timeZone: "Asia/Singapore",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

// Friendship wall (F-04, #14). Rendered per request: the list is live, and
// the guest cookie decides which posts get a Delete button. Text is rendered
// by React (escaped), never as HTML (ADR-009).
export default async function WallPage() {
  const owner = ownerFromCookie((await cookies()).get(GUEST_COOKIE)?.value);
  const [posts, open] = await Promise.all([listWall(owner, SHOWN), wallOpen()]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pt-10 sm:pt-16">
      <AutoRefresh seconds={REFRESH_SEC} />
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose">{event.name}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight [font-variation-settings:'SOFT'_100] sm:text-5xl">
        {wall.title}
      </h1>
      <p className="mt-3 max-w-prose text-lg leading-8 text-muted">{wall.intro}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
        <section aria-label="Write a post" className="rounded-3xl border border-line bg-surface p-5 lg:sticky lg:top-20">
          {open === false ? <p className="text-sm text-muted">{wall.closed}</p> : <WallForm />}
        </section>

        <section aria-label="Posts" className="min-w-0">
          {posts === null ? (
            <p className="text-sm text-muted" role="alert">
              {wall.unavailable}
            </p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted">{wall.empty}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 ${
                    post.mine ? "border-rose/60 bg-blush/40" : "border-line bg-surface"
                  }`}
                >
                  <p className="whitespace-pre-line break-words leading-7">{post.body}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span className="min-w-0 break-words">
                      <span className="font-semibold text-ink">{post.name ?? wall.anonymous}</span>
                      {" · "}
                      <time dateTime={post.createdAt}>{when.format(new Date(post.createdAt))}</time>
                      {post.mine && <span className="ml-1 font-semibold text-rose">(you)</span>}
                    </span>
                    {post.mine && (
                      <DeleteOwnButton
                        endpoint={`/api/wall?id=${encodeURIComponent(post.id)}`}
                        confirmText={wall.deleteConfirm}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {posts !== null && posts.length === SHOWN && (
            <p className="mt-4 text-xs text-muted">Showing the newest {SHOWN} posts.</p>
          )}
        </section>
      </div>
    </main>
  );
}
