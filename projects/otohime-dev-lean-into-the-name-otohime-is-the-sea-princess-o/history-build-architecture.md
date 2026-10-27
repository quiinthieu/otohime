# Palace Changelog History Build Architecture

## Overview

Ryugu-jo's Tamatebako (`app/(ryugu)/ryugu/page.tsx`, `app/(ryugu)/_components/tamatebako.tsx`) imports `content/history.json` statically at build time and never shells out to `git` at runtime.

- `entries`: Newest `<= 200` (`MAX_ENTRIES`) non-merge commits (`git log --no-merges`), serialized newest-first in `content/history.json` and reversed by `replay()` so the scrubber runs oldest-to-newest.
- `head`: Full 40-hex SHA of `entries[0]` (the newest non-merge leaf).
- `total`: All commits reachable from the indexed revision (`git rev-list --count <rev> --`, unfiltered, including merge commits). When `HEAD` is a merge commit `M` whose newest non-merge ancestor is `L`, `head` is `L` while `total` is the unfiltered commit count at `M`.

## Permissive vs. Strict Modes

### Permissive Mode (Default Developer / Archive Fallback)

- `npm run history:index` (invoked by `prebuild`) reads full git history when available, splices newer commits onto the fallback in a shallow clone that still holds `fallback.head`, and otherwise leaves the committed `content/history.json` fallback untouched (or writes `EMPTY_INDEX` if none exists).
- `npm run history:check` validates canonical JSON schema and bounds. When full git history is present, it verifies `committed.head` is an ancestor of `HEAD` within `MAX_LAG = 20` commits, entries match `git` at `committed.head`, and `total` matches either the unfiltered count at `committed.head` or (when only merges follow `committed.head`) at `HEAD`. In shallow or git-less checkouts, it validates structure only.

### Strict Delivery Mode (`--strict`)

- `npm run history:index -- --strict [--rev=<sha>]` and `npm run history:check -- --strict [--rev=<sha>]` enforce production delivery invariants:
  1. `gitState` must be `"full"` (`fetch-depth: 0`); shallow clones and git-less directories exit nonzero.
  2. When `--rev` (or `GITHUB_SHA`) is provided, it must resolve to the exact checked-out `HEAD` commit.
  3. `content/history.json` must exist, parse cleanly, and match canonical serialization byte-for-byte.
  4. `committed.head` must be a valid ancestor of `HEAD` with `<= MAX_LAG` (20) total commits between `committed.head` and `HEAD`, and `0` unindexed non-merge commits between `committed.head` and `HEAD`.
  5. `committed.total` must equal unfiltered `git rev-list --count HEAD --`.

## CI & Verification Gates

- `.github/workflows/ci.yml`:
  - `checks`, `preview`, and `production` all check out with `fetch-depth: 0`.
  - Before and after every build (`npm run build`, `npx vercel@64 build`, `npx vercel@64 build --prod`), CI runs `npm run history:index -- --strict --rev="$GITHUB_SHA"` and `npm run history:check -- --strict --rev="$GITHUB_SHA"`, blocking `db:migrate` and `vercel-deploy.sh` on any failure.
  - `checks` runs `bash scripts/probe-history.sh --self-test`.
  - `production` runs `EXPECT_SHA="$GITHUB_SHA" bash scripts/probe-history.sh https://otohime.dev` after `verify-deploy.sh`.
- `scripts/verify-history-build.sh`: Builds the real Next.js app locally after seeding a stale fallback, verifies strict generation/check, serves `/ryugu` locally, and inspects the Tamatebako in headless Chrome at `1366x768` and `390x844`, restoring `content/history.json` on exit.
