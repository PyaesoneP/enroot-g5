import { charms, type Vibe } from "@/lib/content";

// A charm on a given link of the bracelet. Slots run 0..linkCount-1 around
// the ring; slots 0..pickCount-1 are the front, centred at the top.
export type Placement = { id: string; slot: number };
// Sorted by slot.
export type Picks = Placement[];

const known = new Set(charms.charms.map((c) => c.id));
const n = charms.linkCount;
const front = (charms.pickCount - 1) / 2;

// Where charms go when the visitor has not chosen a link: the front slots in
// order, then outward from the front, alternating sides.
const defaultSlots = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
  const inFront = (s: number) => s < charms.pickCount;
  if (inFront(a) !== inFront(b)) return inFront(a) ? -1 : 1;
  if (inFront(a)) return a - b;
  const dist = (s: number) => Math.min(Math.abs(s - front), n - Math.abs(s - front));
  return dist(a) - dist(b) || a - b;
});

export function nextFreeSlot(picks: Picks): number | undefined {
  return defaultSlots.find((s) => !picks.some((p) => p.slot === s));
}

const bySlot = (a: Placement, b: Placement) => a.slot - b.slot;

// Puts ids on the default slots, e.g. the landing page's sample bracelet.
export function placeAtDefaults(ids: string[]): Picks {
  return ids.slice(0, charms.pickCount).map((id, i) => ({ id, slot: defaultSlots[i] }));
}

// "c44@0,c30@1,c58@9" -> placements. An entry without "@slot" (older links)
// takes the next default slot. Unknown ids, bad or taken slots, and repeats
// are dropped, and the list is capped at pickCount, so a hand-edited or stale
// link still renders something sensible.
export function parsePicks(input: string | null): Picks | null {
  if (!input) return null;
  const picks: Picks = [];
  const unplaced: string[] = [];
  for (const entry of input.split(",")) {
    const [id, slotText] = entry.split("@");
    if (!known.has(id) || picks.some((p) => p.id === id) || unplaced.includes(id)) continue;
    if (slotText === undefined) {
      unplaced.push(id);
      continue;
    }
    const slot = Number(slotText);
    if (Number.isInteger(slot) && slot >= 0 && slot < n && !picks.some((p) => p.slot === slot)) {
      picks.push({ id, slot });
    }
  }
  for (const id of unplaced) {
    const slot = nextFreeSlot(picks);
    if (slot !== undefined) picks.push({ id, slot });
  }
  const result = picks.slice(0, charms.pickCount).sort(bySlot);
  return result.length > 0 ? result : null;
}

export function serializePicks(picks: Picks): string {
  return picks.map((p) => `${p.id}@${p.slot}`).join(",");
}

// Put a charm on a slot, replacing whatever charm was there.
export function place(picks: Picks, id: string, slot: number): Picks {
  return [...picks.filter((p) => p.slot !== slot && p.id !== id), { id, slot }].sort(bySlot);
}

// Move the charm on `from` to `to`; a charm already on `to` swaps over.
export function move(picks: Picks, from: number, to: number): Picks {
  return picks
    .map((p) => (p.slot === from ? { ...p, slot: to } : p.slot === to ? { ...p, slot: from } : p))
    .sort(bySlot);
}

const vibeOfCategory = new Map(charms.vibes.flatMap((v) => v.categories.map((c) => [c, v] as const)));
const categoryOf = new Map(charms.charms.map((c) => [c.id, c.category]));
const fromFront = (slot: number) => Math.min(Math.abs(slot - front), n - Math.abs(slot - front));

// The pairing group for a finished bracelet: the vibe most of its charms
// belong to. On a tie, the tied vibe with a charm nearest the front wins.
// Undefined until all pickCount charms are on.
export function vibeOf(picks: Picks): Vibe | undefined {
  if (picks.length < charms.pickCount) return undefined;
  const tally = new Map<Vibe, { count: number; nearest: number }>();
  for (const p of picks) {
    const vibe = vibeOfCategory.get(categoryOf.get(p.id) ?? "");
    if (!vibe) continue;
    const t = tally.get(vibe) ?? { count: 0, nearest: Infinity };
    tally.set(vibe, { count: t.count + 1, nearest: Math.min(t.nearest, fromFront(p.slot)) });
  }
  let best: Vibe | undefined;
  for (const [vibe, t] of tally) {
    const b = best && tally.get(best)!;
    if (!b || t.count > b.count || (t.count === b.count && t.nearest < b.nearest)) best = vibe;
  }
  return best;
}
