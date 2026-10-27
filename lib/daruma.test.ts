import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../content/site.ts";
import rawYearlyLog from "../content/yearly-log.json" with { type: "json" };
import {
  ABANDONED_DAYS_THRESHOLD,
  classifyDaruma,
  computeEyeState,
  DAY_MS,
  daysSince,
  DEFAULT_NOW_MS,
  EYE_STROKE_LENGTH,
  formatKuyoAnnouncement,
  formatUnfinishedEmptyState,
  groupDarumaShelves,
  isKuyoSeason,
  isProjectAbandoned,
  KUYO_DEMO_FIXTURES,
  normalizeUtcDay,
  parseClockParam,
  parseDarumaViewParam,
  parseFixtureParam,
  parseKuyoParam,
  parseUtcMs,
  resolveDarumaFixtureProjects,
  resolveNowMs,
  type DarumaProjectInput,
} from "./daruma.ts";

test("computeEyeState and classifyDaruma classify none, left, and both eyes with stroke-dashoffset values", () => {
  const unstarted: DarumaProjectInput = {
    title: "Blank Doll",
    note: "Waiting on the shelf.",
    status: "shelved",
    lastActivityAt: "2026-10-20",
  };
  const startedOnly: DarumaProjectInput = {
    title: "One-Eyed Doll",
    note: "Work underway.",
    status: "building",
    started: "2026-10-10",
    lastActivityAt: "2026-10-25",
  };
  const shippedProject: DarumaProjectInput = {
    title: "Two-Eyed Doll",
    note: "Shipped and complete.",
    href: "/shore",
    status: "live",
    started: "2026-10-01",
    shipped: "2026-10-19",
    lastActivityAt: "2026-10-25",
  };

  assert.equal(computeEyeState(unstarted), "none");
  assert.equal(computeEyeState(startedOnly), "left");
  assert.equal(computeEyeState(shippedProject), "both");

  const cNone = classifyDaruma(unstarted, "2026-10-27");
  assert.equal(cNone.eyeState, "none");
  assert.equal(cNone.leftEyePainted, false);
  assert.equal(cNone.rightEyePainted, false);
  assert.equal(cNone.leftEyeDashoffset, EYE_STROKE_LENGTH);
  assert.equal(cNone.rightEyeDashoffset, EYE_STROKE_LENGTH);
  assert.equal(cNone.shelf, "unfinished");
  assert.equal(cNone.unfinished, true);

  const cLeft = classifyDaruma(startedOnly, "2026-10-27");
  assert.equal(cLeft.eyeState, "left");
  assert.equal(cLeft.leftEyePainted, true);
  assert.equal(cLeft.rightEyePainted, false);
  assert.equal(cLeft.leftEyeDashoffset, 0);
  assert.equal(cLeft.rightEyeDashoffset, EYE_STROKE_LENGTH);
  assert.equal(cLeft.shelf, "active");
  assert.equal(cLeft.unfinished, true);
  assert.equal(cLeft.abandoned, false);

  const cBoth = classifyDaruma(shippedProject, "2026-10-27");
  assert.equal(cBoth.eyeState, "both");
  assert.equal(cBoth.leftEyePainted, true);
  assert.equal(cBoth.rightEyePainted, true);
  assert.equal(cBoth.leftEyeDashoffset, 0);
  assert.equal(cBoth.rightEyeDashoffset, 0);
  assert.equal(cBoth.shelf, "shipped");
  assert.equal(cBoth.unfinished, false);
  assert.equal(cBoth.abandoned, false);
});

test("90-day inactivity default marks unshipped projects abandoned at >= 90 days and spares active or shipped projects", () => {
  const startMs = Date.UTC(2026, 4, 1); // 2026-05-01
  const project: DarumaProjectInput = {
    title: "Long Quiet Doll",
    note: "Paused mid-build.",
    status: "building",
    started: "2026-05-01",
    lastActivityAt: "2026-05-01",
  };

  const day89 = startMs + (ABANDONED_DAYS_THRESHOLD - 1) * DAY_MS;
  assert.equal(daysSince(project.lastActivityAt, day89), 89);
  assert.equal(isProjectAbandoned(project, day89), false);
  assert.equal(classifyDaruma(project, day89).shelf, "active");

  const day90 = startMs + ABANDONED_DAYS_THRESHOLD * DAY_MS;
  assert.equal(daysSince(project.lastActivityAt, day90), 90);
  assert.equal(isProjectAbandoned(project, day90), true);
  const at90 = classifyDaruma(project, day90);
  assert.equal(at90.abandoned, true);
  assert.equal(at90.shelf, "unfinished");
  assert.equal(at90.unfinished, true);

  // Negative control: shipped projects are never marked abandoned by 90-day inactivity
  const shippedOld: DarumaProjectInput = {
    title: "Stable Shipped Doll",
    note: "Done months ago.",
    status: "live",
    started: "2026-01-10",
    shipped: "2026-02-01",
    lastActivityAt: "2026-02-01",
  };
  assert.equal(isProjectAbandoned(shippedOld, "2026-10-27"), false);
  assert.equal(classifyDaruma(shippedOld, "2026-10-27").shelf, "shipped");

  // Explicit abandoned flag overrides recency
  const explicitAbandoned: DarumaProjectInput = {
    title: "Explicitly Retired",
    note: "Put aside.",
    status: "shelved",
    started: "2026-10-15",
    lastActivityAt: "2026-10-20",
    abandoned: true,
  };
  assert.equal(isProjectAbandoned(explicitAbandoned, "2026-10-27"), true);

  // Explicit abandoned: false prevents 90-day default
  const keptAlive: DarumaProjectInput = {
    ...project,
    abandoned: false,
  };
  assert.equal(isProjectAbandoned(keptAlive, day90), false);
});

test("injectable clock and ?kuyo=1 / toggle override control the Daruma Kuyo ceremony and shelf grouping", () => {
  const octClock = () => "2026-10-27T12:00:00Z";
  const decClock = () => new Date("2026-12-20T00:00:00Z");

  assert.equal(isKuyoSeason(octClock, false), false);
  assert.equal(isKuyoSeason(octClock, "?kuyo=1"), true);
  assert.equal(isKuyoSeason(octClock, true), true);
  assert.equal(isKuyoSeason(decClock, false), true);

  assert.equal(parseKuyoParam("1"), true);
  assert.equal(parseKuyoParam("?kuyo=1"), true);
  assert.equal(parseKuyoParam(new URLSearchParams("view=daruma&kuyo=1")), true);
  assert.equal(parseKuyoParam("0"), false);
  assert.equal(parseKuyoParam(null), false);

  assert.equal(parseDarumaViewParam("?kuyo=1"), "daruma");
  assert.equal(parseDarumaViewParam("?view=daruma"), "daruma");
  assert.equal(parseDarumaViewParam("?view=cartridges"), "cartridges");
  assert.equal(parseDarumaViewParam(""), "cartridges");

  assert.equal(parseClockParam("?now=2026-12-25"), Date.UTC(2026, 11, 25));
  assert.equal(parseClockParam("?clock=2026-12-31"), Date.UTC(2026, 11, 31));
  assert.equal(parseUtcMs("2026-02-30"), null);
  assert.equal(normalizeUtcDay("2026-10-19T15:20:00Z"), "2026-10-19");
  assert.equal(resolveNowMs(undefined), DEFAULT_NOW_MS);

  const sample: DarumaProjectInput[] = [
    {
      title: "Shipped A",
      note: "Live.",
      status: "live",
      started: "2026-10-01",
      shipped: "2026-10-19",
    },
    {
      title: "Active B",
      note: "Building.",
      status: "building",
      started: "2026-10-15",
      lastActivityAt: "2026-10-25",
    },
    {
      title: "Abandoned C",
      note: "Dormant for 120 days.",
      status: "shelved",
      started: "2026-05-01",
      lastActivityAt: "2026-06-01",
    },
  ];

  const octShelves = groupDarumaShelves(sample, { now: octClock, kuyo: false });
  assert.equal(octShelves.kuyoActive, false);
  assert.equal(octShelves.shipped.length, 1);
  assert.equal(octShelves.active.length, 1);
  assert.equal(octShelves.unfinished.length, 2);
  assert.equal(octShelves.abandoned.length, 1);
  assert.equal(octShelves.kuyoRetiring.length, 0);
  assert.match(formatKuyoAnnouncement(octShelves), /at rest.*1 abandoned Daruma doll waits/);

  const kuyoOverrideShelves = groupDarumaShelves(sample, { now: octClock, kuyo: "?kuyo=1" });
  assert.equal(kuyoOverrideShelves.kuyoActive, true);
  assert.equal(kuyoOverrideShelves.kuyoRetiring.length, 1);
  assert.equal(kuyoOverrideShelves.kuyoRetiring[0].project.title, "Abandoned C");
  assert.match(
    formatKuyoAnnouncement(kuyoOverrideShelves),
    /Daruma Kuyo ink-fire ceremony lit: retiring 1 abandoned Daruma doll \(Abandoned C\)/,
  );

  // Advancing injected clock to December lights Kuyo automatically without ?kuyo=1
  const decShelves = groupDarumaShelves(sample, decClock, false);
  assert.equal(decShelves.kuyoActive, true);
  assert.equal(decShelves.kuyoRetiring.length, 1);

  // Advancing injected clock by 100 days from October makes Active B also cross the 90-day abandonment threshold
  const futureShelves = groupDarumaShelves(sample, "2027-02-15", false);
  assert.equal(futureShelves.abandoned.length, 2);
});

test("site.projectList reflects all 11 live October 2026 shipped projects in sync with content/yearly-log.json and shows an honest empty unfinished shelf by default", () => {
  assert.equal(site.projectList.length, 11);
  for (const project of site.projectList) {
    assert.equal(project.status, "live", `${project.title} should have status: 'live'`);
    assert.notEqual(project.abandoned, true, `${project.title} must not be marked abandoned`);
    assert.notEqual(project.demoFixture, true, `${project.title} must not be a demo fixture`);
    assert.match(project.started ?? "", /^2026-10-(1[789]|2\d)$/, `${project.title} started date must be real Oct 2026`);
    assert.match(project.shipped ?? "", /^2026-10-(1[789]|2\d)$/, `${project.title} shipped date must be real Oct 2026`);
    assert.match(
      project.lastActivityAt ?? "",
      /^2026-10-(1[789]|2\d)$/,
      `${project.title} lastActivityAt date must be real Oct 2026`,
    );
  }

  assert.deepEqual(
    rawYearlyLog.months["10"].shippedProjects,
    site.projectList.map((p) => ({
      title: p.title,
      href: p.href,
      shipped: p.shipped,
    })),
  );
  assert.deepEqual(rawYearlyLog.months["05"].shippedProjects, []);
  assert.deepEqual(rawYearlyLog.months["06"].shippedProjects, []);

  const defaultShelves = groupDarumaShelves(site.projectList, "2026-10-27", false);
  assert.equal(defaultShelves.all.length, 11);
  assert.equal(defaultShelves.shipped.length, 11);
  assert.equal(defaultShelves.active.length, 0);
  assert.equal(defaultShelves.unfinished.length, 0);
  assert.equal(defaultShelves.incomplete.length, 0);
  assert.equal(defaultShelves.abandoned.length, 0);
  assert.equal(defaultShelves.kuyoRetiring.length, 0);
  assert.equal(defaultShelves.fixtureActive, false);
  assert.equal(
    formatUnfinishedEmptyState(defaultShelves.shipped.length),
    "All 11 current projects have shipped — every Daruma doll has both eyes painted.",
  );
  assert.equal(
    formatKuyoAnnouncement(defaultShelves),
    "Daruma Kuyo fire is at rest. No abandoned dolls on the shelf.",
  );

  for (const item of defaultShelves.all) {
    assert.equal(item.eyeState, "both");
    assert.equal(item.leftEyeDashoffset, 0);
    assert.equal(item.rightEyeDashoffset, 0);
    assert.equal(item.abandoned, false);
    assert.equal(item.retiringInKuyo, false);
  }

  const defaultLitShelves = groupDarumaShelves(site.projectList, "2026-10-27", true);
  assert.equal(defaultLitShelves.kuyoActive, true);
  assert.equal(defaultLitShelves.kuyoRetiring.length, 0);
  assert.equal(
    formatKuyoAnnouncement(defaultLitShelves),
    "Daruma Kuyo ink-fire ceremony lit: no abandoned Daruma dolls to retire.",
  );
});

test("opt-in ?fixture=kuyo and custom fixture overrides load clearly labeled demo unfinished and abandoned dolls without misreporting live projects", () => {
  assert.equal(parseFixtureParam("kuyo"), true);
  assert.equal(parseFixtureParam("?fixture=kuyo"), true);
  assert.equal(parseFixtureParam(new URLSearchParams("view=daruma&fixture=kuyo")), true);
  assert.equal(parseFixtureParam(true), true);
  assert.equal(parseFixtureParam("0"), false);
  assert.equal(parseFixtureParam(null), false);

  assert.equal(parseDarumaViewParam("?fixture=kuyo"), "daruma");
  assert.equal(parseDarumaViewParam("?fixture=kuyo&view=cartridges"), "cartridges");
  assert.equal(resolveDarumaFixtureProjects("kuyo").length, KUYO_DEMO_FIXTURES.length);

  const fixtureShelves = groupDarumaShelves(site.projectList, {
    now: "2026-10-27",
    fixture: "kuyo",
    kuyo: true,
  });
  assert.equal(fixtureShelves.fixtureActive, true);
  assert.equal(fixtureShelves.shipped.length, 11);
  assert.equal(fixtureShelves.active.length, 1);
  assert.equal(fixtureShelves.unfinished.length, 3);
  assert.equal(fixtureShelves.incomplete.length, 3);
  assert.equal(fixtureShelves.abandoned.length, 2);
  assert.equal(fixtureShelves.kuyoRetiring.length, 2);

  // Live projects remain untouched on the shipped shelf
  for (const item of fixtureShelves.shipped) {
    assert.equal(item.demoFixture, false);
    assert.equal(item.project.status, "live");
    assert.equal(item.eyeState, "both");
  }

  // Unfinished shelf contains only demo fixture items with no live route hrefs
  for (const item of fixtureShelves.unfinished) {
    assert.equal(item.demoFixture, true);
    assert.equal(item.project.href, undefined);
  }

  const eyeStates = new Set(fixtureShelves.all.map((d) => d.eyeState));
  assert.deepEqual(eyeStates, new Set(["both", "left", "none"]));
  assert.match(
    formatKuyoAnnouncement(fixtureShelves),
    /Daruma Kuyo ink-fire ceremony lit: retiring 2 abandoned Daruma dolls \(Demo: Winter Sketchbook, Demo: Unturned Ledger\) in sumi ink flames\./,
  );

  // Custom window.__DARUMA_FIXTURES__ array override
  const customFixtures: DarumaProjectInput[] = [
    {
      title: "Custom Demo Doll",
      note: "Injected via window.__DARUMA_FIXTURES__.",
      status: "shelved",
      started: "2026-04-01",
      lastActivityAt: "2026-05-01",
      abandoned: true,
    },
  ];
  const customShelves = groupDarumaShelves(site.projectList, {
    now: "2026-10-27",
    fixtures: customFixtures,
    kuyo: true,
  });
  assert.equal(customShelves.fixtureActive, true);
  assert.equal(customShelves.unfinished.length, 1);
  assert.equal(customShelves.unfinished[0].demoFixture, true);
  assert.equal(customShelves.kuyoRetiring.length, 1);
  assert.equal(customShelves.kuyoRetiring[0].project.title, "Custom Demo Doll");
});
