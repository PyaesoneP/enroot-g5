import Image from "next/image";
import Link from "next/link";
import { event } from "@/lib/content";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative block h-8 w-10 shrink-0">
            <Image src="/charms/c55.webp" alt="" fill sizes="40px" unoptimized className="object-contain" />
          </span>
          <span className="whitespace-nowrap font-display text-lg font-semibold leading-tight [font-variation-settings:'SOFT'_100]">
            {event.name}
          </span>
        </Link>
        <nav className="flex items-center gap-3 whitespace-nowrap text-sm text-muted sm:gap-5">
          <Link href="/activity" className="hidden hover:text-ink sm:inline">
            How it works
          </Link>
          <Link
            href="/make"
            className="rounded-full bg-rose px-3 py-1.5 font-semibold text-rose-ink hover:opacity-90"
          >
            Make yours
          </Link>
        </nav>
      </div>
    </header>
  );
}
