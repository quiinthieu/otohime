# Ink Bonsai Shadow Theatre

Plan **pm-287**, revision 1, product-owner run **run-9101**. Build both paper-and-ink experiments on the existing site. The plan keeps every requested feature and does not depend on a second plan.

## Outcome

- **Ink Bonsai** at `/play/bonsai`: a bounded L-system driven by owner `quiinthieu`'s weekly public contribution counts captured at build time. A stamped committed snapshot keeps offline builds and page loads working. The same ISO week and snapshot yield the same SVG tree. Quiet weeks leave bare twigs. Spring blossom, summer foliage, red autumn leaves and winter snow/bare branches follow the site season. Pointer and keyboard pruning remove subtrees with gated snip sound and reduced-motion fallback. `/og/bonsai?week=YYYY-Www` and a local PNG postcard share the deterministic tree.
- **Hand Shadow Puppet Theatre** at `/play/shadows`: a clear notice precedes an explicit camera opt-in. The pinned local Hand Landmarker and worker process frames only in the browser. Four recognized poses—rabbit, dog, bird and deer—become ink creatures on a candlelit paper screen and carry Projects/Notes links. Stop, visibility loss and route exit release tracks. Camera denial or unavailability opens mouse, touch and keyboard paper puppets. Reduced motion removes hops and flicker.

## Delivery decisions

1. Bonsai tasks 1–4 finish before the camera chain begins. The second chain can reuse the resulting Play navigation without overlapping edits.
2. Weekly means deterministic ISO-week selection, not a scheduled job. `scripts/fetch-contributions.mjs` is the on-demand refresh trigger and uses the same parser as the build snapshot path; no natural run is proof.
3. Public activity is summarized as counts only. Network refresh is optional at build time and never happens in a visitor request. The committed snapshot has an as-of date.
4. Deer is required alongside rabbit, dog and bird. Gesture recognition is proven with landmark fixtures and negative controls; the fake webcam proves consent/lifecycle only.
5. All rendering and sharing stay local or in the app; the camera is neither uploaded nor saved. A local pinned model is verified with a hash and a locked-environment construction preflight.
6. Every frontend task gets QA. Pure model/data tasks may skip QA after their green verification gate; final acceptance still walks both routes.

## External prerequisites

The revision's `platform.plan-prerequisites.v1` manifest declares the existing GitHub read/push capability, task-manager account and execution runner, GitHub Actions checks, Vercel production deploy capability and public GitHub contribution read. No new paid service or credential is requested. Probe results on this run are inconclusive or failed because the adapters lack a GitHub CI token or provider allowlisting; these results do not prove deployment or excuse real code defects. The product owner records the exact probe results with plan-manager. Existing Git SSH push and CI are checked separately at delivery.

## Task DAG

| # | Contract | Depends on | QA |
| --- | --- | --- | --- |
| 1 | Deterministic bonsai growth | none | skip |
| 2 | Build time contribution snapshot | none | skip |
| 3 | Interactive seasonal Ink Bonsai | 1, 2 | required |
| 4 | Bonsai week postcard | 3 | required |
| 5 | Pinned hand model assets | 4 | skip |
| 6 | Opt in hand tracking | 5 | skip |
| 7 | Four shadow pose classifier | 6 | skip |
| 8 | Ink shadow theatre stage | 7 | required |
| 9 | Drag paper cutout puppets | 8 | required |
| 10 | Privacy and regression gate | 3, 4, 8, 9 | required |

## Build contracts

### 1. Deterministic bonsai growth

**Problem:** There is no bounded, reproducible tree model that maps weekly activity to visible growth.

**Acceptance:** The same week and contribution snapshot always produce identical bounded tree geometry; quiet weeks leave bare twigs and every pruneable branch has a stable subtree identity.

**Interfaces:** lib/bonsai.ts; lib/bonsai.test.ts

**Actions:**
- Read the relevant installed Next guide before touching route code in later tasks; implement a pure bracketed L-system in lib/bonsai.ts using ISO-week plus counts as the seed, tapered strokes, stable branch IDs, parent links, node cap, and log-scaled branch/leaf density.
- Make zero-count weeks add bare twigs and prevent a quiet week from deleting prior growth; add unit fixtures for identical seeds, differing weeks, empty weeks, branch ancestry and node cap.

**Non-goals:** SVG UI; network data collection.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint` in the checkout, with exit 0.

### 2. Build time contribution snapshot

**Problem:** The site has no reliable owner activity snapshot for build-time tree growth.

**Acceptance:** Running the refresh command updates a validated owner weekly-count snapshot from public activity; offline builds use the committed snapshot with its as-of date and never fetch on page load.

**Interfaces:** scripts/fetch-contributions.mjs; scripts/fetch-contributions.test.mjs; content/contributions.json; package.json; README.md

**Actions:**
- Implement an on-demand scripts/fetch-contributions.mjs command that reads public activity for the pinned owner quiinthieu, aggregates by ISO week, validates count/date bounds, writes only counts and provenance, and exits usefully on malformed data.
- Commit a real baseline content/contributions.json captured from public activity and make the build use it when refresh fails; a failed network request must not make page load perform a fetch or fabricate current activity.
- Test the parser and refresh path with local fixtures including zero weeks, incomplete current week, invalid response and network failure; document the explicit refresh command and snapshot age.

**Non-goals:** visitor tracking; runtime GitHub token; scheduled refresh.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` in the checkout, with exit 0.

### 3. Interactive seasonal Ink Bonsai

**Problem:** Visitors cannot see or interact with the owner activity tree.

**Acceptance:** The Bonsai page shows deterministic owner growth and four seasonal treatments; a visitor can prune and regrow by pointer or keyboard, with gated sound and a static reduced-motion outcome.

**Interfaces:** app/(site)/(app)/play/bonsai/; app/(site)/(app)/play/page.tsx; components/bonsai/; e2e/bonsai.test.ts

**Actions:**
- Read installed Next route guidance; build /play/bonsai and a Play entry using the committed snapshot and lib/bonsai output, existing SVG ink filters, responsive light/dark styling and site data-season.
- Render spring blossom, summer green leaves, autumn red leaves and winter bare/snow states; expose week/count/source and an honest snapshot age.
- Make branch targets at least 24px with mouse, touch, Enter and Space pruning; remove the selected subtree, animate falling ink leaves only when motion is allowed, synthesize a gesture-gated snip through the existing sound setting, and offer Regrow.
- Add browser coverage for zero-week twig, one-branch pruning/regrowth, keyboard focus, all seasons, reduced motion and mute; ensure no request to GitHub on page load.

**Non-goals:** editing source activity; server-persisted pruning.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run build` in the checkout, with exit 0.

### 4. Bonsai week postcard

**Problem:** A tree of the week cannot yet be shared as a consistent image.

**Acceptance:** A valid week URL serves a shareable deterministic OG image, and the Bonsai page downloads a nonblank matching PNG postcard; invalid weeks fail safely.

**Interfaces:** app/og/bonsai/; components/bonsai/; lib/bonsai-postcard.ts; e2e/bonsai-postcard.test.ts

**Actions:**
- Read the installed Next image route guide; implement /og/bonsai?week=YYYY-Www using the same pure tree model and snapshot, a bounded week parser, and flat ink style compatible with next/og without relying on SVG filter support.
- Add a postcard PNG download from the browser using the visible week's tree, date, count and source; make unsupported canvas/export fail with a useful message rather than a broken link.
- Add tests for identical image content at the same week, invalid-week fallback, nonblank PNG, and no cross-origin assets.

**Non-goals:** server-side visitor uploads; unbounded archive generation.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run build` in the checkout, with exit 0.

### 5. Pinned hand model assets

**Problem:** The theatre cannot run privately offline without a verified local Hand Landmarker model.

**Acceptance:** The pinned local model and runtime assets pass hash and license checks, construct with the locked MediaPipe package, and a corrupt asset fails verification.

**Interfaces:** scripts/vendor-hand-landmarker.mjs; content/hand-landmarker-assets.json; public/models/hand-landmarker/; lib/hand-landmarker-assets.test.ts; package.json

**Actions:**
- Follow the existing Peep Box vendor pattern for the pinned @mediapipe/tasks-vision 0.10.32 Hand Landmarker model: immutable source, SHA256, byte size, license and local public URL; vendor only the required model and wasm assets.
- Add fail-closed manifest/hash checks and verify an actual HandLandmarker import and asset/adapter construction with the pinned package in the locked npm environment, plus a wrong-hash negative control.

**Non-goals:** runtime CDN dependency; camera UI.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` in the checkout, with exit 0.

### 6. Opt in hand tracking

**Problem:** No reusable theatre tracker handles consent, lifecycle or model failures.

**Acceptance:** Camera access begins only after a visitor opts in; tracking stays in-browser, uses local assets, handles CPU fallback and releases tracks on every exit path.

**Interfaces:** components/shadows/hand-tracker.ts; components/shadows/hand-worker.ts; lib/hand-tracker.test.ts

**Actions:**
- Implement an opt-in only controller around getUserMedia({audio:false}) and MediaPipe VIDEO mode for up to two hands, with worker execution, GPU attempt and CPU fallback, bounded detection near 20Hz, mirrored coordinates, cleanup on stop/unmount/hidden/revoke and no retained frames.
- Keep the permission request behind an explicit user button; expose start/stop/error states and a fallback signal. Use local model/wasm URLs only.
- Test camera never starts on import, denied permission, GPU failure/CPU success, aborted startup, visibility loss, track stop and cleanup using fakes; run a real import/adapter preflight against locked assets.

**Non-goals:** video upload; recording; continuous background camera.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` in the checkout, with exit 0.

### 7. Four shadow pose classifier

**Problem:** Raw hand landmarks do not provide stable rabbit, dog, bird or deer poses.

**Acceptance:** All four requested poses resolve from landmark fixtures with stable transitions, while ambiguous or missing hands remain neutral.

**Interfaces:** lib/shadow-poses.ts; lib/shadow-poses.test.ts; lib/fixtures/shadow-poses/

**Actions:**
- Implement mirrored landmark normalization, bounded One Euro smoothing, geometry-based pose scores for rabbit/dog/bird/deer (one or two hands as appropriate), six-frame debounce and exit hysteresis; emit neutral when confidence is low.
- Add recorded or synthetic 21-point landmark fixtures for all four poses, left/right mirror, rapid transitions, missing hand, ambiguous hand and negative controls; keep classifier pure and deterministic.

**Non-goals:** cloud recognition; training a custom model.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint` in the checkout, with exit 0.

### 8. Ink shadow theatre stage

**Problem:** Visitors cannot turn recognized poses into creatures and useful links.

**Acceptance:** After explicit consent, four poses appear as ink creatures on the paper stage, carry working Projects/Notes links, and Stop releases the camera; reduced motion stays static.

**Interfaces:** app/(site)/(app)/play/shadows/; app/(site)/(app)/play/page.tsx; components/shadows/; e2e/shadows.test.ts

**Actions:**
- Read installed Next client/route guidance; build /play/shadows and its Play entry with a clear pre-consent privacy notice: local processing, no upload or saving, and a Stop control.
- Draw landmark-derived palm/finger ink silhouettes on a paper stage with candle glow; morph matched-point SVG creatures for rabbit, dog, bird and deer, and give each a bounded hop plus a paper tag carrying a Projects or Notes link. Keep semantic anchors below the stage.
- Respect site light/dark styling and reduced motion with static candle and in-place creature swap; never render webcam video or start/fetch model before opt-in.
- Add browser checks for notice-before-permission, each creature via fixture injection, Stop releasing camera, keyboard link access, reduced motion, and absence of frame/network upload.

**Non-goals:** recording; server inference; public camera stream.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run build` in the checkout, with exit 0.

### 9. Drag paper cutout puppets

**Problem:** Visitors without a camera or permission cannot use the theatre.

**Acceptance:** All four cutout puppets can be moved by mouse, touch or keyboard and carry the same links; camera denial or model failure lands in a usable fallback.

**Interfaces:** components/shadows/paper-puppets.tsx; components/shadows/shadows.css; e2e/shadow-puppets.test.ts

**Actions:**
- Add an always-selectable paper cutout mode using the same four creature assets and links, with pointer/touch drag constrained to the stage plus arrow-key movement and visible focus.
- Automatically enter this mode on denial, insecure context, unsupported browser or model failure; offer a mode switch without requesting permission.
- Test pointer and keyboard placement, each failure path, no camera call in cutout mode, touch behavior, and reduced-motion state.

**Non-goals:** requiring camera permission; separate creature artwork.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run build` in the checkout, with exit 0.

### 10. Privacy and regression gate

**Problem:** The new routes need a complete independent regression path and named CI gate coverage.

**Acceptance:** CI names and runs the new privacy, interaction, fallback and share checks; a renamed required test makes gate closure fail, and the complete project checks pass.

**Interfaces:** e2e/bonsai.test.ts; e2e/bonsai-postcard.test.ts; e2e/shadows.test.ts; e2e/shadow-puppets.test.ts; scripts/check-gate-closure.mjs; lib/gate-closure.test.ts

**Actions:**
- Extend e2e for initial zero camera prompts, no cross-origin model/frame requests, opt-in with Chromium fake camera, model/permission denial, four fixture poses, cutout fallback, both link destinations, Bonsai seasonal/prune/postcard paths and reduced motion.
- Name the added e2e tests in scripts/check-gate-closure.mjs and demonstrate the gate rejects a temporarily renamed required test, restoring the tree afterward.
- Run project unit, lint, typecheck, build and browser gates at the delivery SHA; record local fake-device limits, locked model hash and independent browser observations for QA.

**Non-goals:** live camera recognition as CI proof; visitor analytics.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run build`, `node scripts/check-gate-closure.mjs` in the checkout, with exit 0.


## Acceptance

At the delivered SHA, acceptance independently visits both routes in a real browser, exercises a negative control (invalid week, denied camera or malformed model), checks the page and image output, verifies no camera prompt before opt-in and no outbound frame transfer, and cites CI plus deployed SHA. A fake webcam or fixture does not prove natural human pose recognition; the UI remains usable through paper puppets if the model fails. Existing CI production delivery is checked through the site health SHA and the workflow's production job, not a queued job alone.
