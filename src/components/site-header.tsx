import Link from "next/link";
import { event } from "@/lib/content";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            G5
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{event.host}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{event.cohort}</p>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Link href="/activity" className="underline-offset-2 hover:underline">
            How it works
          </Link>
          <a
            href="https://github.com/PyaesoneP/enroot-g5"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
