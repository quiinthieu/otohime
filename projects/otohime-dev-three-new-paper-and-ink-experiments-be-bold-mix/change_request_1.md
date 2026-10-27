---
plan_id: pm-293
run_id: run-9251
kind: change_request
verdict: fail
cycle: 1
cited_sha: 36ba86a99f78ce93a8972c8e1f4d003242325469
---

# Change request: pm-293, cycle 1

Service: the otohime Next.js app on otohime.dev (one service), deployed at
`36ba86a99f78ce93a8972c8e1f4d003242325469`. The full walkthrough is in
`acceptance_report_1.md`. Everything not listed below passed at 1366×768 and
390×844.

## 1. The Making-of Emaki must show the models that actually ran each role, for plans that actually shipped

**What a visitor still cannot do:** learn, from `/making-of`, which model did
the research, product, engineering and QA work on a shipped plan. The badges
look authoritative but come from a hand-written catalog
(`DEFAULT_PLAN_CATALOG`) and fallback defaults (`DEFAULT_ROLE_MODELS`) in
`lib/making-of.ts`, not from plan/run history.

**Evidence (live, 2026-10-27):**
- pm-293's own scene shows Product Owner `claude-opus-5-5` and QA
  `claude-sonnet-5-5`. The board's runs: run-9229 (PO) ran
  `--model gemini-4-argon-medium`; QA runs run-9237/9244/9249 ran
  `gemini-4-argon-medium`.
- pm-268 shows QA `claude-sonnet-5-5`; all 6 QA runs used `gpt-6-sol`. pm-288
  shows PO `gpt-6.1-sol`; run-9123 used `gpt-6-sol`. pm-288 shows engineer and
  QA models but had no engineer runs.
- 41 of 53 scenes carry exactly the four default models.
- The idea says "each shipped plan becomes a scene". Of the 28 scenes whose
  plan status the board lists, 16 are paused, abandoned or still executing
  (e.g. pm-288, 287, 286, 285, 282, 279, 277, 276, 275 are a single plan-draft
  commit each).

**What done looks like:** each scene's per-role model is the model recorded
for that role's runs on that plan (public model id only). A role that never ran
shows as absent, not as a default. Scenes are limited to plans that shipped,
or are visibly marked when they did not. The data is still a committed,
public-only build-time snapshot, so CI never needs the cluster. A check shows
that a wrong or defaulted model fails.

## 2. A phone player must see the Koi-koi? decision when they form a yaku

**What a visitor still cannot do:** on a 390×844 phone, after tapping a capture
that forms a yaku, see the hanko, the brush "Koi-koi?" and the Koi-koi/Shobu
buttons. They render about 1000 px above the viewport (prompt top −1015 px,
scrollY 1747). The hand is disabled until a decision is made, so the game looks
frozen apart from a small "花見酒 Hanami-zake (5pt)" pill. Reproduced on
otohime.dev and on a local build of the same code. At 1366×768 the prompt is in
view. The "Deal Round N" and match-over banners share the same location above
the table, so they likely have the same reach problem on a phone (not
measured).

**What done looks like:** at 390×844, after a finger capture that forms a
yaku, the prompt and both buttons are inside the viewport (or the page brings
them there and moves focus to them), and the same holds for round-over and
match-over. The aria-live text stays.

## 3. The Daruma board must show the owner's real project states, not invented ones

**What a visitor still cannot do:** trust `/projects`. To populate the
unfinished shelf, t-1674 (`8b0c491`) changed `content/site.ts`:
- Barometer live → `building`
- Structures live → `shelved`, `abandoned: true`, `started 2026-05-12`,
  `lastActivityAt 2026-06-20`
- Design system live → `shelved`, `lastActivityAt 2026-06-01`

Those dates are before the repository existed (first commit 2026-10-17).
Structures was added on 2026-10-21. `/barometer`, `/structures` and
`/design-system` all serve 200 and work. Live `/projects` now prints
"Barometer building", "Structures shelved" and "Design system shelved" in the
default Cartridges view too. The Daruma Kuyo announces it is "retiring 2
abandoned Daruma dolls (Structures, Design system)". Hanafuda's October card
back (from `content/yearly-log.json`) lists both as shipped on 2026-10-21, so
the two experiments contradict each other.

**What done looks like:** project statuses and started/shipped/activity dates
reflect the owner's real history. Live projects keep both eyes and a live
label. The unfinished shelf and Kuyo show only genuinely unfinished or
abandoned work, and show an honest empty state when there is none (the
on-demand ceremony can still be shown with an injected clock or fixture). The
yearly log and the Daruma board agree on what shipped. The ask/peeks indexes
are regenerated if the project text changes.
