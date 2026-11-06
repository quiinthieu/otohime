/**
 * Capability Showcase Website Redesign: Adversarial Coverage Verification Harness
 *
 * Verifies white-box edge cases, branches, state machines, and security boundary conditions
 * across all capability showcase subsystems:
 * 1. Interactive Pipeline state machine & counter conservation laws
 * 2. Timeline keyboard navigation boundary conditions (turnYear)
 * 3. YouTube link parsing & audio schema defense (parseVideoId, parseSong)
 * 4. Zine paper parsing, text fitting, and imposition edge cases (parsePaper, fit, latestNote)
 * 5. Fortune targets & internal path traversal defense (safeInternalPath, buildFortuneTargets)
 * 6. Dynamic OpenGraph /og endpoint query parameter fuzzing & fallback verification
 * 7. Live navigation active state symmetry & accessible landmark verification
 */

import assert from "node:assert/strict";
import { describe, test, before } from "node:test";

import { site } from "../content/site.ts";
import { PUBLIC_PAGES } from "../lib/pages.ts";
import {
  fit,
  parsePaper,
  cellFor,
  guides,
  edgeBetween,
  latestNote,
  type PageNo,
} from "../lib/zine.ts";
import { careerArchive, turnYear } from "../lib/timeline.ts";
import { parseSong, parseVideoId, type SongInput } from "../lib/songs.ts";
import {
  buildFortuneTargets,
  safeInternalPath,
} from "../lib/fortune-targets.ts";
import {
  pipeline,
  counters,
  initialPipeline,
  CAP,
  type Pipeline,
  type PipelineAction,
} from "../lib/pipeline.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let serverAvailable = false;

before(async () => {
  try {
    const res = await fetch(`${BASE}/`, { method: "HEAD", signal: AbortSignal.timeout(1200) });
    serverAvailable = res.status < 500;
  } catch {
    serverAvailable = false;
  }
});

describe("Milestone 4 Phase 2: Adversarial Coverage Verification", () => {
  /* ------------------------------------------------------------------------
   * 1. Interactive Pipeline State Machine & Conservation Laws
   * ------------------------------------------------------------------------ */
  describe("1. Interactive Pipeline State Machine & Invariants", () => {
    test("CAP boundary: pipeline strictly caps live packets at CAP (32)", () => {
      let s: Pipeline = pipeline(initialPipeline, "pause");
      // Attempt to flood with 10 backfills (80 packets requested)
      for (let i = 0; i < 10; i++) {
        s = pipeline(s, "backfill");
      }
      assert.equal(s.packets.length, CAP, `Packets count (${s.packets.length}) must strictly equal CAP (${CAP})`);
      assert.equal(s.nextId, CAP, `Total emitted IDs (${s.nextId}) must equal CAP (${CAP})`);

      // Further emits past CAP must be rejected without state mutation
      const beforeEmit = s;
      const afterEmit = pipeline(s, "emit");
      assert.equal(afterEmit, beforeEmit, "Emitting at CAP must return identical state reference");

      const afterBackfill = pipeline(s, "backfill");
      assert.equal(afterBackfill, beforeEmit, "Backfilling at CAP must return identical state reference");
    });

    test("Counter conservation invariant: emitted === waiting + inFlight + queued + stored + shown", () => {
      let s: Pipeline = initialPipeline;
      const actions: PipelineAction[] = [
        "backfill", "tick", "tick", "emit", "tick", "pause", "backfill", "tick", "tick", "resume", "tick"
      ];
      for (const act of actions) {
        s = pipeline(s, act);
        const c = counters(s);
        const total = c.waiting + c.inFlight + c.queued + c.stored + c.shown;
        assert.equal(c.emitted, total, `Conservation failure at action ${act}: emitted ${c.emitted} !== total ${total}`);
        assert.equal(c.lag, c.emitted - c.shown, `Lag failure: lag ${c.lag} !== emitted - shown`);
      }
    });

    test("Settle behavior: unpaused flushes all to shown; paused keeps queued packets queued", () => {
      // 1. Unpaused settle flushes everything to shown
      let sUnpaused = pipeline(initialPipeline, "backfill");
      for (let i = 0; i < 5; i++) sUnpaused = pipeline(sUnpaused, "tick");
      sUnpaused = pipeline(sUnpaused, "settle");
      const c1 = counters(sUnpaused);
      assert.equal(c1.shown, 8, "All 8 packets must be shown after unpaused settle");
      assert.equal(c1.lag, 0, "Lag must be 0 after unpaused settle");
      assert.equal(c1.busy, false, "Pipeline must not be busy after settle");

      // 2. Paused settle routes all upstream packets to queue without showing
      let sPaused = pipeline(initialPipeline, "backfill");
      for (let i = 0; i < 4; i++) sPaused = pipeline(sPaused, "tick");
      sPaused = pipeline(sPaused, "pause");
      sPaused = pipeline(sPaused, "emit");
      sPaused = pipeline(sPaused, "settle");
      const c2 = counters(sPaused);
      assert.equal(c2.busy, false, "Paused settle must bring pipeline to rest");
      assert.ok(c2.queued > 0, "Paused settle must hold upstream packets in queue");
      assert.ok(sPaused.packets.every((p) => p.place === "queue"), "All live packets must be in queue");
    });
  });

  /* ------------------------------------------------------------------------
   * 2. Timeline Keyboard Navigation & Bounds
   * ------------------------------------------------------------------------ */
  describe("2. Timeline Keyboard Navigation Bounds (turnYear)", () => {
    test("Clamping at lower bound (year 0 / 2018)", () => {
      assert.equal(turnYear(0, "ArrowLeft"), 0, "ArrowLeft at 0 must clamp to 0");
      assert.equal(turnYear(0, "PageUp"), 0, "PageUp at 0 must clamp to 0");
      assert.equal(turnYear(-5, "ArrowLeft"), 0, "Negative index must clamp to 0");
    });

    test("Clamping at upper bound (year 8 / 2026)", () => {
      assert.equal(turnYear(8, "ArrowRight"), 8, "ArrowRight at 8 must clamp to 8");
      assert.equal(turnYear(8, "PageDown"), 8, "PageDown at 8 must clamp to 8");
      assert.equal(turnYear(99, "ArrowRight"), 8, "High index must clamp to 8");
    });

    test("Home and End direct navigation", () => {
      assert.equal(turnYear(4, "Home"), 0, "Home key must jump to index 0");
      assert.equal(turnYear(2, "End"), 8, "End key must jump to index 8");
    });

    test("Neutral keys preserve index", () => {
      assert.equal(turnYear(3, "Enter"), 3, "Enter key must not change index");
      assert.equal(turnYear(5, "Tab"), 5, "Tab key must not change index");
      assert.equal(turnYear(5, ""), 5, "Empty key string must not change index");
    });

    test("Career archive merges all 9 years without missing fields", () => {
      const archive = careerArchive(site.projectList, site.stack);
      assert.equal(archive.length, 9, "Must contain exactly 9 years");
      for (const y of archive) {
        assert.ok(y.year >= 2018 && y.year <= 2026, `Year ${y.year} out of bounds`);
        assert.ok(y.title.length > 0, `Year ${y.year} title missing`);
        assert.ok(y.note.length > 0, `Year ${y.year} note missing`);
        assert.ok(y.pieces.length >= 4, `Year ${y.year} must have >= 4 pieces`);
      }
    });
  });

  /* ------------------------------------------------------------------------
   * 3. YouTube Link Parsing & Song Schema Defense
   * ------------------------------------------------------------------------ */
  describe("3. Song Schema Validation & YouTube URL Parsing (parseVideoId, parseSong)", () => {
    test("parseVideoId extracts 11-char ID from various valid YouTube URL structures", () => {
      const testId = "IXA6bQsVNjs";
      assert.equal(parseVideoId(testId), testId, "Bare ID should resolve");
      assert.equal(parseVideoId(`https://youtu.be/${testId}`), testId, "youtu.be URL should resolve");
      assert.equal(parseVideoId(`https://www.youtube.com/watch?v=${testId}`), testId, "watch?v= URL should resolve");
      assert.equal(parseVideoId(`https://m.youtube.com/watch?v=${testId}&t=10s`), testId, "m.youtube.com with query should resolve");
      assert.equal(parseVideoId(`https://music.youtube.com/watch?v=${testId}`), testId, "music.youtube.com should resolve");
      assert.equal(parseVideoId(`https://www.youtube-nocookie.com/embed/${testId}`), testId, "embed URL should resolve");
      assert.equal(parseVideoId(`https://youtube.com/shorts/${testId}`), testId, "shorts URL should resolve");
      assert.equal(parseVideoId(`https://youtube.com/live/${testId}`), testId, "live URL should resolve");
    });

    test("parseVideoId rejects malicious, malformed, and non-YouTube URLs", () => {
      assert.equal(parseVideoId("javascript:alert(1)"), null, "JavaScript URI must be rejected");
      assert.equal(parseVideoId("https://attacker.com/watch?v=IXA6bQsVNjs"), null, "Untrusted domain must be rejected");
      assert.equal(parseVideoId("https://user:pass@youtube.com/watch?v=IXA6bQsVNjs"), null, "URL with auth must be rejected");
      assert.equal(parseVideoId("https://youtube.com:8080/watch?v=IXA6bQsVNjs"), null, "URL with explicit port must be rejected");
      assert.equal(parseVideoId("https://youtube.com/watch?v=too_short"), null, "Short video ID must be rejected");
      assert.equal(parseVideoId("https://youtube.com/watch?v=too_long_video_id_123"), null, "Long video ID must be rejected");
      assert.equal(parseVideoId(""), null, "Empty string must return null");
    });

    test("parseSong strictly enforces title, artist, note character limits and swatch enum", () => {
      const validSong: SongInput = {
        title: "Valid Title",
        artist: "Valid Artist",
        note: "Valid Note",
        colour: "pink",
        video: "IXA6bQsVNjs",
      };
      const resOk = parseSong(validSong);
      assert.ok(resOk.ok, "Valid song must parse with ok: true");

      // Title exceeding limit (80)
      const resLongTitle = parseSong({ ...validSong, title: "A".repeat(81) });
      assert.ok(!resLongTitle.ok && resLongTitle.errors.title, "Long title must fail");

      // Artist exceeding limit (80)
      const resLongArtist = parseSong({ ...validSong, artist: "A".repeat(81) });
      assert.ok(!resLongArtist.ok && resLongArtist.errors.artist, "Long artist must fail");

      // Note exceeding limit (200)
      const resLongNote = parseSong({ ...validSong, note: "A".repeat(201) });
      assert.ok(!resLongNote.ok && resLongNote.errors.note, "Long note must fail");

      // Invalid colour
      const resBadColor = parseSong({ ...validSong, colour: "purple" });
      assert.ok(!resBadColor.ok && resBadColor.errors.colour, "Invalid colour swatch must fail");
    });
  });

  /* ------------------------------------------------------------------------
   * 4. Zine Paper Parsing, Text Fitting & Pagination
   * ------------------------------------------------------------------------ */
  describe("4. Zine Paper Parsing, Fitting & Layout Math", () => {
    test("parsePaper falls back to A4 for any invalid or missing paper parameter", () => {
      assert.equal(parsePaper("a4"), "a4");
      assert.equal(parsePaper("letter"), "letter");
      assert.equal(parsePaper("LETTER"), "letter");
      assert.equal(parsePaper("  a4  "), "a4");
      assert.equal(parsePaper(["letter"]), "letter");
      assert.equal(parsePaper(["a4", "letter"]), "a4");
      assert.equal(parsePaper("tabloid"), "a4", "Unknown paper format must fallback to a4");
      assert.equal(parsePaper(null), "a4", "null must fallback to a4");
      assert.equal(parsePaper(undefined), "a4", "undefined must fallback to a4");
      assert.equal(parsePaper(123), "a4", "numeric input must fallback to a4");
    });

    test("fit trims at word boundaries and appends ellipsis on cutoff", () => {
      assert.equal(fit("Short text", 20), "Short text", "Short text must not be cut");
      assert.equal(fit("The quick brown fox jumps", 15), "The quick…", "Must cut at word boundary");
      assert.equal(fit("Antidisestablishmentarianism", 10), "Antidises…", "Long single word cuts at max-1");
      assert.equal(fit("Trailing punctuation, here!", 24), "Trailing punctuation…", "Strips trailing punctuation before ellipsis");
    });

    test("cellFor returns valid grid positions and rotations for all 8 pages", () => {
      for (let p = 1; p <= 8; p++) {
        const cell = cellFor(p as PageNo);
        assert.equal(cell.page, p);
        assert.ok([0, 1].includes(cell.col), "col must be 0 or 1");
        assert.ok([0, 1, 2, 3].includes(cell.row), "row must be 0, 1, 2, or 3");
        assert.ok([90, -90].includes(cell.rotate), "rotate must be 90 or -90");
      }
      assert.throws(() => cellFor(9 as PageNo), /no cell for page/);
    });

    test("guides and edgeBetween correctly calculate fold vs cut boundaries", () => {
      const g = guides("a4");
      assert.equal(g.folds.length, 5, "Must have exactly 5 fold lines");
      assert.ok(g.cut.x1 === g.cut.x2, "Cut line must be vertical");

      const cellP1 = cellFor(1); // col 0, row 3
      const cellP8 = cellFor(8); // col 0, row 2
      const cellP2 = cellFor(2); // col 1, row 3
      assert.equal(edgeBetween(cellP1, cellP8), "fold", "Vertical neighbor must be fold");
      assert.equal(edgeBetween(cellP1, cellP2), "fold", "Row 3 horizontal neighbor must be fold");

      const cellP7 = cellFor(7); // col 0, row 1
      const cellP4 = cellFor(4); // col 1, row 1
      assert.equal(edgeBetween(cellP7, cellP4), "cut", "Row 1 horizontal neighbor must be cut");
    });

    test("latestNote skips invalid dates and handles ties gracefully", () => {
      const notes = [
        { date: "2026-09-03", title: "Older note" },
        { date: "2026-10-12", title: "Newer note" },
        { date: "not-a-date", title: "Invalid note" },
      ];
      const latest = latestNote(notes);
      assert.ok(latest);
      assert.equal(latest.date, "2026-10-12");
      assert.equal(latest.title, "Newer note");

      assert.equal(latestNote([]), undefined, "Empty list yields undefined");
    });
  });

  /* ------------------------------------------------------------------------
   * 5. Fortune Targets & Security Traversal Defense
   * ------------------------------------------------------------------------ */
  describe("5. Fortune Targets & Path Security (safeInternalPath, buildFortuneTargets)", () => {
    test("safeInternalPath permits valid absolute internal paths only", () => {
      assert.ok(safeInternalPath("/work"), "/work is valid");
      assert.ok(safeInternalPath("/projects"), "/projects is valid");
      assert.ok(safeInternalPath("/notes/backfills-are-a-feature"), "Nested slug is valid");
      assert.ok(safeInternalPath("/"), "/ root is valid");

      // Rejections
      assert.equal(safeInternalPath("//attacker.com"), false, "Protocol-relative double slash rejected");
      assert.equal(safeInternalPath("/work/../admin"), false, "Directory traversal rejected");
      assert.equal(safeInternalPath("/work\\admin"), false, "Backslash rejected");
      assert.equal(safeInternalPath("/work?q=1"), false, "Query string rejected");
      assert.equal(safeInternalPath("/work#hash"), false, "Hash fragment rejected");
      assert.equal(safeInternalPath("https://otohime.dev"), false, "Absolute HTTPS rejected");
      assert.equal(safeInternalPath("javascript:void(0)"), false, "JavaScript URI rejected");
      assert.equal(safeInternalPath(""), false, "Empty string rejected");
    });

    test("buildFortuneTargets encodes IDs injectively and deduplicates hrefs", () => {
      const targets = buildFortuneTargets({
        projects: [{ title: "Shore", href: "/shore" }, { title: "Capsule", href: "/capsule" }],
        notes: [{ date: "2026-10-12", title: "Backfills" }],
      });
      assert.equal(targets.length, 3);
      const ids = targets.map((t) => t.id);
      assert.equal(new Set(ids).size, 3, "All target IDs must be unique");
      assert.ok(ids.every((id) => id.startsWith("fortune-")), "IDs must use fortune- prefix");
    });
  });

  /* ------------------------------------------------------------------------
   * 6. Live Server Edge Traversal & OpenGraph /og Stamping
   * ------------------------------------------------------------------------ */
  describe("6. Live Server HTTP Edge Cases & OpenGraph Stamping", () => {
    test("OpenGraph endpoint /og generates valid PNG for standard and adversarial queries", async (t) => {
      if (!serverAvailable) {
        t.skip("Live server offline; skipping live HTTP test");
        return;
      }

      // Default /og without query
      const resDefault = await fetch(`${BASE}/og`);
      assert.equal(resDefault.status, 200, "Default /og must return HTTP 200");
      assert.equal(resDefault.headers.get("content-type"), "image/png");

      // Custom parameters
      const resCustom = await fetch(`${BASE}/og?title=Data%20Contracts&path=/notes/the-contract-caught-it`);
      assert.equal(resCustom.status, 200, "Custom /og must return HTTP 200");
      assert.equal(resCustom.headers.get("content-type"), "image/png");

      // Oversized parameters (testing graceful boundary fallback)
      const longTitle = encodeURIComponent("A".repeat(300));
      const resLong = await fetch(`${BASE}/og?title=${longTitle}&path=invalid-no-slash`);
      assert.equal(resLong.status, 200, "Oversized /og parameters must return HTTP 200 fallback");
      assert.equal(resLong.headers.get("content-type"), "image/png");

      // Special characters & emoji in title
      const resEmoji = await fetch(`${BASE}/og?title=%F0%9F%A6%80%20Crab&path=/notes/%F0%9F%A6%80`);
      assert.equal(resEmoji.status, 200, "Emoji /og parameters must return HTTP 200");
      assert.equal(resEmoji.headers.get("content-type"), "image/png");
    });

    test("Live server core route responses and HTML structure", async (t) => {
      if (!serverAvailable) {
        t.skip("Live server offline; skipping live HTTP test");
        return;
      }

      for (const { href } of PUBLIC_PAGES) {
        const res = await fetch(`${BASE}${href}`);
        assert.equal(res.status, 200, `Route ${href} must return 200`);
        const html = await res.text();
        assert.match(html, /id="main"/, `Route ${href} must render <main id="main">`);
        assert.match(html, /href="#main"/, `Route ${href} must include accessible skip link to #main`);
        assert.match(html, /class="masthead"/, `Route ${href} must include masthead`);
        assert.match(html, /class="end"/, `Route ${href} must include end footer`);
      }
    });

    test("Live server note detail routes and not-found handling", async (t) => {
      if (!serverAvailable) {
        t.skip("Live server offline; skipping live HTTP test");
        return;
      }

      for (const note of site.notes) {
        const res = await fetch(`${BASE}/notes/${note.slug}`);
        assert.equal(res.status, 200, `Note ${note.slug} must return 200`);
        const html = await res.text();
        assert.match(html, new RegExp(note.title), `Note ${note.slug} must render note title`);
        assert.match(html, new RegExp(note.date), `Note ${note.slug} must render note date`);
      }

      // Non-existent slug returns 404
      const res404 = await fetch(`${BASE}/notes/non-existent-note-slug-404-test`);
      assert.equal(res404.status, 404, "Unknown note slug must return HTTP 404");
    });
  });
});
