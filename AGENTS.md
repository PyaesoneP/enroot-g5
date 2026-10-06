# Agent workflow rules (this repo)

- **Branch + PR, always.** Never commit to `main` directly. Create a feature
  branch, commit there, push the branch, and open a PR to `main`.
- **Never push without Pyae's explicit permission.** Committing locally is fine;
  pushing (branches or main) is not, until he says to push.
- **Commit identity:** `Pyae Sone <pyaesone.perfect2014@gmail.com>` (the
  configured repo identity). Never override user.name/user.email per commit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` (resolved from this file's directory; in
monorepos, the `next` package may not be visible from the repo root) before
writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at
`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a
diff only re-creates an uncommitted change; committing it with your work keeps
the tree clean.

<!-- END:nextjs-agent-rules -->
