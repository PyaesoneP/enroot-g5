import Image from "next/image";
import { charms } from "@/lib/content";
import type { Picks } from "./picks";

const labels = new Map(charms.charms.map((c) => [c.id, c.label]));

// Source images are 240 x 197 crops of a whole link (frame included).
const LINK_ASPECT = 197 / 240;
// Ring radius (link centres) as a fraction of the square's side.
const RADIUS = 0.36;

// Renders the bracelet as a ring of linkCount links seen from above. The
// charm slots sit together at the top, centred, in pick order; plain links
// fill the rest. Empty charm slots are outlined so you can see what is left.
export function Bracelet({ picks }: { picks: Picks }) {
  const n = charms.linkCount;
  const slots = charms.pickCount;
  const step = 360 / n;
  // Link width as a % of the square: the ring's circumference split n ways.
  const linkWidth = ((2 * Math.PI * RADIUS) / n) * 100;
  const linkHeight = linkWidth * LINK_ASPECT;

  const described =
    picks.length > 0
      ? `Your bracelet: ${picks.map((id) => labels.get(id)).join(", ")}`
      : "Your bracelet: plain links, no charms yet";

  return (
    <div role="img" aria-label={described} className="relative mx-auto aspect-square w-full max-w-80">
      {Array.from({ length: n }, (_, i) => {
        // Slot i's angle: charm slots 0..slots-1 straddle the top (-90deg).
        const angle = -90 + (i - (slots - 1) / 2) * step;
        const rad = (angle * Math.PI) / 180;
        const x = 50 + RADIUS * 100 * Math.cos(rad);
        const y = 50 + RADIUS * 100 * Math.sin(rad);
        const charmId = i < slots ? picks[i] : undefined;
        const emptySlot = i < slots && !charmId;
        return (
          <div
            key={i}
            className={`absolute ${emptySlot ? "rounded-sm outline-2 outline-offset-1 outline-dashed outline-zinc-400 dark:outline-zinc-500" : ""}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${linkWidth}%`,
              height: `${linkHeight}%`,
              transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
            }}
          >
            <Image
              src={charmId ? `/charms/${charmId}.webp` : "/charms/plain.webp"}
              alt=""
              fill
              sizes="48px"
              unoptimized
              className="object-contain"
            />
          </div>
        );
      })}
    </div>
  );
}
