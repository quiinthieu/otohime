# Research: ten ink-and-watercolour portraits for /sketches (pm-240, run-8296)

**Idea.** A creative-agent prompt: ten original ink-and-watercolour paintings of young women in the style of one Pinterest reference (https://pin.it/4KJro8mYA), each 3:4 portrait, consistent as one sketchbook, delivered as files `01_Quiet_Reader.png` … `10_Letter_Writer.png` with an optional contact sheet.

**Short answer.** The site already has the right home for this: `/sketches` (PR #8, commit 06b5b19) shows twelve Grok Imagine paintings as a two-section gallery. Add the ten portraits as a third section, "People", on that page, with ten JPEGs in `public/sketches/`. Do not add an eighth public page: the pocket console's LCD fits six menu lines and its test enforces that. The pictures themselves cannot come from this repo's code or from the platform's GPU recipe (flux2-klein is a transparent-sprite prototype with sprite gates, and Colab L4 capacity is failing today). They come from an image API. The fleet holds a `grok-main` account whose `.grok/` credential archive is the same vendor the owner used for the first twelve, so the first build task should generate the set through xAI's image API from a lease on that account, with a fallback operator chore (the owner generates from the committed prompt pack, as for PR #8) if the key is not usable within fifteen minutes. Everything below is from the repo at ad778f1, the live platform on 2026-10-25, and the reference image fetched from Pinterest.

## 1. What is there today (ad778f1)

- `app/(site)/(app)/sketches/page.tsx` (64 lines): `FigTitle n="07" hint="places and small things"`, an intro line, two sections (`Places`, `Small things`) of `<figure>` with `next/image` and a title plus one-line note. Width and height are chosen by `sketch.kind` (`place` 1248×832, `object` 1024×1024). `alt=""`, caption carries the words.
- `content/site.ts`: `type Sketch = { src, title, kind: "place" | "object", note }`, `site.sketchesIntro` ("Twelve studies from one sketchbook…"), twelve rows `/sketches/01-cove.jpg` … `/sketches/12-wallet.jpg`.
- `public/sketches/`: twelve JPEGs, 3.8 MB total (280–380 KB each). Every file carries a C2PA manifest whose `claim_generator_info` is **Grok Imagine** (`digitalSourceType trainedAlgorithmicMedia`). So the owner made them in Grok Imagine and opened a GitHub PR (#8, author "Ōtohime", not a plan-manager run).
- `lib/pages.ts` and `lib/pages.test.ts`: `PUBLIC_PAGES` has seven entries, the console menu six. `menuBaseline(i) = -149 + 8i` must stay within the LCD (`y ≥ -150`, `y ≤ -105`), so **six lines is the maximum**; a seventh menu line fails "every console menu line fits inside the LCD". The tests also pin `/sketches` as the seventh page and `site.sketches.length === 12`.
- `e2e/rbac.test.ts:73` walks the seven public paths; `components/handheld.tsx` draws the menu from `CONSOLE_MENU`. No other code reads the sketches.
- Figure numbers in use: 02–07, 09–11. `08` is free, but a third section on 07 needs no number.

## 2. The reference image

`pin.it/4KJro8mYA` → `pinterest.com/pin/248120260716380781/`. Original at `https://i.pinimg.com/originals/41/9a/49/419a49689748e94025c4a9f00d06347b.jpg`, 842×1120 JPEG, 160 KB. Pinterest title "水彩画の木 | 芸者アート, 水彩画のスケッチ, 人物畫", pinner `mnicafloresniev`, description dated 2025/12/05. It is a repin with no artist credit; authorship is unknown, so it is a style reference only and nothing from it may be reproduced.

What it shows (viewed): a young woman in profile facing right, head bowed, reading pages held in both hands; dark hair tied low under a teal-blue headscarf, a large mustard-ochre scarf, an oversized teal coat with white cuffs; energetic black ink contours of varying weight that overshoot and double; loose wet washes in teal and ochre with hard irregular edges, white paper left inside the coat and around the figure; ink splatter; the lower body dissolves into the paper. Palette: teal/cobalt, ochre, black ink, one red accent (lips), off-white paper. The look is "sketch-and-splash" digital ink-and-watercolour rather than scanned paper: no paper grain, no sketchbook edge.

Two consequences:

1. **Concept 1 collides with the reference.** "The Quiet Reader: loosely tied dark hair, oversized teal-blue coat, warm ochre scarf, reading a book, head tilted down" is the reference image. The brief also says not to duplicate the reference's subject or composition. Keep the concept and its palette but change the pose: seated, three-quarter view from the front, book held low in her lap, no headscarf, hair loose. Record this in the plan.
2. **Style fit with the existing twelve.** The current sketches are quieter: cream paper with a visible sketchbook edge, soft granulating washes, thin even pen lines. The portraits should keep the reference's bolder ink and white paper (that is the request) but use the same off-white paper tone (`#faf8f3`, the site's `--field`) so the three sections read as one book. Put the paper tone in the shared style block.

## 3. Where the pictures can come from

### 3a. Platform GPU recipe flux2-klein: not viable for this plan

`task_manager_describe_task_types` lists `flux2-klein` (16384 MiB, L4/T4). pm-238 (mono-v2, done) built it as **"FLUX.2-klein RGBA game assets, phase 1 of 4"**: the runner is `rlab/generate/runners/flux2_klein_run.py` with a HUD/sprite brief (`items × states`, a flat "plate" background prompt), RGBA control-image preprocessing, extract/matte/chroma alpha post-passes, `reference-colour/1` and silhouette-IoU gates, a 16-image cap per task, references resized to 768 long side, `max_minutes 45`, uploads through media-generator with an operator JWT from `POST /iam/public/api/v1/auth/login`, and its own CLI `lessons/research_lab/scripts/submit_flux2_klein_run.py`. Its one real success (task `d1982c2a`, 2026-10-25 02:39Z, Colab L4, 6.4 min, 0.11 CU) is a 64×64 goblin sprite. Phase-1 non-goals forbid new brief types, and a painting on paper would be matted to transparency and fail the sprite gates. Making it paint portraits is a mono-v2 change (new brief kind, RGB output path, no alpha), which does not belong in an otohime plan. Capacity is also the worst on the board today: `generation_task queue_ttl_exceeded 1h` ×47 (iss-142), 62 identical `colab_launch_failed` sessions, every pending asset-review task today sits on `tier_skips colab:colab_launch_failed`, and no fleet machine proves 16 GB of VRAM (`avietidol-z490` reports a `gpu` capability but no `vram_mb`).

### 3b. xAI image API from a coding lease (recommended first route)

`task_manager_list_accounts` shows `grok-main` (provider `grok`, `credential_secret ai-creds`, `credential_kind archive`, `credential_path_prefix .grok/`, enabled, active, `repos: []`, last ok 2026-10-12). `billie-mac` and `viet-mac` advertise `agent-cli:grok`. The Grok CLI keeps its xAI API key in that `.grok/` directory (`user-settings.json`), and xAI's image API (`grok-imagine-image`, with `grok-imagine-image-quality` as the higher tier) serves the same Grok Imagine family that made the first twelve. Third-party docs put a standard image at about $0.02 and a quality image at $0.05–0.07; thirty candidates cost under $3. Editing (reference images) is a multipart endpoint with up to three source images; references sent to the text-to-image endpoint are ignored. Verify against xAI's own docs on the lease; the search results disagree on the quality tier's price.

What the first task must do: (1) the product owner binds `grok-main` to the `otohime` repo (`task_manager_set_account_repos`) or the task is pinned to that account; (2) the SWE task, on a lease holding that account, confirms the key with one cheap text-to-image call, then runs a small Node script (`scripts/sketches-paint.ts`, `node --experimental-strip-types` like the other scripts) that reads the prompt pack, calls the API for each concept at 3:4 (request 1536×2048 if the model offers it, else the largest 3:4 size), with the reference sent through the edit endpoint as a style source where that works and plain text-to-image otherwise, saves candidates to a scratch directory, and writes a contact sheet; (3) the agent views every candidate (an image read is enough) and keeps one per concept; (4) it converts the keepers to 1152×1536 JPEG quality 82 under `public/sketches/`. If the key is missing or refused, the task does not retry: it commits the prompt pack and calls `plan_manager_ask_user kind=operator_action` (fingerprint `generate-portraits:grok-imagine`) asking the owner to generate the ten from the pack and open a PR like #8, then ends.

Generating pictures of people is ordinary illustration work; no real person is depicted and the brief asks for original characters.

### 3c. Owner generates in Grok Imagine (fallback, operator chore)

Exactly what PR #8 did. The plan's value then is the prompt pack, the page and the checks. A chore nobody answers is decided by the platform after ten minutes, so the task must never wait on it: it ships the pack and the page, parks, and a follow-up task adds the files.

### 3d. Rejected

- Drawing the portraits as path data with rough.js like Capsule and Orrery: the request is watercolour paintings; code cannot reach that look.
- A hosted FLUX.2 klein endpoint (Vercel AI Gateway, fal): would need a new paid account the platform does not hold.
- Committing 1536×2048 PNG masters: 3–5 MB each, 40 MB in git for no visible gain over `next/image` output. Keep masters out of the repo; the site stores JPEG derivatives, as the first twelve do.

## 4. Site integration

- **No new page.** Add a `People` section to `/sketches`. Change the hint to `"places, small things and people"` and the intro to cover twenty-two studies. `FigTitle` stays `07`.
- **Content.** Extend `Sketch.kind` with `"person"`; add ten rows `/sketches/13-reader.jpg` … `/sketches/22-letter.jpg` (continuing the numbering; one word per subject, like the existing `07-cup`). The `Sheet` component picks `width 1152, height 1536` for `person`. Grid: `sm:grid-cols-2 md:grid-cols-3` like Small things; portraits are tall, so three across at desktop is right.
- **Tests.** `lib/pages.test.ts`: `site.sketches.length` 12 → 22, plus `ten of them are people`, every `src` starts with `/sketches/`, titles unique. Add `scripts/sketches-check.ts` (`npm run sketches:check`): every `site.sketches[].src` exists under `public/`, the ten `person` files are JPEG, exactly 3:4 within one pixel, 1152×1536, under 600 KB, no two share a sha256. It is cheap and keeps a missing file from reaching the deploy. `e2e/rbac.test.ts` needs no change.
- **README.** One line under `app/(site)/(app)/` for the third section and the check script.
- **Words.** Title and note per painting, in the site's voice (one short line, no adjectives for the picture). Drafts:

| file | title | note |
|---|---|---|
| 13-reader.jpg | Reader | Page forty, and the kettle can wait. |
| 14-flowers.jpg | Wildflowers | Picked on the way, for no one in particular. |
| 15-rain.jpg | Rain | A clear umbrella keeps the sky in view. |
| 16-cafe.jpg | Café | The cup went cold while she was elsewhere. |
| 17-leaves.jpg | Leaves | The wind had the last word. |
| 18-violin.jpg | Violin | Eyes closed, the hard bar coming up. |
| 19-window.jpg | Window | Tea, and a street that is not awake yet. |
| 20-painter.jpg | Painter | Cobalt on the sleeve, as usual. |
| 21-breeze.jpg | Breeze | Hair across her face, one stem held still. |
| 22-letter.jpg | Letter | Three lines in, and already a second sheet. |

- **Captions and alt.** Keep `alt=""` with the figcaption as the text, as now.
- **Contact sheet.** Optional in the brief; produce it in the scratch directory for review and attach it to the QA report. Do not commit it.

## 5. Prompt pack

Commit it as `projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md` so the API script, the owner and QA read the same words. Shared style block, used verbatim before every concept:

> Expressive hand-drawn ink and watercolour illustration of one young adult woman, in the manner of a quick sketchbook study. Energetic black ink contours of varying weight, confident minimal strokes for the face, overlapping and overshooting lines, a few scribbles and unfinished passages. Loose transparent watercolour washes with concentrated pigment in places, hard irregular wet edges, granulation, bleeding, small splatters. Clothing, hair and fabric folds handled impressionistically; large areas left as bare off-white paper (#faf8f3); contours dissolve into the paper toward the bottom. Restrained palette of three to five colours with saturated accents against pale washes and deep ink black. Asymmetrical editorial composition, portrait 3:4, no border, no text, no watermark, no signature. Not: polished digital painting, anime rendering, photorealism, clean uniform outlines, detailed background, paper grain, sketchbook spine.

Per concept (pose, view, palette, focal point). Each reads as "Subject: …" after the block.

1. **Reader.** Seated, three-quarter view from the front, book held low in her lap, head tilted down, hair loosely tied and partly loose; oversized teal-blue coat, warm ochre scarf; palette teal, ochre, ink, a touch of red. Focal: the hands on the book. (Changed from the brief's profile so it is not the reference.)
2. **Wildflowers.** Standing, body turned left, face toward the viewer, messy low bun; loose cream blouse, muted burgundy skirt; small bouquet of wildflowers held at chest height; palette burgundy, cream, sap green, a yellow accent. Focal: the bouquet against the blouse.
3. **Rain.** Full profile facing left, shoulder-length black hair, chin slightly lifted; moss-green trench coat, mustard scarf; a transparent umbrella drawn as a few arcs, rain as diagonal dry strokes; palette moss, mustard, grey wash. Focal: the face under the umbrella's edge.
4. **Café.** Seated at a table, chin on one hand, elbow on the table, elegant short bob; dark navy cardigan over an ivory blouse; one coffee cup, nothing else on the table; palette navy, ivory, a warm brown; the far side of the table left blank. Focal: the eyes, looking past the viewer.
5. **Leaves.** Walking, three-quarter from behind, head turned back over her shoulder, long hair streaming; rust-red overcoat, charcoal skirt; six or seven leaves drawn as single strokes around her; palette rust, charcoal, ochre. Focal: the turn of the head.
6. **Violin.** Standing, three-quarter, eyes closed, relaxed updo; flowing midnight-blue dress; violin under the chin, bow mid-stroke; palette midnight blue, warm wood brown, ink. Focal: the bow hand.
7. **Window.** Seated on a sill in profile, knees drawn up, loosely braided hair; pale lavender sweater, soft grey trousers; a cup of tea held in both hands; the window as two vertical lines and a pale wash of light; palette lavender, grey, a warm yellow wash. Focal: the cup and the light on her face.
8. **Painter.** Three-quarter view, messy ponytail, looking down at a brush in one hand and a small palette in the other; white shirt under a cobalt-blue work jacket; a splash of cobalt on the sleeve; palette cobalt, white, a few palette daubs. Focal: the brush tip.
9. **Breeze.** Frontal, hair blowing across her face hiding one eye, a single flower held up near her shoulder; flowing sage-green dress, pale blush-pink shawl; palette sage, blush, ink. Focal: the visible eye.
10. **Letter.** Seated at a small wooden table seen from a high three-quarter angle, head bent, loosely pinned hair with strands falling; warm brown cardigan, muted blue skirt; a pen and one sheet, a second sheet beside it; palette brown, muted blue, ochre table. Focal: the writing hand.

Generation settings: three to four candidates per concept at different seeds (thirty to forty images), one reference pass with the Pinterest image only if the edit endpoint accepts a style reference without copying it; otherwise text only. Keep the seed and prompt per kept image in `prompts.md` so a regeneration is reproducible.

## 6. Quality review

Each kept image passes a human-style viewing by the agent and then by QA, against the brief's own list: ink lines vary in weight and overshoot; washes have hard irregular edges and bare paper; hands have five fingers and faces are proportionate; one woman only; no text, border, watermark or signature; the palette holds to three to five colours; the pose differs from every other kept image and from the reference. The automated part is `sketches:check` (section 4). Any candidate that is glossy, anime-like, photographic, or has a detailed background is dropped and regenerated with the seed noted.

## 7. Suggested split

1. **Paint the set (SWE, required QA).** Prompt pack committed; `scripts/sketches-paint.ts` with a hermetic test against a fake HTTP server (scrub proxy env, see lessons); real run on a lease holding `grok-main`; ten JPEGs under `public/sketches/`; `sketches:check` script and script test. Verification: the unit tests, `npm run sketches:check` exit 0 with ten `person` files, a committed `prompts.md` with a seed per file. If the key is unusable: pack and script committed, operator chore raised with the exact drop-off (`public/sketches/13-reader.jpg` … `22-letter.jpg`, 1152×1536 JPEG), task ends without the images and names them as missing.
2. **Show the set (SWE, required QA).** `content/site.ts` rows and intro, `Sketch.kind "person"`, the third section, `Sheet` sizes, `lib/pages.test.ts` updates, README line. Verification: `npm test`, `npm run typecheck`, `npm run lint`, a production build, and a walk of `/sketches` that counts twenty-two `<figure>` elements and ten `img` with `width="1152"`. QA views the page at 1366×768 and 390×844 and the ten images at full size.

Task 2 can be built first with the fixture images, but its QA cannot pass without the real ten, so order them 1 then 2, with task 2 depending on task 1's files.

## 8. Risks

- **The grok-main key.** Nobody has used the account since 2026-10-12, its `.grok/` archive may hold an OAuth login for the CLI rather than an API key, and it is bound to no repo. The first task finds out in one call; the fallback is the chore in 3c.
- **Style drift across the ten.** One shared block and one model keep it close; the agent should drop any candidate that reads as a different hand. Expect two rounds.
- **Reference copying.** If the edit endpoint reproduces the reference's pose or face, use text-only generation; the viewing step must compare each kept image with the reference.
- **Payload size.** Ten JPEGs at about 400 KB add 4 MB to the repo, the same as PR #8. Fine. No PNG masters.
- **Lease OS.** The paint script must run on the lease holding the account (a Mac), so use Node only, no ImageMagick; resizing can use `sharp` as a dev dependency or the `next/image` sharp already in `node_modules`.

## Sources

- Reference pin: https://www.pinterest.com/pin/248120260716380781/ (image https://i.pinimg.com/originals/41/9a/49/419a49689748e94025c4a9f00d06347b.jpg)
- Black Forest Labs, FLUX.2 [klein]: https://bfl.ai/blog/flux2-klein-towards-interactive-visual-intelligence
- Vercel AI Gateway, flux-2-klein-4b FAQ (licence): https://vercel.com/ai-gateway/models/flux-2-klein-4b/faq
- xAI image editing capabilities (third party): https://www.atlascloud.ai/blog/case-studies/grok-xai-image-editing-capabilities
- Grok Imagine Image 2.0 launch note (third party): https://docs.apiyi.com/en/live/2026-08/grok-imagine-2-launch
- pm-238 acceptance report rep-4702 and research rep-4620 (plan-manager), task `d1982c2a-b49e-47c2-82b2-c57a32bd5540` (task-manager)
