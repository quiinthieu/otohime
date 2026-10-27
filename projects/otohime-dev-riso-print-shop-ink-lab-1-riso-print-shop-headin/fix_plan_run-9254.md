# Fix Plan — `pm-268` / `t-1678` (`run-9254`)

- **Plan**: `pm-268` ("Riso Ink Studio")
- **Task**: `t-1678` ("Stabilize Riso heading plates and /projects Kame hydration")
- **QA Run**: `run-9254`
- **Cause**: `code`

---

## 1. Cause of Failure

All 11 application and test files delivered for `t-1678` in `c5497e0ce3a170ad7291702f22cdceeeb287ac52` / `a62c6356893c4080714795d11599469b55f9aa2e` pass every local verification gate (`5/5` Riso unit tests, `4/4` paper-hydration unit tests, `2,571/2,571` `npm test`, `npm run typecheck`, `npm run lint`, `19/19` contract E2E tests in `e2e/riso-headings.test.ts` + `e2e/kame.test.ts`, `23/23` surrounding E2E tests, and green gate `ver-3675`).

However, SWE `run-9250` published delivery commit `a62c6356893c4080714795d11599469b55f9aa2e` as a **two-parent merge commit** (`Merge parents: a770c135ab76fcb6a651baa9496e71af7c84f508 and c5497e0ce3a170ad7291702f22cdceeeb287ac52`) instead of rebasing onto `origin/main` (`git pull --rebase`).

In `.github/workflows/ci.yml` line 129 (`checks` job Step 18), CI runs:
```bash
npm run history:index -- --strict --rev="$GITHUB_SHA"
```
When `$GITHUB_SHA` (`HEAD`) is two-parent merge commit `a62c6356893c4080714795d11599469b55f9aa2e`:
- `indexAt(run, head)` (`scripts/history-index.ts:240–246`) indexes all non-merge commits reachable from `a62c6356893c` (which includes `a770c135ab` from parent 1 and `c5497e0ce3` from parent 2) and sets `index.head = commits[0].sha = "a770c135ab76fcb6a651baa9496e71af7c84f508"`.
- `main()` (`scripts/history-index.ts:441`) then runs `checkHistory(run, repo, readText(file), { strict: true, rev })`.
- At `scripts/history-index.ts:342–345`, `checkHistory` computes `rebuiltAtLeaf = indexAt(git, committed.head)` (`indexAt(git, "a770c135ab76fcb6a651baa9496e71af7c84f508")`). Because `c5497e0ce3a170ad7291702f22cdceeeb287ac52` is on the second parent of merge commit `a62c6356893c`, it is not an ancestor of `a770c135ab76`, so `rebuiltAtLeaf` does not match the serialized index and `history:index -- --strict` exits `1` with:
  `history:index: strict post-write check failed for .../content/history.json: does not match git at its own head a770c135ab; run npm run history:index`.

As a result, GitHub Actions run `40548308774` (`a62c6356893c4080714795d11599469b55f9aa2e`) failed at Step 18, skipped `production` job `122347217303`, and `https://otohime.dev/api/health` remains at `36ba86a99f78ce93a8972c8e1f4d003242325469`.

Furthermore, `.github/workflows/ci.yml` lines 12–14 configure:
```yaml
    paths-ignore:
      - "projects/**"
      - "**.md"
```
So a report-only commit under `projects/**` or `**.md` does **not** trigger the `main` CI workflow. To trigger `ci.yml` and pass `npm run history:index -- --strict --rev="$GITHUB_SHA"`, `t-1678` must publish a **linear (single-parent) non-merge commit** on `origin/main` that modifies at least one non-Markdown path within `t-1678`'s declared `interfaces`.

---

## 2. Exact File and Lines to Change

### File: `lib/paper-hydration.test.ts` (lines 69–76)

In `lib/paper-hydration.test.ts` (one of `t-1678`'s declared `interfaces`), extend the final unit test (`"hydration gate settles immediately once every paper host on the page is hydrated"`, lines 69–76) to also assert that calling `markPaperHostHydrated` idempotently on an already-hydrated host keeps `arePaperHostsHydrated(root)` true and notifies a second `afterPaperHydration` subscriber on the next animation frame:

```ts
test("hydration gate settles immediately once every paper host on the page is hydrated", () => {
  const first = new FakeElement();
  const second = new FakeElement();
  markPaperHostHydrated(first as unknown as HTMLElement);
  markPaperHostHydrated(second as unknown as HTMLElement);
  markPaperHostHydrated(second as unknown as HTMLElement);
  const root = new FakeRoot("complete", [first, second]);
  assert.equal(arePaperHostsHydrated(root), true);
  let calls = 0;
  const cancel = afterPaperHydration(() => {
    calls += 1;
  }, root);
  assert.equal(calls, 0);
  root.flushFrame();
  assert.equal(calls, 1);
  cancel();
});
```

Do **not** modify any other application files unless a rebase conflict requires it; all Riso heading and `/projects` Kame/tactile hydration implementations in `lib/paper-hydration.ts`, `components/paper-host.tsx`, `app/(site)/layout.tsx`, `components/kame/loader.tsx`, `components/kame/companion.tsx`, `components/tactile/loader.tsx`, `components/tactile/paper-layer.tsx`, `components/cartridge.tsx`, `components/end-footer.tsx`, `app/(site)/(app)/notes/page.tsx`, `e2e/kame.test.ts`, and `e2e/riso-headings.test.ts` are already verified and passing.

---

## 3. How to Make the Pipeline Run Again (Step-by-Step)

1. **Fetch `origin/main` and work on a linear branch**:
   ```bash
   git fetch origin
   git checkout -B pm-268-t-1678-linear origin/main
   ```
2. **Apply the change in `lib/paper-hydration.test.ts` (lines 69–76)**.
3. **Run all 5 task verification gates**:
   ```bash
   node --experimental-strip-types --test lib/riso-heading.test.ts lib/paper-hydration.test.ts
   npm test
   npm run typecheck
   npm run lint
   TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts e2e/kame.test.ts
   ```
4. **Restore generated `content/history.json` before committing**:
   ```bash
   git checkout -- content/history.json
   ```
5. **Commit as a single-parent linear commit with `Otohime <quiinthieu@gmail.com>` (no `Co-Authored-By` trailer, never `git merge`)**:
   ```bash
   bash scripts/setup-owner-git.sh --check
   GIT_AUTHOR_NAME="Otohime" GIT_AUTHOR_EMAIL="quiinthieu@gmail.com" \
   GIT_COMMITTER_NAME="Otohime" GIT_COMMITTER_EMAIL="quiinthieu@gmail.com" \
   git commit -m "pm-268/t-1678: verify paper hydration subscriber settlement"
   ```
6. **Verify `history:index -- --strict` passes on the new linear `HEAD` (then restore `content/history.json`)**:
   ```bash
   npm run history:index -- --strict --rev="$(git rev-parse HEAD)"
   git checkout -- content/history.json
   ```
7. **Push linearly to `origin/main` (using `git pull --rebase origin main` if non-fast-forward — NEVER `git merge`)**:
   ```bash
   git push origin HEAD:main
   ```
   If rejected as non-fast-forward:
   ```bash
   GIT_AUTHOR_NAME="Otohime" GIT_AUTHOR_EMAIL="quiinthieu@gmail.com" \
   GIT_COMMITTER_NAME="Otohime" GIT_COMMITTER_EMAIL="quiinthieu@gmail.com" \
   git pull --rebase origin main
   ```
   Confirm `git rev-list --parents -n 1 HEAD` has **only one parent** (two SHA fields total, not three), re-run the task tests, and `git push origin HEAD:main` + `git push origin HEAD`.
