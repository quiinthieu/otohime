# t-1768 authorization continuation — run-9759

Cause: **authority**, operator action **esc-475**. No observed application defect; no code fix cycle. All executable checks and live shelf paths pass, but the explicitly required native author artifact cannot be read with available credentials.

Owner: task-manager operator. Sign in through the authorized task-manager account and make task **0671daac-7af4-4d24-8d86-920cecb2f1fb**, artifact **author.txt**, readable to QA, or attach its exact text to esc-475. Native endpoint: `/api/v1/tasks/0671daac-7af4-4d24-8d86-920cecb2f1fb/artifacts/author.txt`. Do not share credentials. Stable fingerprint: `task-artifact-read:0671daac-7af4-4d24-8d86-920cecb2f1fb:author.txt`.

Exact application/CI file and line to change: **none**. Changing `components/ink-shelf-3d.tsx`, `lib/shelf-shader.ts`, or `.github/workflows/ci.yml` cannot grant authorization to this protected platform artifact. This continuation requires an authorized read, not a runner repair or a new implementation.

On operator completion the platform relaunches QA without a fix cycle/retry. Read all 44 bytes, verify SHA-256 **7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada**, then compare author with **Otohime <quiinthieu@gmail.com>** and reject any Co-Authored-By trailer. Reconcile this artifact with [git-identity.txt](git-identity.txt) and the delivery task metadata. A mismatch is an identity defect and must not be waived. A successful authorized check closes this missing precondition; do not infer its outcome from the metadata hash.

No pipeline rerun is necessary to grant artifact access. Delivery CI **40820018472** and deployed-descendant CI **40820561536** had progressing checks at snapshot; after resumption inspect their terminal result and read any failed job's actual log before attribution. Plan green gate **ver-3879** already passes at **f54f160**. If deployed identity changes before continuation, verify its ancestry and executable fingerprint again; reuse browser evidence only when the relevant source/lock/configuration and served shelf chunks match the recorded fingerprint.

Stop now without polling the operator or pipeline. Independent execution, history limits, real/fake boundaries, and all remaining evidence conditions are in [qa_report.md](qa_report.md).
