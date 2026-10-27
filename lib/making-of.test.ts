import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AREAS_MAX,
  areaOf,
  buildMakingOf,
  buildMakingOfLog,
  clamp01,
  cleanSubject,
  commitUrlFor,
  computeEmakiParallax,
  computeScrollProgress,
  containsPrivateData,
  DEFAULT_PLAN_CATALOG,
  EMPTY_MAKING_OF,
  isShippedPlan,
  MAX_COMMITS_PER_SCENE,
  MAX_SCENES,
  mergeAreas,
  normalizeRoles,
  PLAN_RUN_HISTORY,
  parseMakingOf,
  parsePlanMarkdown,
  ROLE_KEYS,
  ROLE_LABELS,
  readMakingOf,
  SHIPPED_PLAN_IDS,
  SHIPPED_PLAN_REGISTRY,
  sanitizeModelId,
  sanitizePublicText,
  sceneProgressForIndex,
  serializeMakingOf,
  SUBJECT_MAX,
  SUMMARY_MAX,
  splitPrefix,
  stepSceneIndex,
  summarizeAreas,
  TITLE_MAX,
  UNSHIPPED_PLAN_IDS,
  utcDayOf,
  validateMakingOf,
  validateMakingOfLog,
  type MakingOfSnapshot,
} from "./making-of.ts";

const sha = (n: number) => n.toString(16).padStart(40, "0");

test("groups shipped commits by pm-NNN prefix, excludes unshipped plans, and omits roles that did not run", () => {
  assert.equal(SHIPPED_PLAN_IDS.length, 34);
  assert.equal(Object.keys(DEFAULT_PLAN_CATALOG).length, 34);
  for (const unshipped of ["pm-294", "pm-288", "pm-274", "pm-268", "pm-257", "pm-171"]) {
    assert.equal(isShippedPlan(unshipped), false, `${unshipped} must not be marked shipped`);
    assert.equal(UNSHIPPED_PLAN_IDS.includes(unshipped), true);
  }
  // Ground-truth run history for pm-268 records gpt-6-sol for QA while marking the plan unshipped
  assert.equal(PLAN_RUN_HISTORY["pm-268"].roles.quality_engineer, "gpt-6-sol");
  assert.equal(PLAN_RUN_HISTORY["pm-268"].shipped, false);

  const commits = [
    {
      sha: sha(8),
      date: "2026-10-27T18:30:00Z",
      subject: "feat: standalone housekeeping commit without pm prefix",
      paths: ["README.md"],
    },
    {
      sha: sha(7),
      date: "2026-10-27T16:15:00Z",
      subject: "pm-293/t-1675: Build Making-of Emaki handscroll",
      paths: ["app/(site)/(app)/making-of/page.tsx", "lib/making-of.ts", "e2e/making-of.test.ts"],
    },
    {
      sha: sha(6),
      date: "2026-10-27T12:00:00Z",
      subject: "pm-293/t-1673: Build shared yearly shipped digest",
      paths: ["lib/yearly-log.ts", "scripts/yearly-log.ts", "content/yearly-log.json"],
    },
    {
      sha: sha(5),
      date: "2026-10-27T09:00:00Z",
      subject: "pm-288/t-1650: Paused kintsugi experiment (must be excluded)",
      paths: ["lib/kintsugi.ts"],
    },
    {
      sha: sha(4),
      date: "2026-10-26T18:00:00Z",
      subject: "pm-272/t-1610: Add ListenBrainz & Lanyard Pocket presence",
      paths: ["lib/listenbrainz.ts", "app/(site)/_components/pocket.tsx"],
    },
    {
      sha: sha(3),
      date: "2026-10-26T09:45:00Z",
      subject: "pm-268/t-1600: Add Riso Ink Studio (executing unshipped plan, must be excluded)",
      paths: ["app/(site)/(app)/lab/page.tsx", "lib/ink-lab.ts"],
    },
    {
      sha: sha(2),
      date: "2026-10-24T11:00:00Z",
      subject: "pm-255/t-1520: Add Ask console tier probe",
      paths: ["app/api/ask/route.ts"],
    },
    {
      sha: sha(1),
      date: "2026-10-19T08:00:00Z",
      subject: "pm-181/t-1052: Add Shore focus timer",
      paths: ["app/(shore)/page.tsx"],
    },
  ];

  const snapshot = buildMakingOfLog({ commits });
  assert.equal(validateMakingOfLog(snapshot), snapshot);
  // Head reflects newest indexed commit even when that commit has no pm-NNN prefix
  assert.equal(snapshot.head, sha(8));
  // Unshipped plans pm-288 and pm-268 are filtered out; only shipped plans remain
  assert.deepEqual(
    snapshot.scenes.map((s) => s.planId),
    ["pm-293", "pm-272", "pm-255", "pm-181"],
  );

  const pm293 = snapshot.scenes[0];
  assert.equal(pm293.title, "Washi Daruma, Emaki, and Hanafuda");
  assert.equal(pm293.date, "2026-10-27");
  assert.equal(pm293.sha, sha(7).slice(0, 10));
  assert.equal(pm293.commitUrl, commitUrlFor(sha(7)));
  assert.equal(pm293.commitCount, 2);
  assert.deepEqual(pm293.areas, ["app/(site)", "e2e", "lib"]);
  assert.deepEqual(pm293.roles, [
    { role: "research", label: "Researcher", modelId: "claude-sonnet-5-5" },
    { role: "product_owner", label: "Product Owner", modelId: "gemini-4-argon-medium" },
    { role: "software_engineer", label: "Software Engineer", modelId: "gemini-4-argon-high" },
    { role: "quality_engineer", label: "Quality Engineer", modelId: "gemini-4-argon-medium" },
  ]);

  // pm-272 had no research or product_owner run; those roles must be omitted rather than defaulted
  const pm272 = snapshot.scenes[1];
  assert.deepEqual(pm272.roles, [
    { role: "software_engineer", label: "Software Engineer", modelId: "gpt-6.1-sol" },
    { role: "quality_engineer", label: "Quality Engineer", modelId: "gpt-6.1-sol" },
  ]);

  // pm-255 had no research run; research must be omitted
  const pm255 = snapshot.scenes[2];
  assert.deepEqual(pm255.roles, [
    { role: "product_owner", label: "Product Owner", modelId: "claude-haiku-5-5" },
    { role: "software_engineer", label: "Software Engineer", modelId: "claude-opus-5-5" },
    { role: "quality_engineer", label: "Quality Engineer", modelId: "claude-sonnet-5-5" },
  ]);
});

test("public-field sanitization strips emails, tokens, Co-Authored-By trailers, and private paths", () => {
  const dirty =
    "Implement board <quiinthieu@gmail.com> owner@example.org ghp_1234567890abcdef sk-ant-secret987654 /home/avietidol/.local/log.txt postgresql://user:pass@127.0.0.1:5432/db Co-Authored-By: Claude <noreply@anthropic.com>";
  assert.equal(containsPrivateData(dirty), true);
  const sanitized = sanitizePublicText(dirty);
  assert.equal(containsPrivateData(sanitized), false);
  assert.equal(sanitized, "Implement board");

  assert.equal(sanitizeModelId("Claude Opus 5.5"), "claude-opus-5.5");
  assert.equal(sanitizeModelId("owner@example.com"), null);
  assert.equal(sanitizeModelId("ghp_1234567890abcdef"), null);
  assert.equal(sanitizeModelId(""), null);
  assert.equal(sanitizeModelId("owner@example.com", "claude-sonnet-5-5"), "claude-sonnet-5-5");

  // Extra private keys on untrusted commit/plan objects are never copied into the output scene
  const rawCommit = {
    sha: sha(9),
    date: "2026-10-27T10:00:00Z",
    subject: "pm-250/t-1500: Add Ink Desk <secret@example.com> token=abc123456",
    paths: [".agent-artifacts/run-1/commits.txt", "app/(site)/(app)/desk/page.tsx", "lib/desk.ts"],
    authorEmail: "private@example.com",
    privateLog: "/var/log/agent.log",
  };
  const built = buildMakingOf({
    commits: [rawCommit],
    plans: { "pm-250": { title: "Add Ink Desk <secret@example.com>" } },
  });
  assert.equal(built.scenes.length, 1);
  const scene = built.scenes[0];
  assert.equal(scene.title, "Add Ink Desk");
  assert.deepEqual(scene.areas, ["app/(site)", "lib"]);
  assert.equal("authorEmail" in (scene as Record<string, unknown>), false);
  assert.equal("privateLog" in (scene as Record<string, unknown>), false);
  assert.equal(containsPrivateData(serializeMakingOf(built)), false);
});

test("fallback preservation keeps reviewed metadata and older shipped fallback scenes when git history is partial or empty", () => {
  const fallback = buildMakingOf({
    commits: [
      {
        sha: sha(2),
        date: "2026-10-20T12:00:00Z",
        subject: "pm-199/t-1100: Add Orrery",
        paths: ["app/(orrery)/page.tsx"],
      },
      {
        sha: sha(1),
        date: "2026-10-19T12:00:00Z",
        subject: "pm-181/t-1052: Add Shore",
        paths: ["app/(shore)/page.tsx"],
      },
    ],
    plans: {
      "pm-199": {
        title: "Orrery: Solar System Cutaway",
        summary: "Hand-drawn planets and five stars.",
      },
      "pm-181": {
        title: "Shore: Sea-Glass Focus Timer",
        summary: "Tactile Pomodoro timer at /shore.",
      },
    },
  });

  // 1) Empty commits + valid fallback preserves the fallback untouched
  const fromFallbackOnly = buildMakingOf({ commits: [], fallback });
  assert.deepEqual(fromFallbackOnly, fallback);

  // 2) Partial newer commits merge with fallback, updating pm-199 and preserving older pm-181
  const partialCommits = [
    {
      sha: sha(3),
      date: "2026-10-21T15:00:00Z",
      subject: "pm-199/t-1101: Polish Orrery orbits",
      paths: ["app/(orrery)/_lib/orbits.ts", "e2e/orrery.test.ts"],
    },
  ];
  const merged = buildMakingOf({ commits: partialCommits, fallback });
  assert.equal(merged.head, sha(3));
  assert.equal(merged.scenes.length, 2);
  assert.equal(merged.scenes[0].planId, "pm-199");
  assert.equal(merged.scenes[0].sha, sha(3).slice(0, 10));
  assert.equal(merged.scenes[0].date, "2026-10-21");
  // Preserves reviewed title, summary, and ground-truth role model IDs from fallback/registry
  assert.equal(merged.scenes[0].title, "Orrery: Solar System Cutaway");
  assert.equal(merged.scenes[0].summary, "Hand-drawn planets and five stars.");
  assert.equal(merged.scenes[0].roles[0].modelId, "claude-fable-5-1");
  assert.equal(merged.scenes[0].roles[1].modelId, "claude-opus-5-5");
  assert.deepEqual(merged.scenes[0].areas, ["app/(orrery)", "e2e"]);
  // Older pm-181 scene is preserved from fallback
  assert.deepEqual(merged.scenes[1], fallback.scenes[1]);
});

test("parsePlanMarkdown extracts planId, cleaned title, outcome summary, and product_owner model", () => {
  const md1 = `# Capsule: a coin-and-crank card machine (pm-184)

**Product.** Capsule is a capsule-toy machine at \`otohime.dev/capsule\`. You press Insert coin and Turn the crank.
`;
  const parsed1 = parsePlanMarkdown(md1);
  assert.deepEqual(parsed1, {
    planId: "pm-184",
    title: "Capsule: a coin-and-crank card machine",
    summary: "Capsule is a capsule-toy machine at otohime.dev/capsule.",
  });

  const md2 = `# Riso Ink Studio

Plan: **pm-268** · product-owner run: **run-8861**
Run profile observed: **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**.

## Outcome and visitor contract

A visitor can choose a print run from the Pocket console and tune materials at /lab.
`;
  const parsed2 = parsePlanMarkdown(md2);
  assert.deepEqual(parsed2, {
    planId: "pm-268",
    title: "Riso Ink Studio",
    summary: "A visitor can choose a print run from the Pocket console and tune materials at /lab.",
    roles: { product_owner: "gpt-6.1-sol" },
  });

  assert.equal(parsePlanMarkdown("No heading here"), null);
});

test("parallax progress math computes monotonic horizontal translation, layer offsets, and reduced-motion static state", () => {
  assert.equal(clamp01(-0.5), 0);
  assert.equal(clamp01(0.42), 0.42);
  assert.equal(clamp01(1.8), 1);
  assert.equal(clamp01(Number.NaN), 0);

  // Scroll progress math
  assert.equal(
    computeScrollProgress({ scrollY: 100, containerTop: 200, containerHeight: 2200, viewportHeight: 800 }),
    0,
  );
  assert.equal(
    computeScrollProgress({ scrollY: 900, containerTop: 200, containerHeight: 2200, viewportHeight: 800 }),
    0.5,
  );
  assert.equal(
    computeScrollProgress({ scrollY: 2000, containerTop: 200, containerHeight: 2200, viewportHeight: 800 }),
    1,
  );
  assert.equal(
    computeScrollProgress({ scrollY: 500, containerTop: 200, containerHeight: 600, viewportHeight: 800 }),
    0,
  );

  // Parallax at start (0), middle (0.5), and end (1)
  const p0 = computeEmakiParallax({ progress: 0, trackOverflowPx: 2400, sceneCount: 10 });
  const pMid = computeEmakiParallax({ progress: 0.5, trackOverflowPx: 2400, sceneCount: 10 });
  const pEnd = computeEmakiParallax({ progress: 1, trackOverflowPx: 2400, sceneCount: 10 });

  assert.equal(p0.translateXPx, 0);
  assert.equal(p0.cloudOffsetPx, 0);
  assert.equal(p0.pineWaveOffsetPx, 0);
  assert.equal(p0.activeSceneIndex, 0);
  assert.equal(p0.activeRoleIndex, 0);

  assert.equal(pMid.translateXPx, -1200);
  assert.equal(pMid.pineWaveOffsetPx, -660);
  assert.equal(pMid.cloudOffsetPx, -300);
  assert.ok(Math.abs(pMid.cloudOffsetPx) < Math.abs(pMid.pineWaveOffsetPx));
  assert.ok(Math.abs(pMid.pineWaveOffsetPx) < Math.abs(pMid.translateXPx));
  assert.equal(pMid.activeSceneIndex, 5);

  assert.equal(pEnd.translateXPx, -2400);
  assert.equal(pEnd.pineWaveOffsetPx, -1320);
  assert.equal(pEnd.cloudOffsetPx, -600);
  assert.equal(pEnd.activeSceneIndex, 9);
  assert.equal(pEnd.activeRoleIndex, 3);

  // Reduced motion zeroes all translations and phase while keeping activeSceneIndex
  const reduced = computeEmakiParallax({
    progress: 0.5,
    trackOverflowPx: 2400,
    sceneCount: 10,
    reducedMotion: true,
  });
  assert.deepEqual(reduced, {
    progress: 0.5,
    translateXPx: 0,
    cloudOffsetPx: 0,
    pineWaveOffsetPx: 0,
    figurePassPhase: 0,
    activeSceneIndex: 5,
    activeRoleIndex: 0,
  });

  // Keyboard stepping and scene index -> progress mapping
  assert.equal(sceneProgressForIndex(0, 5), 0);
  assert.equal(sceneProgressForIndex(2, 5), 0.5);
  assert.equal(sceneProgressForIndex(4, 5), 1);
  assert.equal(sceneProgressForIndex(0, 1), 0);

  assert.equal(stepSceneIndex(0, "ArrowLeft", 5), 0);
  assert.equal(stepSceneIndex(0, "ArrowRight", 5), 1);
  assert.equal(stepSceneIndex(1, "ArrowDown", 5), 2);
  assert.equal(stepSceneIndex(2, "ArrowUp", 5), 1);
  assert.equal(stepSceneIndex(2, "End", 5), 4);
  assert.equal(stepSceneIndex(4, "ArrowRight", 5), 4);
  assert.equal(stepSceneIndex(4, "Home", 5), 0);
  assert.equal(stepSceneIndex(2, "Enter", 5), null);
});

test("validateMakingOf rejects unshipped plans, wrong/defaulted models, fabricated roles, private leaks, and non-canonical shapes", () => {
  assert.deepEqual(validateMakingOf(EMPTY_MAKING_OF), EMPTY_MAKING_OF);
  const emptyText = serializeMakingOf(EMPTY_MAKING_OF);
  assert.deepEqual(parseMakingOf(emptyText), EMPTY_MAKING_OF);

  const sample = buildMakingOf({
    commits: [
      {
        sha: sha(7),
        date: "2026-10-27T12:00:00Z",
        subject: "pm-293/t-1675: Build Making-of Emaki",
        paths: ["lib/making-of.ts", "app/(site)/(app)/making-of/page.tsx"],
      },
      {
        sha: sha(6),
        date: "2026-10-26T12:00:00Z",
        subject: "pm-272/t-1610: Add ListenBrainz Pocket presence",
        paths: ["lib/listenbrainz.ts"],
      },
    ],
  });
  const text = serializeMakingOf(sample);
  assert.deepEqual(parseMakingOf(text), sample);
  assert.equal(serializeMakingOf(parseMakingOf(text)!), text);

  const clone = (): MakingOfSnapshot => JSON.parse(text) as MakingOfSnapshot;

  const badCases: unknown[] = [
    null,
    [],
    { ...clone(), version: 2 },
    { ...clone(), extra: true },
    { ...clone(), head: null }, // non-empty scenes with null head
    { ...EMPTY_MAKING_OF, head: sha(1) }, // empty scenes with non-null head
    { ...clone(), head: "short-sha" },
    {
      ...clone(),
      scenes: [clone().scenes[0], clone().scenes[0]], // duplicate planId
    },
    (() => {
      const c = clone();
      c.scenes[0].planId = "bad-id";
      return c;
    })(),
    // Negative control: unshipped plans must be rejected by validateMakingOf
    (() => {
      const c = clone();
      c.scenes[0].planId = "pm-288";
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].planId = "pm-268";
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].planId = "pm-171";
      return c;
    })(),
    // Negative control: wrong/defaulted model for pm-293 PO (claude-opus-5-5 instead of gemini-4-argon-medium)
    (() => {
      const c = clone();
      c.scenes[0].roles[1].modelId = "claude-opus-5-5";
      return c;
    })(),
    // Negative control: fabricated role on pm-272 (where research and product_owner did not run)
    (() => {
      const c = clone();
      c.scenes[1].roles = [
        { role: "research", label: "Researcher", modelId: "claude-sonnet-5-5" },
        ...c.scenes[1].roles,
      ];
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].title = "Leak <quiinthieu@gmail.com>";
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].summary = "Token leak ghp_1234567890abcdef";
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].date = "2026-02-30";
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].commitUrl = "https://github.com/quiinthieu/otohime/commit/deadbeef00";
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].commitCount = 0;
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].areas = ["lib", "lib"]; // duplicate area
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].roles = c.scenes[0].roles.slice(0, 3);
      return c;
    })(),
    (() => {
      const c = clone();
      c.scenes[0].roles[0].modelId = "UPPERCASE_MODEL";
      return c;
    })(),
  ];

  badCases.forEach((candidate, i) => {
    assert.equal(validateMakingOf(candidate), null, `bad case ${i} should be rejected`);
  });

  assert.equal(parseMakingOf("{invalid"), null);
  assert.deepEqual(readMakingOf("{invalid"), EMPTY_MAKING_OF);
  assert.equal(ROLE_KEYS.length, 4);
  assert.equal(ROLE_LABELS.software_engineer, "Software Engineer");
  assert.equal(areaOf("app/(site)/(app)/making-of/page.tsx"), "app/(site)");
  assert.equal(summarizeAreas(["a/1", "b/1", "c/1", "d/1"]).length, AREAS_MAX);
  assert.equal(mergeAreas([["a", "b"], ["b", "c", "d"]]).length, AREAS_MAX);
  assert.equal(utcDayOf("2026-10-27T22:00:00Z"), "2026-10-27");
  assert.equal([...cleanSubject("z".repeat(SUBJECT_MAX + 10))].length, SUBJECT_MAX);
  assert.equal(TITLE_MAX, 90);
  assert.equal(SUMMARY_MAX, 160);
  assert.equal(MAX_SCENES, 200);
  assert.equal(MAX_COMMITS_PER_SCENE, 100_000);
  // normalizeRoles omits any role not provided or set to null
  assert.deepEqual(normalizeRoles({ research: "claude-sonnet-5-5", product_owner: null }), [
    { role: "research", label: "Researcher", modelId: "claude-sonnet-5-5" },
  ]);
  assert.equal(Object.keys(SHIPPED_PLAN_REGISTRY).length, 34);
  assert.deepEqual(splitPrefix("pm-293/t-1675: Emaki"), {
    plan: "pm-293",
    task: "t-1675",
    subject: "Emaki",
  });
});
