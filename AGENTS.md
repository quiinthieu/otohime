<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working in this repository

For changes made on the site owner's behalf, run `bash scripts/setup-owner-git.sh --check` before committing. On a new owner-controlled clone, `bash scripts/setup-owner-git.sh --configure` sets the repository-local identity used by Vercel; it affects linked worktrees in that clone, not global Git settings. Git author environment variables and `git commit --author` can override that identity. Do not attribute another person's work to the owner.

Before shell work, read `~/.config/ai-agents/RTK.md` if it exists and use its supported wrappers; otherwise run the commands directly. For structural code discovery, prefer the codebase knowledge graph when available. Confirm the project and freshness, check relevant index coverage, and inspect source directly for coverage gaps; never infer absence from an empty graph result.

Create a task branch from a freshly fetched main branch; do not commit directly on main. Preserve unrelated changes and running processes. Do not stash, reset, clean, amend, rebase, or force-push unless asked. Inspect working and staged diffs and stage only task-owned changes. Make small Conventional Commits without AI attribution, include needed regression coverage, run relevant checks, and do not skip Git hooks. Do not commit secrets, generated output, unrelated lockfile changes, or work in progress. Push and merge only when authorized. The production workflow checks the author of the deployed commit before production migrations.
