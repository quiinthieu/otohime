# Golden Seams and Ink Traces

Plan `pm-288`, revision 1. The two experiments are one delivery plan. The prior research is preserved in `research.md`. The requested extraction guide and `docs/claude/software-development.md` are absent from this checkout; `AGENTS.md` and the installed Next 16.4 guide govern implementation.

## Product outcome

**Kintsugi Break.** A visitor can rage-click an opted-in page card or, with motion permission, shake a device to crack it. Seeded SVG ink fractures spread from the contact point; a restrained card displacement and the site's off-by-default synthesized sound convey the break. The lines then mend with a gold gradient and moving sheen. Reduced motion replaces the break animation with a gold fade and disables shake. Repaired seeds are shared by card in the existing Postgres service. A bounded, rate-limited store prevents unbounded writes; the `/kintsugi` page ranks the most-mended cards and renders their shared gold webs. The page works with an empty or unavailable database.

**Ink Seismograph.** The Work page shows an ink strip chart of individual GitHub commit and PR events plus pipeline run statistics. A checked-in pipeline JSON export and generated `content/seismo.json` provide a real static trace before live refresh. Log-scaled job size drives tremors and failed runs leave red blots. A server-rendered SVG and event list work without JavaScript. The client adds a scrolling, slightly wobbly ink trace, bounded canvas work, a draggable/keyboard scrubber, spike details, and a tear-off standalone printable SVG of the visible window. Reduced motion disables automatic scrolling and wobble.

## Data and safety boundaries

- Keep card IDs in a server allowlist. Store only a small number of deterministic seeds per card, plus aggregate mend counts. Hash visitor identifiers for bounded hourly/per-card buckets; never store raw IP or user agent. Bound request size, global writes, and table cleanup. A rejected or offline write must leave the local animation usable.
- Reuse `lib/bottles-store.ts`'s transactional bucket pattern and the site's sound gate. No new paid service or audio asset is needed. DB migration is required and cannot be treated as a frontend-only change.
- Export seismograph events as counts, timestamps, short safe labels, run status, runtime, and row count only. Do not publish tokens, private commit contents, job logs, or personal data from CI. The importer keeps the last valid checked-in trace when GitHub is rate-limited or offline. Event ordering, magnitude, downsampling, SVG geometry, and export must have deterministic fixtures.
- The seismograph's static SVG is primary content, not an empty placeholder. Client enhancement keeps its accessible event names, keyboard paths, and selection. Cap device pixel ratio and drawing work; pause animation when hidden or outside the viewport.
- Read the relevant installed Next 16.4 docs before route, server/client boundary, or caching changes. In a fresh checkout run `npm ci`. Use role-based heading assertions because `RisoText` duplicates decorative ink text.

## Task DAG

| # | Contract | Depends on | QA |
| --- | --- | --- | --- |
| 1 | Deterministic fracture model | — | skip |
| 2 | Shared seam store and API | 1 | required |
| 3 | Kintsugi card interaction | 1, 2 | required |
| 4 | Golden web gallery | 2, 3 | required |
| 5 | Activity event model and export | — | skip |
| 6 | Work page ink seismograph | 5 | required |

The Kintsugi and seismograph chains can progress independently. No task uses a natural run, soak, future date, or person reply as proof. Each software engineer task has checkout commands that prove its scoped claim at the delivery SHA. Engineers stop after pushing; CI deployment, independent QA, and acceptance establish deployed behavior. A failure is investigated from raw logs and complete bounded history, correlated with the executable's code, lockfile, configuration, and artifact hashes. QA exercises a relevant negative control and distinguishes build, deploy, observed execution, and delivered user output. An unread history page is inconclusive. Capacity is handled by durable queue and a typed pending/watch check, never by asking a person to start a runner.

## External capabilities

`prerequisites.json` declares the existing GitHub repository, task-manager runner, GitHub Actions, Vercel deployment, and Neon Postgres deployment capabilities. The public GitHub feed and checked-in export need no new credential. The plan introduces no KV service. Control-plane probes do not prove runner credentials or a successful deployment. If an operator-owned setup is discovered, the first affected task raises a precise `operator_action` at its start; unrelated work continues. The proposal uses the current prerequisite probe result rather than a person's declaration.

## Acceptance walkthrough

At the cited deployed SHA, break an opted-in card by clustered clicks; observe origin-based fractures, sound only after the site's switch is enabled, a gold mend, and unchanged card links. Reload and inspect persisted shared seams and the ranked `/kintsugi` page. Exercise rate limit, invalid card ID, unavailable database, touch, and reduced motion; shake is gated by supported permission and is absent under reduced motion. On `/work`, compare named spikes to the checked-in activity export; select a failure blot, drag and keyboard-scrub, open details, and export/print a nonempty standalone SVG. Disable JavaScript and confirm the static chart and event list still convey real data; turn on reduced motion and confirm the trace is stationary. QA independently checks these browser/API paths, migration state, CI/deployed SHA, and negative controls before acceptance.
