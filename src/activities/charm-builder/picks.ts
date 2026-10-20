import { charms } from "@/lib/content";

// A bracelet is an ordered list of charm ids, front of the bracelet first.
export type Picks = string[];

const known = new Set(charms.charms.map((c) => c.id));

// "c12,c40,c07" -> ["c12", "c40", "c07"]. Unknown ids and duplicates are
// dropped and the list is capped at pickCount, so a hand-edited or stale link
// still renders something sensible.
export function parsePicks(input: string | null): Picks | null {
  if (!input) return null;
  const picks: Picks = [];
  for (const id of input.split(",")) {
    if (known.has(id) && !picks.includes(id)) picks.push(id);
    if (picks.length === charms.pickCount) break;
  }
  return picks.length > 0 ? picks : null;
}

export function serializePicks(picks: Picks): string {
  return picks.join(",");
}
