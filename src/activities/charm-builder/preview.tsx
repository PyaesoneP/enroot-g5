import { charms } from "@/lib/content";
import { Bracelet } from "./bracelet";
import { vibeOf, type Picks } from "./picks";

// A gallery card's bracelet (#16): the static 3D view plus its vibe.
export function CharmBuilderPreview({ output }: { output: Picks }) {
  const vibe = vibeOf(output);
  return (
    <div className="flex flex-col items-center gap-2">
      <Bracelet picks={output} label="A shared bracelet" />
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
