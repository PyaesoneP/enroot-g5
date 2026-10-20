"use client";

import Image from "next/image";
import { useState } from "react";
import { charms } from "@/lib/content";
import type { Picks } from "./picks";

const labels = new Map(charms.charms.map((c) => [c.id, c.label]));

// Geometry, in cqw (percent of the bracelet's own width). The links sit on a
// vertical band of radius R, each facing outward, so n links of width W
// close the loop: W = 2 R tan(180deg / n).
const N = charms.linkCount;
const STEP = 360 / N;
const R = 40;
const W = 2 * R * Math.tan(Math.PI / N);
// Source images are 240 x 197 crops of a whole link (frame included).
const H = (W * 197) / 240;
// Camera slightly above the bracelet, as in a product photo.
const TILT = -16;

// Slot i's angle around the band; 0deg faces the viewer. Slots
// 0..pickCount-1 are the front group, left to right.
const slotAngle = (i: number) => (i - (charms.pickCount - 1) / 2) * STEP;

type Props = {
  picks: Picks;
  // Accessible name prefix, e.g. "Your bracelet" or "A sample bracelet".
  label?: string;
  // Sway gently side to side (decorative use, e.g. the landing hero).
  spin?: boolean;
  // Interactive mode: each link becomes a button, and tapping one turns the
  // bracelet to bring it to the front.
  onSlotClick?: (slot: number) => void;
  selected?: number | null;
  // Outlined as "the next charm goes here".
  nextSlot?: number;
};

// A 3D view of the bracelet: links around a band, tilted towards the viewer.
// Front faces show the charm or plain link; the inside of the band shows
// plain steel, like the back of a real link.
export function Bracelet({ picks, label = "Your bracelet", spin = false, onSlotClick, selected = null, nextSlot }: Props) {
  // Current turn of the band, in degrees. Kept unbounded so turning always
  // takes the short way round.
  const [turn, setTurn] = useState(0);
  const onSlot = new Map(picks.map((p) => [p.slot, p.id]));

  function bringToFront(slot: number) {
    const target = -slotAngle(slot);
    const delta = ((((target - turn) % 360) + 540) % 360) - 180;
    setTurn(turn + delta);
  }

  const described =
    picks.length > 0
      ? `${label}: ${picks.map((p) => `${labels.get(p.id)} on link ${p.slot + 1}`).join(", ")}`
      : `${label}: plain links, no charms yet`;

  return (
    <div className="relative mx-auto w-full max-w-96">
      <div
        role={onSlotClick ? "group" : "img"}
        aria-label={described}
        className="relative aspect-[2/1] w-full [container-type:inline-size]"
        style={{ perspective: "220cqw" }}
      >
        <div
          className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]"
          style={{ transform: `rotateX(${TILT}deg)` }}
        >
          <div
            className={`[transform-style:preserve-3d] ${
              spin ? "motion-safe-only animate-sway" : "transition-transform duration-500 ease-out"
            }`}
            style={spin ? undefined : { transform: `rotateY(${turn}deg)` }}
          >
            {Array.from({ length: N }, (_, i) => {
              const charmId = onSlot.get(i);
              const ring =
                selected === i
                  ? "outline-2 outline-offset-1 outline-rose"
                  : nextSlot === i
                    ? "outline-2 outline-offset-1 outline-dashed outline-rose/70"
                    : "";
              const style = {
                width: `${W}cqw`,
                height: `${H}cqw`,
                marginLeft: `${-W / 2}cqw`,
                marginTop: `${-H / 2}cqw`,
                transform: `rotateY(${slotAngle(i)}deg) translateZ(${R}cqw)`,
              };
              const faces = (
                <>
                  <span className={`absolute inset-0 rounded-[2px] [backface-visibility:hidden] ${ring}`}>
                    <Image
                      src={charmId ? `/charms/${charmId}.webp` : "/charms/plain.webp"}
                      alt=""
                      fill
                      sizes="64px"
                      unoptimized
                      className="object-contain"
                    />
                  </span>
                  {/* Inside of the band: plain steel, a little darker. */}
                  <span className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <Image src="/charms/plain.webp" alt="" fill sizes="64px" unoptimized className="object-contain brightness-75" />
                  </span>
                </>
              );
              return onSlotClick ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    bringToFront(i);
                    onSlotClick(i);
                  }}
                  aria-pressed={selected === i}
                  aria-label={`Link ${i + 1} of ${N}: ${charmId ? labels.get(charmId) : "plain"}`}
                  className="absolute [transform-style:preserve-3d]"
                  style={style}
                >
                  {faces}
                </button>
              ) : (
                <div key={i} className="absolute [transform-style:preserve-3d]" style={style}>
                  {faces}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {onSlotClick && (
        <div className="mt-2 flex justify-center gap-2">
          {[
            { label: "Turn the bracelet left", by: STEP * 3, glyph: "◀" },
            { label: "Turn the bracelet right", by: -STEP * 3, glyph: "▶" },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setTurn(turn + b.by)}
              aria-label={b.label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-xs text-muted hover:border-ink hover:text-ink"
            >
              {b.glyph}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
