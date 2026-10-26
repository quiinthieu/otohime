# Delivery summary · pm-264/t-1590 · run-9040

Repairs the exact Footer walk title assertion identified by `fix_plan_run-9032.md`. Read the plain `riso-source` span within `h2#end-title`, excluding decorative Riso plates while preserving exact canonical title equality and plain-heading fallback. Every other footer check is retained. The regression executes the actual shell heading block, first reproducing the duplicate-title failure. It then passes nested/plain headings and rejects wrong accessible source with a correct plate, extra text, wrong id, an out-of-heading source and an imitation class. The class-token negative control also failed an intermediate word-boundary matcher before the final repair. Product/Peep-box, lockfile and workflow code remain unchanged.

## Local verification

Fresh `npm ci`; real Linux fleet worker `avietidol-z490`, Node 22.23.3, locked Next 16.4.2, React 19.3.0, Playwright Core 1.64.0, embedded-postgres 17.10.0-beta.17 and Google Chrome 154.0.8037.57. Actual board profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort high. The exact focused contract constructs/migrates real disposable Postgres, builds/serves Next and launches real Chrome; no fake runner substitutes for those dependencies. Production build `7R7L-yFjFvMtDA5duOrFN`; relevant source/test/lock/config aggregate `a8e397951bd0f4a2d27375aec1148aad292ce612842bbd8d2c2b9c381cba0b08`, with per-file hashes in `artifacts/identity.json`.

| Check | Result |
| --- | --- |
| Pure projection/pose contract | 6/6 |
| Repository unit suite | 2321/2321 |
| `CI=true npm test`, installed Chrome on Linux | 2321/2321 |
| Lint + typecheck | exit 0; ten existing lint warnings |
| Focused production Peep-box contract | 8/8 |
| Full serial production browser suite | 138 pass, 0 fail, 1 optional screenshot-evidence skip (artifact directory not requested) |
| `SKIP_BUILD=1 PORT=47862 bash scripts/walk-end.sh` | 67 ok, 0 failed |

The full suite and Footer walk reuse that fresh production build through documented `SKIP_BUILD=1`. At both 390×844 and 1366×768, Peep-box measures 8,454 incremental gzip bytes, attributable CLS 0, stabilized inactive rAF 0, and no camera/model/worker requests or media calls. Emitted Play chunk SHA256 `ee0af5c50a8cb0256297f4f6407808a3ec6cded43ca8b14f88810d0d6e7d345a` and lazy controller `3570b1f30dfed72f4f83c6c15e8ba2dbb5c95bcc7b328f0ddacdba6ed4b12c23` match prior delivery. Real moving-frame and native CDP document-touch controls exercise the browser; tilt permission/orientation and visibility fixtures remain synthetic policy evidence, not physical-device sensor evidence. The new footer fixtures are synthetic HTML, supplemented by the complete real served-HTML walk.

## History and handoff

Independent pre-push public GitHub index reads cover two pages each: 50/103 FAILED and 50/442 COMPLETED main runs; the separate current page covers 25/443 with run `40349872187` (`e03cf1c`) in progress. These bounded snapshots are incomplete; older runs and most raw logs are unread. The failed job page independently confirms `40346324813`/checks `121654087754` passed E2E and motion, then failed Footer walk, with the Chromium probe skipped. Raw REST logs returned 403 and the actual public step-log URL returned 404; no claim is made to have read its assertion. The starting Footer walk SHA256 `0d8bd9b95186c6efe0e7edd8f47f1969d56ae50aec4487bb8a423a62ceb28ec7` matches QA's failing executable; the repaired script is `379bee702533f74d321c56b18f1eb01c3ea884e8b9f232de6cd37c5961578d15`. Local red fixture evidence reproduces the reported title defect and the repaired real walk is green. Pending upstream CI cannot establish this repair's delivery.

Plan-manager returns 17 nonpaginated runs through this run. Prior SWE task `5ab3e44a-d5b8-4456-b7c0-5da249104c58` is persisted COMPLETED with callbackState=delivered, callbackAttempts=1; its raw bounded runner tail was read through task-manager and confirms exit 0/push of `74522bc`. It is a truncated tail, not complete prior execution. No new remote runtime, processor/model asset or callback adapter is introduced.

Commit/push identity and receipt are captured in `artifacts/commits.txt`, `author.txt` and `push.log`. Generated prebuild history-index churn is excluded. Explicit decisions and a class-token lesson are recorded on the board. No operator or capacity prerequisite is claimed.

Local integration execution is demonstrated. New integration deployment and product acceptance remain unproven under the explicit stop-at-push role contract. Plan-manager owns the new delivery SHA's green gate, Actions checks/production and independent live ancestry/user-path QA; new run/job ids are allocated after handoff and are unobserved here. Failure condition: any contract or Footer walk fails, checks/production fail or skip, deployed ancestry excludes the repair, or independent Peep-box geometry/Disable/native-touch/no-camera checks fail. Physical-device tilt remains optional device QA outside the delivery gate. No post-push pipeline watch or deployed-system probe is performed.
