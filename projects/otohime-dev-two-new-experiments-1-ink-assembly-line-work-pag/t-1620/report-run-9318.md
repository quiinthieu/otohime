# t-1620 — addressable tagged notes

Run: run-9318. Branch: pm-279-t-1620-tagged-notes. Base: d323b87.
Actual run profile: codex-sol-6-1-high, model gpt-6.1-sol, reasoning effort high (run-9318 profile_flags).
Delivery commit: the commit containing this report; its full SHA is persisted in the plan-manager summary and execution artifacts/commits.txt after commit creation.

## Change

The three existing notes retain their exact title, date and body. Their explicit slugs are `backfills-are-a-feature`, `on-twos` and `the-contract-caught-it`. Editorial tags describe each text; only the two data-engineering notes share that topic. `Note` describes the content shape. `noteBySlug` matches only an exact published slug.

Each list title links to its detail route. The full list copy, date-derived paper identifiers, tossable surfaces, Riso headings and page transition classes remain. Detail routes await the generated Next PageProps params, prerender all three slugs, supply note metadata, display tags and link back to the list. Unknown slugs call Next's notFound; metadata lookup returns an empty object for a missing note, matching the existing article route convention. No chart or new note content was added.

## Verification

Environment: Node 22.23.3; locked Next 16.4.2, React/React DOM 19.3.0 and playwright-core 1.64.0. Existing installed dependencies matched these lock entries; no dependency or lock changes. Relevant installed dynamic routing, metadata, notFound, static params and View Transition guides were read before implementation.

| Check | Result |
| --- | --- |
| Full project `npm test` | 2,617 passed, 0 failed, 0 skipped |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 10 existing warnings outside task code |
| Framework production build, `node_modules/.bin/next build` | exit 0; all three detail routes generated |
| Local production browser verification | exit 0: desktop 1366×900; phone 390×844 with touch and reduced motion; JavaScript disabled |
| `git diff --check` | exit 0 |

The full unit suite needs GNU `timeout` because it runs the real CI shell fragments. This Mac runner had neither timeout nor gtimeout: the first run had seven exit-127-related failures. GNU coreutils 9.7 was built under `/tmp/pm-279-t-1620-tools/` from the official GNU source archive and its `src` directory was added to PATH. No fixture was bypassed or mocked to hide that missing dependency. The final full-suite command was `PATH=/tmp/pm-279-t-1620-tools/coreutils-9.7/src:$PATH npm test`.

The production build used the same local placeholder Better Auth settings as the existing E2E runner. It invoked Next directly, avoiding unrelated network-fetching content-generation prebuild steps. Build ID: `6BOb1HW4u6Yb-JwPXae88`. No generated content, binaries, screenshots or lockfile changes are committed.

The repeatable checkout probe is `artifacts/verify-notes.mjs`:

```sh
BASE_URL=http://localhost:4316 node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON projects/otohime-dev-two-new-experiments-1-ink-assembly-line-work-pag/t-1620/artifacts/verify-notes.mjs
```

Start the local production server with the Better Auth test environment from `scripts/e2e.mjs`. The probe rejects non-local hosts. It checks original list copy and paper ids, all three links, keyboard Enter activation, direct URLs, exact detail copy/date/tags, metadata and back links. All three known pages and the list work without JavaScript. A settled reduced-motion screenshot was visually inspected; it displayed the note, tags, navigation and site styling correctly.

Negative controls: `missing-note` and `constructor` both resolve to no note; with JavaScript they show the existing “This page got lost” heading and noindex. The first unknown request can have HTTP 200 after the shared shell streams; subsequent cached requests returned 404. **Existing framework limitation:** without JavaScript, an unknown resource returns HTTP 404/noindex with Next's blank error shell. This behavior is already documented in `app/global-not-found.tsx`; a local boundary/Suspense experiment did not fix it and was removed. The checkout probe explicitly records this limitation instead of claiming a visible no-JavaScript error page.

## Boundaries and follow-up

Real: locked production Next/React route execution and Chrome DOM/CSS/navigation. No fake note data or runtime was used. The project unit suite uses its existing subprocess/workflow fixtures; those do not prove deployment. No external queued executable, callback or runtime job history applies to this content/routing task. CI/deployment history was not inspected under the explicit stop-at-push contract, so integration deployed and independently accepted product delivery remain unproven.

The required chief-of-staff document and `docs/claude/software-development.md` are absent, as the plan already records. Repository AGENTS.md and the task contract were followed. Current pm-273, pm-275 and pm-276 contracts were checked. Shared CI/deploy files remain untouched; package.json only gains the notes test glob. Date-based paper ids are preserved for sibling fortune-link work.

After push, plan-manager owns t-1620's CI green gate and independent deployed QA. Failure condition: any required gate fails or the deployed list, note lookup, routes or copy differ from the acceptance contract. No CI result or deployment is claimed here, and no pipeline/deployed checks are run after push.

## Executable identity (SHA-256)

- `content/site.ts`: `7e924841a468d850cb8bbdf8d62a74f8b586759d4c65042e371c88bb511b3464`
- `app/(site)/(app)/notes/page.tsx`: `f3a5dd40b4b5a6307548d4d0593732146c6495b81e553c6e4dcdba94716e623a`
- `app/(site)/(app)/notes/[slug]/page.tsx`: `e1bc00b30ebf4ca960031d66ada7fa8c70e82e76bd614630c46c3ce241d6a2d3`
- `app/(site)/(app)/notes/_lib/notes.ts`: `a1ddacf972c6ce6e40ebcae90de53410d0f7ccb8acf436e40babaaf9a8562405`
- `app/(site)/(app)/notes/_lib/notes.test.ts`: `dcf7c9557bd0a1501a6b1549f1d63cb8d54565cec82f21b4688dbf758fdc924a`
- `package.json`: `e835fc4f086b91bf51b14a04acc3dca5e11742f4c433ffbb53b13b32184719f5`
- `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`
- `next.config.ts`: `321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d`
