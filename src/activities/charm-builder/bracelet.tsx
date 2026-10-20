import Image from "next/image";
import { charms } from "@/lib/content";
import type { Picks } from "./picks";

const labels = new Map(charms.charms.map((c) => [c.id, c.label]));

// Source images are 240 x 197 crops of a whole link (frame included).
const LINK_ASPECT = 197 / 240;
// Ring radius (link centres) as a fraction of the square's side.
const RADIUS = 0.36;

type Props = {
  picks: Picks;
  // Accessible name prefix, e.g. "Your bracelet" or "A sample bracelet".
  label?: string;
  // Turn slowly (decorative use, e.g. the landing hero).
  spin?: boolean;
  // Interactive mode: each link becomes a button.
  onSlotClick?: (slot: number) => void;
  selected?: number | null;
  // Outlined as "the next charm goes here".
  nextSlot?: number;
};

// Renders the bracelet as a ring of linkCount links seen from above. Slot 0
// starts the front group (centred at the top); charms sit on their slots and
// plain links fill the rest.
export function Bracelet({ picks, label = "Your bracelet", spin = false, onSlotClick, selected = null, nextSlot }: Props) {
  const n = charms.linkCount;
  const step = 360 / n;
  // Link width as a % of the square: the ring's circumference split n ways.
  const linkWidth = ((2 * Math.PI * RADIUS) / n) * 100;
  const linkHeight = linkWidth * LINK_ASPECT;
  const onSlot = new Map(picks.map((p) => [p.slot, p.id]));

  const described =
    picks.length > 0
      ? `${label}: ${picks.map((p) => `${labels.get(p.id)} on link ${p.slot + 1}`).join(", ")}`
      : `${label}: plain links, no charms yet`;

  return (
    <div
      role={onSlotClick ? "group" : "img"}
      aria-label={described}
      className={`relative mx-auto aspect-square w-full max-w-80 ${spin ? "motion-safe-only animate-spin-slow" : ""}`}
    >
      {Array.from({ length: n }, (_, i) => {
        const angle = -90 + (i - (charms.pickCount - 1) / 2) * step;
        const rad = (angle * Math.PI) / 180;
        const charmId = onSlot.get(i);
        const ring =
          selected === i
            ? "z-10 scale-110 outline-2 outline-offset-1 outline-rose"
            : nextSlot === i
              ? "outline-2 outline-offset-1 outline-dashed outline-rose/60"
              : "";
        const style = {
          left: `${50 + RADIUS * 100 * Math.cos(rad)}%`,
          top: `${50 + RADIUS * 100 * Math.sin(rad)}%`,
          width: `${linkWidth}%`,
          height: `${linkHeight}%`,
          transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
        };
        const image = (
          <Image
            src={charmId ? `/charms/${charmId}.webp` : "/charms/plain.webp"}
            alt=""
            fill
            sizes="48px"
            unoptimized
            className="object-contain drop-shadow-[0_2px_2px_rgba(60,30,40,0.25)]"
          />
        );
        return onSlotClick ? (
          <button
            key={i}
            type="button"
            onClick={() => onSlotClick(i)}
            aria-pressed={selected === i}
            aria-label={`Link ${i + 1} of ${n}: ${charmId ? labels.get(charmId) : "plain"}`}
            className={`absolute rounded-sm transition-[scale] hover:outline-2 hover:outline-rose/40 ${ring}`}
            style={style}
          >
            {image}
          </button>
        ) : (
          <div key={i} className="absolute" style={style}>
            {image}
          </div>
        );
      })}
    </div>
  );
}
