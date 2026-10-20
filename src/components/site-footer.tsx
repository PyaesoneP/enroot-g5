import { event } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-8 text-xs text-muted sm:flex-row sm:justify-between">
        <p>
          {event.host}, {event.cohort}. Theme: {event.theme}.
        </p>
        <p>
          Built with Next.js + Tailwind, deployed on Vercel.{" "}
          <a
            href="https://github.com/PyaesoneP/enroot-g5"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
