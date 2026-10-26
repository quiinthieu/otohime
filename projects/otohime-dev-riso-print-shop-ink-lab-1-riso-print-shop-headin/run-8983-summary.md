# t-1601 delivery evidence

Run run-8983 implements accessible Riso heading plates. Profile read from plan-manager: codex-sol-6-1-high; gpt-6.1-sol; effort high; fleet worker billie-mac. The delivery commit is the `git_sha` on this run's summary report and is written to `.agent-artifacts/pm-268-t-1601/commits.txt` after committing.

`RisoHeading`/`RisoText` share deterministic grapheme helpers, readable selectable anchors, one plain accessible source and two token-colored CSS ghost plates. The third plate follows the two/three-plate setting. Entry uses a shared observer, transform/opacity and a bounded stagger. Static media and server output are readable immediately. Main-site headings, FigTitle and StampHeading use this boundary; exhibit type systems stay unchanged. See [heading-contract.md](heading-contract.md).

The final local checks passed:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --test lib/riso-heading.test.ts` | 5 passed |
| `npm test` | 2,274 passed, no failures or skips |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 10 pre-existing warnings |
| `node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts` | production build exit 0; 5 browser tests passed |

Production tests use the same source and package lock in `/tmp/otohime-riso-8983-r1`, an APFS clone with a clean `.next`, because this lease path's spaces trigger a known Turbopack font error. Two pushes were overtaken by concurrent main updates. The single commit rebased cleanly each time, with every contract command rerun. Retry 1 included a fresh production build; retry 2 added only two Markdown files, so its browser runner reused that exact unchanged executable with `SKIP_BUILD=1`. The source fingerprint remains unchanged. Node is 22.12.0. Build id, selected source/lock/config hashes and final output tails are in `.agent-artifacts/pm-268-t-1601/`.

The runner constructed real embedded Postgres, applied migrations, compiled Next and started a local production server. Chrome exercised real hydration, one observer, semantic names, selection, offsets/counts, static media, no JavaScript, mobile wrapping, the actual `console` ViewTransition type, and stamp/drop/tidy/focus return. The edge-string fixture transpiles the real shared component for React SSR and loads its actual CSS in Chrome; it does not simulate hydration. Browser instrumentation wraps and delegates real observer/transition methods; there is no fake runner, renderer, observer, storage adapter or stamp solver.

Negative controls: Sumi removes the third plate while preserving the name; console A opens Work without plate transition names; Play generates exactly four blocks from the plain source, stamps ink, restores heading visibility and returns focus. Desktop Home and mobile Notes were also inspected visually. No runtime defects remain observed in these checks.

History scope: all five cases and the complete final browser runner tail were inspected. Development iterations found assertions that counted hidden cached routes or read visibility before paint, plus an ESLint children-prop violation in the fixture; these were corrected. Earlier overwritten iteration logs are incomplete, so no exhaustive historical-success claim is made. Remote CI/FAILED/COMPLETED deployment history was not inspected: this SWE contract explicitly stops at push. CI, deployed integration, independent QA and complete Riso Ink Studio product acceptance remain owned by plan-manager; any failed job must return its exact id/log. Local execution is demonstrated; deployed product acceptance is not claimed.

The checkout arrived with generated `content/history.json` changes. They are excluded from this delivery. No dependency, binary, console transition name, deployed setting or standalone exhibit heading was changed.
