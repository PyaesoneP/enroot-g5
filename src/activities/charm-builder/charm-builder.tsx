"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { charms } from "@/lib/content";
import { Bracelet } from "./bracelet";
import { parsePicks, serializePicks, type Picks } from "./picks";

const PARAM = "charms";
const labels = new Map(charms.charms.map((c) => [c.id, c.label]));

export function CharmBuilder() {
  const searchParams = useSearchParams();
  const [picks, setPicks] = useState<Picks>(() => parsePicks(searchParams.get(PARAM)) ?? []);
  const [category, setCategory] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const full = picks.length === charms.pickCount;
  const shown = category ? charms.charms.filter((c) => c.category === category) : charms.charms;

  // Keep the URL in step with the picks, so the address bar is always a
  // shareable link to this bracelet.
  function update(next: Picks) {
    setPicks(next);
    setCopied(false);
    const query = next.length > 0 ? `?${PARAM}=${serializePicks(next)}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }

  function toggle(id: string) {
    if (picks.includes(id)) {
      setHint(null);
      update(picks.filter((p) => p !== id));
    } else if (full) {
      setHint(`You have ${charms.pickCount} already. Tap one of your picks to swap it out.`);
    } else {
      setHint(null);
      update([...picks, id]);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setHint("Could not copy. The address bar has your link.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Bracelet + picks */}
      <section className="flex flex-col gap-4">
        <Bracelet picks={picks} />
        <ol className="flex justify-center gap-2" aria-label="Your picks, front of the bracelet first">
          {Array.from({ length: charms.pickCount }, (_, i) => {
            const id = picks[i];
            return (
              <li key={i}>
                {id ? (
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${labels.get(id)}`}
                    className="relative block h-14 w-16 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <Image src={`/charms/${id}.webp`} alt="" fill sizes="64px" unoptimized className="object-contain p-1" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                      &times;
                    </span>
                  </button>
                ) : (
                  <span className="block h-14 w-16 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700" />
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {hint ?? (full ? "All four picked. Copy the link to keep it." : `${picks.length} of ${charms.pickCount} picked`)}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={copyLink}
            disabled={picks.length === 0}
            className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => {
              setHint(null);
              update([]);
            }}
            disabled={picks.length === 0}
            className="rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Start over
          </button>
        </div>
      </section>

      {/* Catalogue */}
      <section>
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2" role="group" aria-label="Filter charms">
          {[{ id: null, label: "All" }, ...charms.categories].map((c) => (
            <button
              key={c.id ?? "all"}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                category === c.id
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {shown.map((c) => {
            const order = picks.indexOf(c.id);
            const picked = order >= 0;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={picked}
                  aria-label={c.label}
                  title={c.label}
                  className={`relative block aspect-[240/197] w-full rounded-md border-2 bg-white dark:bg-zinc-900 ${
                    picked ? "border-zinc-900 dark:border-zinc-100" : "border-transparent"
                  }`}
                >
                  <Image src={`/charms/${c.id}.webp`} alt="" fill sizes="(min-width: 640px) 110px, 22vw" unoptimized className="object-contain p-0.5" />
                  {picked && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {order + 1}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
