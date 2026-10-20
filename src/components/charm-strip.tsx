import Image from "next/image";
import { charms } from "@/lib/content";

// A slow ribbon of charms across the page. Decorative: the list is rendered
// twice so the loop is seamless, and it stops under prefers-reduced-motion.
const sample = charms.charms.filter((_, i) => i % 4 === 0);

export function CharmStrip() {
  return (
    <div aria-hidden className="overflow-hidden border-y border-line bg-surface py-4">
      <div className="motion-safe-only flex w-max animate-marquee gap-3">
        {[...sample, ...sample].map((c, i) => (
          <span key={i} className="relative block h-12 w-[58px] shrink-0">
            <Image src={`/charms/${c.id}.webp`} alt="" fill sizes="58px" unoptimized className="object-contain" />
          </span>
        ))}
      </div>
    </div>
  );
}
