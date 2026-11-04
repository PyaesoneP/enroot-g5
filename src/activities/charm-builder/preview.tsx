import Image from "next/image";
import { charms } from "@/lib/content";
import { Bracelet } from "./bracelet";
import { vibeOf, type Picks } from "./picks";

const labels = new Map(charms.charms.map((c) => [c.id, c.label]));

// A gallery card's bracelet (#16): the 3D view turned so the charms face
// front, the four charms flat in link order (charms on opposite sides of
// the band can't all face front at once, so the row is what guarantees
// all four are visible), and the vibe.
export function CharmBuilderPreview({ output }: { output: Picks }) {
  const vibe = vibeOf(output);
  return (
    <div className="flex flex-col items-center gap-2">
      <Bracelet picks={output} label="A shared bracelet" faceCharms />
      <ol className="flex justify-center gap-1.5" aria-label="Its charms, in order around the bracelet">
        {output.map((p) => (
          <li key={p.slot} className="relative block h-9 w-11" title={`${labels.get(p.id)} (link ${p.slot + 1})`}>
            <Image src={`/charms/${p.id}.webp`} alt={labels.get(p.id) ?? ""} fill sizes="44px" unoptimized className="object-contain" />
          </li>
        ))}
      </ol>
      {vibe && (
        <p className="rounded-full bg-blush px-3 py-0.5 text-xs font-semibold">
          {vibe.label}
          <span className="sr-only"> vibe</span>
        </p>
      )}
    </div>
  );
}

export const shareablePicks = (picks: Picks) => picks.length === charms.pickCount && vibeOf(picks) !== undefined;
