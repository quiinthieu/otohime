import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { site } from "../content/site.ts";
import {
  BASE_SKETCHES,
  handlePortraitDownload,
  parsePromptPack,
  PORTRAIT_CONCEPTS,
  renderSketchesGalleryHtml,
  REQUIRED_MASTER_FILENAMES,
  resolveSketchesCollection,
  type PortraitRecord,
  validatePortraitManifest,
} from "./sketches.ts";
import { loadPromptPack } from "./sketches-generation.ts";

const ROOT = resolve(import.meta.dirname, "..");

function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

function makeFixtureRecord(index: number, overrides: Partial<PortraitRecord> = {}): PortraitRecord {
  const concept = PORTRAIT_CONCEPTS[index];
  assert.ok(concept, `missing concept at index ${index}`);
  const tag = String(index + 1).padStart(2, "0");
  const masterSha = sha256Hex(`master-png-bytes-${concept.conceptId}`);
  const derivativeSha = sha256Hex(`derivative-jpg-bytes-${concept.conceptId}`);
  const candidateSha = sha256Hex(`candidate-raw-bytes-${concept.conceptId}`);
  const promptSha = sha256Hex(concept.fullPrompt);
  const packSha = sha256Hex("prompt-pack-v1");
  const settingsSha = sha256Hex(JSON.stringify({ model: "grok-imagine-image-2.0", aspect_ratio: "3:4", resolution: "2k" }));
  const referenceSha = sha256Hex("https://i.pinimg.com/originals/41/9a/49/419a49689748e94025c4a9f00d06347b.jpg");

  return {
    conceptId: concept.conceptId,
    filename: concept.masterFilename,
    derivativeFilename: concept.derivativeFilename,
    title: concept.title,
    caption: concept.caption,
    attemptId: `attempt-${tag}-1`,
    model: "grok-imagine-image-2.0",
    nativeWidth: 1536,
    nativeHeight: 2048,
    candidateSha256: candidateSha,
    promptSha256: promptSha,
    promptPackSha256: packSha,
    settingsSha256: settingsSha,
    referenceSha256: referenceSha,
    review: {
      disposition: "accepted",
      reviewer: "test-reviewer",
      reviewedAt: "2026-10-25T15:00:00.000Z",
      notes: "Original composition, expressive ink and watercolour wash.",
    },
    provenance: {
      provider: "xai",
      fileExpiresAt: null,
      publicUrlExpiresAt: null,
    },
    master: {
      filename: concept.masterFilename,
      fileId: `file_master_${tag}_abcdef123456`,
      publicUrl: `https://files-cdn.x.ai/token_${tag}_master/file_master_${tag}_abcdef123456.png`,
      sha256: masterSha,
      mimeType: "image/png",
      bytes: 1_850_000 + index * 1024,
      width: 1536,
      height: 2048,
      expiresAt: null,
    },
    derivative: {
      filename: concept.derivativeFilename,
      fileId: `file_deriv_${tag}_abcdef123456`,
      publicUrl: `https://files-cdn.x.ai/token_${tag}_deriv/file_deriv_${tag}_abcdef123456.jpg`,
      sha256: derivativeSha,
      mimeType: "image/jpeg",
      bytes: 340_000 + index * 512,
      width: 1152,
      height: 1536,
      expiresAt: null,
    },
    ...overrides,
  };
}

function makeAllTenRecords(): PortraitRecord[] {
  return PORTRAIT_CONCEPTS.map((_, i) => makeFixtureRecord(i));
}

test("prompts.md parses into ten distinct concepts with exact filenames, titles and captions", () => {
  const pack = loadPromptPack();
  assert.equal(pack.concepts.length, 10);
  assert.deepEqual(
    pack.concepts.map((c) => c.masterFilename),
    [...REQUIRED_MASTER_FILENAMES],
  );
  assert.deepEqual(
    pack.concepts.map((c) => c.derivativeFilename),
    [
      "13-reader.jpg",
      "14-flowers.jpg",
      "15-rain.jpg",
      "16-cafe.jpg",
      "17-leaves.jpg",
      "18-violin.jpg",
      "19-window.jpg",
      "20-painter.jpg",
      "21-breeze.jpg",
      "22-letter.jpg",
    ],
  );
  assert.deepEqual(
    pack.concepts.map((c) => c.title),
    ["Reader", "Wildflowers", "Rain", "Café", "Leaves", "Violin", "Window", "Painter", "Breeze", "Letter"],
  );
  assert.match(pack.sharedStyle, /#faf8f3/);
  assert.match(pack.concepts[0].composition, /Seated, three-quarter view from the front/);
  assert.equal(pack.concepts[0].caption, "Page forty, and the kettle can wait.");
  assert.equal(pack.concepts[9].caption, "Three lines in, and already a second sheet.");

  // Parsing raw text directly produces the same fingerprint
  const raw = readFileSync(
    resolve(ROOT, "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md"),
    "utf8",
  );
  const parsed = parsePromptPack(raw);
  assert.equal(parsed.promptPackSha256, pack.promptPackSha256);
});

test("committed content/portraits.json starts empty and keeps production at 12 studies", () => {
  const raw = JSON.parse(readFileSync(resolve(ROOT, "content/portraits.json"), "utf8"));
  const result = validatePortraitManifest(raw, { requirePeople: false });
  assert.equal(result.errors.length, 0, result.errors.join("\n"));
  assert.equal(result.records.length, 0);

  assert.equal(site.sketches.length, 12);
  assert.equal(site.sketches.filter((s) => s.kind === "person").length, 0);
  assert.equal(site.sketchesIntro, "Twelve studies from one sketchbook. Places first, then the things that sit still.");
});

test("validatePortraitManifest requires ten records when requirePeople is true and rejects partial/extra/fake records", () => {
  const emptyCheck = validatePortraitManifest([], { requirePeople: true });
  assert.ok(emptyCheck.errors.some((e) => /requires 10|0 records/i.test(e)));

  const partialCheck = validatePortraitManifest([makeFixtureRecord(0)], { requirePeople: false });
  assert.ok(partialCheck.errors.some((e) => /partial|exactly 10/i.test(e)));

  const extraRecords = [...makeAllTenRecords(), makeFixtureRecord(0)];
  const extraCheck = validatePortraitManifest(extraRecords, { requirePeople: false });
  assert.ok(extraCheck.errors.some((e) => /extra|duplicate|exactly 10/i.test(e)));

  const validTen = makeAllTenRecords();
  const validCheck = validatePortraitManifest(validTen, { requirePeople: true });
  assert.equal(validCheck.errors.length, 0, validCheck.errors.join("\n"));
  assert.equal(validCheck.records.length, 10);

  // Fake/fixture records are rejected in delivery mode (allowFixtures: false)
  const fakeTen = makeAllTenRecords().map((r, i) =>
    i === 0 ? { ...r, provenance: { ...r.provenance, fixture: true } } : r,
  );
  const fakeCheck = validatePortraitManifest(fakeTen, { requirePeople: true });
  assert.ok(fakeCheck.errors.some((e) => /fixture|fake/i.test(e)));
});

test("validatePortraitManifest rejects wrong dimensions, oversized derivatives, duplicate hashes, expiry and disallowed hosts", () => {
  const badRatio = makeAllTenRecords();
  badRatio[2] = {
    ...badRatio[2],
    nativeWidth: 1024,
    nativeHeight: 1024,
    master: { ...badRatio[2].master, width: 1024, height: 1024 },
  };
  assert.ok(validatePortraitManifest(badRatio).errors.some((e) => /3:4/i.test(e)));

  const badDerivSize = makeAllTenRecords();
  badDerivSize[3] = {
    ...badDerivSize[3],
    derivative: { ...badDerivSize[3].derivative, width: 768, height: 1024 },
  };
  assert.ok(validatePortraitManifest(badDerivSize).errors.some((e) => /1152x1536/i.test(e)));

  const oversizedDeriv = makeAllTenRecords();
  oversizedDeriv[4] = {
    ...oversizedDeriv[4],
    derivative: { ...oversizedDeriv[4].derivative, bytes: 600_000 },
  };
  assert.ok(validatePortraitManifest(oversizedDeriv).errors.some((e) => /600000|600,000|bytes/i.test(e)));

  const duplicateHash = makeAllTenRecords();
  duplicateHash[5] = {
    ...duplicateHash[5],
    master: { ...duplicateHash[5].master, sha256: duplicateHash[0].master.sha256 },
  };
  assert.ok(validatePortraitManifest(duplicateHash).errors.some((e) => /duplicate.*sha256/i.test(e)));

  const badHost = makeAllTenRecords();
  badHost[6] = {
    ...badHost[6],
    master: {
      ...badHost[6].master,
      publicUrl: "https://imgen.x.ai/xai-imgen/xai-tmp-imgen-07.png",
    },
  };
  assert.ok(validatePortraitManifest(badHost).errors.some((e) => /files-cdn\.x\.ai/i.test(e)));

  const expiringUrl = makeAllTenRecords();
  expiringUrl[7] = {
    ...expiringUrl[7],
    provenance: {
      ...expiringUrl[7].provenance,
      publicUrlExpiresAt: 1765000000 as unknown as null,
    },
  };
  assert.ok(validatePortraitManifest(expiringUrl).errors.some((e) => /expir/i.test(e)));
});

test("gallery rendering renders 12 studies before activation and 22 studies with 10 fixture people when supplied", () => {
  const defaultCollection = resolveSketchesCollection([]);
  assert.equal(defaultCollection.sketches.length, 12);
  assert.equal(defaultCollection.hint, "places and small things");
  const defaultHtml = renderSketchesGalleryHtml(defaultCollection);
  assert.equal((defaultHtml.match(/<section\b/g) ?? []).length, 2);
  assert.equal((defaultHtml.match(/<figure\b/g) ?? []).length, 12);
  assert.doesNotMatch(defaultHtml, /id="people"/);

  const fixtureRecords = makeAllTenRecords().map((r) => ({
    ...r,
    provenance: { ...r.provenance, fixture: true },
  }));
  const activatedCollection = resolveSketchesCollection(fixtureRecords, { allowFixtures: true });
  assert.equal(activatedCollection.sketches.length, 22);
  assert.equal(activatedCollection.sketches.filter((s) => s.kind === "place").length, 6);
  assert.equal(activatedCollection.sketches.filter((s) => s.kind === "object").length, 6);
  assert.equal(activatedCollection.sketches.filter((s) => s.kind === "person").length, 10);
  assert.equal(activatedCollection.hint, "places, small things and people");
  assert.match(activatedCollection.intro, /Twenty-two studies from one sketchbook/);

  // Existing twelve paintings are unchanged
  assert.deepEqual(activatedCollection.sketches.slice(0, 12), BASE_SKETCHES);

  const activatedHtml = renderSketchesGalleryHtml(activatedCollection);
  assert.equal((activatedHtml.match(/<section\b/g) ?? []).length, 3);
  assert.equal((activatedHtml.match(/<figure\b/g) ?? []).length, 22);
  assert.match(activatedHtml, /id="people"/);
  assert.equal((activatedHtml.match(/width="1152" height="1536"/g) ?? []).length, 10);
  for (const filename of REQUIRED_MASTER_FILENAMES) {
    assert.match(activatedHtml, new RegExp(`/sketches/download/${filename}`));
    assert.match(activatedHtml, new RegExp(`download="${filename}"`));
  }
});

test("handlePortraitDownload streams valid master PNGs and rejects unknown names, external URL params and upstream failures", async () => {
  const records = makeAllTenRecords();
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

  // 1. Valid filename streams the public PNG with Content-Type and Content-Disposition
  let requestedUrl = "";
  const okRes = await handlePortraitDownload(
    new Request("http://localhost:4000/sketches/download/01_Quiet_Reader.png"),
    "01_Quiet_Reader.png",
    {
      records,
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return new Response(pngBytes, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      },
    },
  );
  assert.equal(okRes.status, 200);
  assert.equal(requestedUrl, records[0].master.publicUrl);
  assert.equal(okRes.headers.get("content-type"), "image/png");
  assert.equal(okRes.headers.get("content-disposition"), 'attachment; filename="01_Quiet_Reader.png"');
  assert.deepEqual(new Uint8Array(await okRes.arrayBuffer()), pngBytes);

  // 2. Unknown filename returns 404 without calling fetch
  let fetchCalled = false;
  const notFoundRes = await handlePortraitDownload(
    new Request("http://localhost:4000/sketches/download/99_Unknown.png"),
    "99_Unknown.png",
    {
      records,
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      },
    },
  );
  assert.equal(notFoundRes.status, 404);
  assert.equal(fetchCalled, false);

  // 3. Empty manifest returns 404 for known filename
  const emptyRes = await handlePortraitDownload(
    new Request("http://localhost:4000/sketches/download/01_Quiet_Reader.png"),
    "01_Quiet_Reader.png",
    {
      records: [],
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      },
    },
  );
  assert.equal(emptyRes.status, 404);
  assert.equal(fetchCalled, false);

  // 4. Arbitrary external URL parameter is rejected with 400 and never fetched
  const externalParamRes = await handlePortraitDownload(
    new Request("http://localhost:4000/sketches/download/01_Quiet_Reader.png?url=https://evil.example/payload.png"),
    "01_Quiet_Reader.png",
    {
      records,
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response(null, { status: 200 });
      },
    },
  );
  assert.equal(externalParamRes.status, 400);
  assert.equal(fetchCalled, false);

  // 5. Upstream 500 failure returns controlled 502
  const upstreamFailRes = await handlePortraitDownload(
    new Request("http://localhost:4000/sketches/download/01_Quiet_Reader.png"),
    "01_Quiet_Reader.png",
    {
      records,
      fetchImpl: async () => new Response("gateway error", { status: 503 }),
    },
  );
  assert.equal(upstreamFailRes.status, 502);

  // 6. Upstream network exception returns controlled 502
  const networkThrowRes = await handlePortraitDownload(
    new Request("http://localhost:4000/sketches/download/01_Quiet_Reader.png"),
    "01_Quiet_Reader.png",
    {
      records,
      fetchImpl: async () => {
        throw new Error("socket hang up");
      },
    },
  );
  assert.equal(networkThrowRes.status, 502);
});
