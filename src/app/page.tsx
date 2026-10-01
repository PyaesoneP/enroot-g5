export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
              G5
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">EnROOT Group 5</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">15th ROOT · SUTD</p>
            </div>
          </div>
          <a
            href="https://github.com/PyaesoneP/enroot-g5"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex max-w-3xl flex-col px-6 py-10 sm:py-16">
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
          We haven&apos;t drawn the theme yet.
        </h1>
        <p className="mt-3 max-w-prose text-base leading-7 text-zinc-600 dark:text-zinc-400">
          This is the build shell for EnROOT Group 5&apos;s event site. The theme
          and activity are drawn 3–4 Oct — we build the real thing around it.
          Until then this page stays honest: a placeholder, not a product.
        </p>

        {/* Timeline */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Timeline
          </h2>
          <ol className="mt-4 space-y-4">
            {[
              { label: "1 Oct", detail: "Events briefing", done: true },
              { label: "3–4 Oct", detail: "Theme + activity drawn", done: false },
              { label: "From 14 Oct", detail: "Draw lots → pick event week", done: false },
              { label: "1 Nov", detail: "Publicity material (poster + IG)", done: false },
              { label: "5–27 Nov", detail: "Event day", done: false },
              { label: "14 Dec", detail: "Final members revealed", done: false },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    step.done
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer note */}
        <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Built with Next.js + Tailwind. Deployed on Vercel. The full event site
          ships after the theme is confirmed.
        </footer>
      </main>
    </div>
  );
}