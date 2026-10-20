"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { charms } from "@/lib/content";
import { Bracelet } from "./bracelet";
import { move, nextFreeSlot, parsePicks, place, serializePicks, type Picks } from "./picks";

const PARAM = "charms";
const labels = new Map(charms.charms.map((c) => [c.id, c.label]));

export function CharmBuilder() {
  const searchParams = useSearchParams();
  const [picks, setPicks] = useState<Picks>(() => parsePicks(searchParams.get(PARAM)) ?? []);
  const [category, setCategory] = useState<string | null>(null);
  // A link the visitor tapped: the next charm goes there, or, if it holds a
  // charm, the next tapped link receives it.
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const full = picks.length === charms.pickCount;
  const charmOn = (slot: number) => picks.find((p) => p.slot === slot)?.id;
  const shown = category ? charms.charms.filter((c) => c.category === category) : charms.charms;

  // Keep the URL in step with the picks, so the address bar is always a
  // shareable link to this bracelet.
  function update(next: Picks) {
    setPicks(next);
    setSelected(null);
    setHint(null);
    setCopied(false);
    const query = next.length > 0 ? `?${PARAM}=${serializePicks(next)}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
  }

  // Grid tap: remove a placed charm, or place a new one on the selected link
  // (replacing its charm) or, with no link selected, the next free front link.
  function toggle(id: string) {
    if (picks.some((p) => p.id === id)) {
      update(picks.filter((p) => p.id !== id));
    } else if (selected !== null) {
      update(place(picks, id, selected));
    } else if (full) {
      setHint(`You have ${charms.pickCount} already. Remove one, or tap a charm on the bracelet to swap it.`);
    } else {
      const slot = nextFreeSlot(picks);
      if (slot !== undefined) update(place(picks, id, slot));
    }
  }

  // Bracelet tap: select a link, deselect it, or move the selected link's
  // charm here (swapping with any charm already here).
  function tapSlot(slot: number) {
    setHint(null);
    if (selected === slot) setSelected(null);
    else if (selected !== null && charmOn(selected)) update(move(picks, selected, slot));
    else if (!charmOn(slot) && full) {
      setSelected(null);
      setHint(`You have ${charms.pickCount} already. Tap one of your charms to move it here.`);
    } else setSelected(slot);
  }

  function status() {
    if (hint) return hint;
    if (selected !== null) {
      const id = charmOn(selected);
      return id
        ? `Tap another link to move ${labels.get(id)}, or pick a charm to swap it.`
        : `Link ${selected + 1} selected: pick a charm for it.`;
    }
    if (full) return "All four on. Tap a charm on the bracelet to move it, or copy the link.";
    return `${picks.length} of ${charms.pickCount} on. Tap any link to choose where the next one goes.`;
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
    <div className="grid gap-8 lg:grid-cols-[360px_1fr] lg:items-start">
      {/* Bracelet + picks */}
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 lg:sticky lg:top-20">
        <div className="relative">
          <div aria-hidden className="absolute inset-[10%] rounded-full bg-blush blur-2xl" />
          <Bracelet
            picks={picks}
            onSlotClick={tapSlot}
            selected={selected}
            nextSlot={selected === null && !full ? nextFreeSlot(picks) : undefined}
          />
        </div>
        <ol className="flex justify-center gap-2" aria-label="Your charms, in order around the bracelet">
          {Array.from({ length: charms.pickCount }, (_, i) => {
            const id = picks[i]?.id;
            return (
              <li key={i}>
                {id ? (
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label={`Remove ${labels.get(id)}`}
                    className="relative block h-12 w-14 rounded-lg border border-line bg-paper p-1 hover:border-rose sm:h-14 sm:w-16"
                  >
                    <Image src={`/charms/${id}.webp`} alt="" fill sizes="64px" unoptimized className="object-contain p-1" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-xs text-paper">
                      &times;
                    </span>
                  </button>
                ) : (
                  <span className="block h-12 w-14 rounded-lg border border-dashed border-rose/50 sm:h-14 sm:w-16" />
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-center text-sm text-muted" aria-live="polite">
          {status()}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={copyLink}
            disabled={picks.length === 0}
            className="rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-rose-ink hover:opacity-90 disabled:opacity-40"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => update([])}
            disabled={picks.length === 0}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink disabled:opacity-40"
          >
            Start over
          </button>
        </div>
      </section>

      {/* Catalogue. min-w-0: let the chip row scroll instead of widening the grid. */}
      <section className="min-w-0">
        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2" role="group" aria-label="Filter charms">
          {[{ id: null, label: "All" }, ...charms.categories].map((c) => (
            <button
              key={c.id ?? "all"}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                category === c.id
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-5">
          {shown.map((c) => {
            const picked = picks.some((p) => p.id === c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={picked}
                  aria-label={c.label}
                  title={c.label}
                  className={`relative block aspect-[240/197] w-full rounded-lg border-2 bg-surface transition hover:-translate-y-0.5 hover:shadow-md ${
                    picked ? "border-rose bg-blush" : "border-transparent"
                  }`}
                >
                  <Image src={`/charms/${c.id}.webp`} alt="" fill sizes="(min-width: 640px) 110px, 22vw" unoptimized className="object-contain p-0.5" />
                  {picked && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose text-[10px] font-semibold text-rose-ink">
                      &#10003;
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
