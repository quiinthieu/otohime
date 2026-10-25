import { createHash } from "node:crypto";
import rawPortraits from "../content/portraits.json" with { type: "json" };

export type SketchKind = "place" | "object" | "person";

export type Sketch = {
  src: string;
  title: string;
  kind: SketchKind;
  note: string;
  downloadHref?: string;
  downloadFilename?: string;
};

export const REQUIRED_MASTER_FILENAMES = [
  "01_Quiet_Reader.png",
  "02_Flower_Girl.png",
  "03_Rainy_Afternoon.png",
  "04_Cafe_Dreamer.png",
  "05_Autumn_Wanderer.png",
  "06_Violinist.png",
  "07_Morning_by_the_Window.png",
  "08_Painter.png",
  "09_Spring_Breeze.png",
  "10_Letter_Writer.png",
] as const;

export type RequiredMasterFilename = (typeof REQUIRED_MASTER_FILENAMES)[number];

export type PortraitConcept = {
  index: number;
  conceptId: string;
  masterFilename: RequiredMasterFilename;
  derivativeFilename: string;
  title: string;
  caption: string;
  composition: string;
  fullPrompt: string;
  promptSha256: string;
};

export type PromptPack = {
  styleReferenceUrl: string;
  originalImageUrl: string;
  sharedStyle: string;
  promptPackSha256: string;
  referenceSha256: string;
  concepts: PortraitConcept[];
};

export type PortraitAssetArtifact = {
  filename: string;
  fileId: string;
  publicUrl: string;
  sha256: string;
  mimeType: "image/png" | "image/jpeg";
  bytes: number;
  width: number;
  height: number;
  expiresAt: null;
};

export type PortraitReview = {
  disposition: "accepted" | "rejected" | "pending";
  reviewer: string;
  reviewedAt: string;
  notes?: string;
};

export type PortraitProvenance = {
  provider: "xai";
  fileExpiresAt: null;
  publicUrlExpiresAt: null;
  fixture?: boolean;
};

export type PortraitRecord = {
  conceptId: string;
  filename: RequiredMasterFilename;
  derivativeFilename: string;
  title: string;
  caption: string;
  attemptId: string;
  model: string;
  nativeWidth: number;
  nativeHeight: number;
  candidateSha256: string;
  promptSha256: string;
  promptPackSha256: string;
  settingsSha256: string;
  referenceSha256: string;
  review: PortraitReview;
  provenance: PortraitProvenance;
  master: PortraitAssetArtifact & { mimeType: "image/png" };
  derivative: PortraitAssetArtifact & { mimeType: "image/jpeg" };
};

export const PORTRAIT_Responsive_SIZES = "(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw";

export const SHARED_STYLE_BLOCK =
  "Expressive hand-drawn ink and watercolour illustration of one young adult woman, in the manner of a quick sketchbook study. Energetic black ink contours of varying weight, confident minimal strokes for the face, overlapping and overshooting lines, a few scribbles and unfinished passages. Loose transparent watercolour washes with concentrated pigment in places, hard irregular wet edges, granulation, bleeding, small splatters. Clothing, hair and fabric folds handled impressionistically; large areas left as bare off-white paper (#faf8f3); contours dissolve into the paper toward the bottom. Restrained palette of three to five colours with saturated accents against pale washes and deep ink black. Asymmetrical editorial composition, portrait 3:4, no border, no text, no watermark, no signature. Not: polished digital painting, anime rendering, photorealism, clean uniform outlines, detailed background, paper grain, sketchbook spine.";

const CONCEPT_SEEDS: Array<{
  conceptId: string;
  masterFilename: RequiredMasterFilename;
  derivativeFilename: string;
  title: string;
  caption: string;
  composition: string;
}> = [
  {
    conceptId: "01-quiet-reader",
    masterFilename: "01_Quiet_Reader.png",
    derivativeFilename: "13-reader.jpg",
    title: "Reader",
    caption: "Page forty, and the kettle can wait.",
    composition:
      "Seated, three-quarter view from the front, book held low in her lap, head tilted down, hair loosely tied and partly loose; oversized teal-blue coat, warm ochre scarf; palette teal, ochre, ink, a touch of red. Focal: the hands on the book. (Changed from the brief's profile so it is not the reference.)",
  },
  {
    conceptId: "02-flower-girl",
    masterFilename: "02_Flower_Girl.png",
    derivativeFilename: "14-flowers.jpg",
    title: "Wildflowers",
    caption: "Picked on the way, for no one in particular.",
    composition:
      "Standing, body turned left, face toward the viewer, messy low bun; loose cream blouse, muted burgundy skirt; small bouquet of wildflowers held at chest height; palette burgundy, cream, sap green, a yellow accent. Focal: the bouquet against the blouse.",
  },
  {
    conceptId: "03-rainy-afternoon",
    masterFilename: "03_Rainy_Afternoon.png",
    derivativeFilename: "15-rain.jpg",
    title: "Rain",
    caption: "A clear umbrella keeps the sky in view.",
    composition:
      "Full profile facing left, shoulder-length black hair, chin slightly lifted; moss-green trench coat, mustard scarf; a transparent umbrella drawn as a few arcs, rain as diagonal dry strokes; palette moss, mustard, grey wash. Focal: the face under the umbrella's edge.",
  },
  {
    conceptId: "04-cafe-dreamer",
    masterFilename: "04_Cafe_Dreamer.png",
    derivativeFilename: "16-cafe.jpg",
    title: "Café",
    caption: "The cup went cold while she was elsewhere.",
    composition:
      "Seated at a table, chin on one hand, elbow on the table, elegant short bob; dark navy cardigan over an ivory blouse; one coffee cup, nothing else on the table; palette navy, ivory, a warm brown; the far side of the table left blank. Focal: the eyes, looking past the viewer.",
  },
  {
    conceptId: "05-autumn-wanderer",
    masterFilename: "05_Autumn_Wanderer.png",
    derivativeFilename: "17-leaves.jpg",
    title: "Leaves",
    caption: "The wind had the last word.",
    composition:
      "Walking, three-quarter from behind, head turned back over her shoulder, long hair streaming; rust-red overcoat, charcoal skirt; six or seven leaves drawn as single strokes around her; palette rust, charcoal, ochre. Focal: the turn of the head.",
  },
  {
    conceptId: "06-violinist",
    masterFilename: "06_Violinist.png",
    derivativeFilename: "18-violin.jpg",
    title: "Violin",
    caption: "Eyes closed, the hard bar coming up.",
    composition:
      "Standing, three-quarter, eyes closed, relaxed updo; flowing midnight-blue dress; violin under the chin, bow mid-stroke; palette midnight blue, warm wood brown, ink. Focal: the bow hand.",
  },
  {
    conceptId: "07-morning-by-the-window",
    masterFilename: "07_Morning_by_the_Window.png",
    derivativeFilename: "19-window.jpg",
    title: "Window",
    caption: "Tea, and a street that is not awake yet.",
    composition:
      "Seated on a sill in profile, knees drawn up, loosely braided hair; pale lavender sweater, soft grey trousers; a cup of tea held in both hands; the window as two vertical lines and a pale wash of light; palette lavender, grey, a warm yellow wash. Focal: the cup and the light on her face.",
  },
  {
    conceptId: "08-painter",
    masterFilename: "08_Painter.png",
    derivativeFilename: "20-painter.jpg",
    title: "Painter",
    caption: "Cobalt on the sleeve, as usual.",
    composition:
      "Three-quarter view, messy ponytail, looking down at a brush in one hand and a small palette in the other; white shirt under a cobalt-blue work jacket; a splash of cobalt on the sleeve; palette cobalt, white, a few palette daubs. Focal: the brush tip.",
  },
  {
    conceptId: "09-spring-breeze",
    masterFilename: "09_Spring_Breeze.png",
    derivativeFilename: "21-breeze.jpg",
    title: "Breeze",
    caption: "Hair across her face, one stem held still.",
    composition:
      "Frontal, hair blowing across her face hiding one eye, a single flower held up near her shoulder; flowing sage-green dress, pale blush-pink shawl; palette sage, blush, ink. Focal: the visible eye.",
  },
  {
    conceptId: "10-letter-writer",
    masterFilename: "10_Letter_Writer.png",
    derivativeFilename: "22-letter.jpg",
    title: "Letter",
    caption: "Three lines in, and already a second sheet.",
    composition:
      "Seated at a small wooden table seen from a high three-quarter angle, head bent, loosely pinned hair with strands falling; warm brown cardigan, muted blue skirt; a pen and one sheet, a second sheet beside it; palette brown, muted blue, ochre table. Focal: the writing hand.",
  },
];

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildFullPrompt(sharedStyle: string, title: string, composition: string): string {
  return `${sharedStyle}\n\nSubject: ${title}. ${composition}`;
}

export const PORTRAIT_CONCEPTS: PortraitConcept[] = CONCEPT_SEEDS.map((seed, idx) => {
  const fullPrompt = buildFullPrompt(SHARED_STYLE_BLOCK, seed.title, seed.composition);
  return {
    index: idx + 1,
    conceptId: seed.conceptId,
    masterFilename: seed.masterFilename,
    derivativeFilename: seed.derivativeFilename,
    title: seed.title,
    caption: seed.caption,
    composition: seed.composition,
    fullPrompt,
    promptSha256: sha256Hex(fullPrompt),
  };
});

export const BASE_SKETCHES: Sketch[] = [
  { src: "/sketches/01-cove.jpg", title: "Cove", kind: "place", note: "A path that ends where the light does." },
  { src: "/sketches/02-alley.jpg", title: "Alley", kind: "place", note: "One lantern, and the street does the rest." },
  { src: "/sketches/03-lake.jpg", title: "Lake", kind: "place", note: "The water kept the mountain's outline." },
  { src: "/sketches/04-terraces.jpg", title: "Terraces", kind: "place", note: "After the rain, every step held a sky." },
  { src: "/sketches/05-cafe.jpg", title: "Cafe street", kind: "place", note: "Wet cobbles, one awning, nobody in a hurry." },
  { src: "/sketches/06-canyon.jpg", title: "Canyon", kind: "place", note: "A thin line of water at the bottom." },
  { src: "/sketches/07-cup.jpg", title: "Cup", kind: "object", note: "The chip is older than the tea." },
  { src: "/sketches/08-key.jpg", title: "Key", kind: "object", note: "Left on the sill, with something green." },
  { src: "/sketches/09-glasses.jpg", title: "Glasses", kind: "object", note: "Closed, on a page that can wait." },
  { src: "/sketches/10-flower.jpg", title: "Jam jar", kind: "object", note: "One stem, in a jar that used to hold jam." },
  { src: "/sketches/11-peach.jpg", title: "Peach", kind: "object", note: "Lunch, and the knife that came with it." },
  { src: "/sketches/12-wallet.jpg", title: "Wallet", kind: "object", note: "A ticket still sticking out." },
];

export const DEFAULT_PROMPTS_REL_PATH =
  "projects/reference-image-https-pin-it-4kjro8mya-creative-agent-prompt/prompts.md";

export function parsePromptPack(markdown: string): PromptPack {
  const styleRefMatch = markdown.match(/^Style reference:\s*(\S+)/m);
  const origImgMatch = markdown.match(/^Original image:\s*(\S+)/m);
  const sharedMatch = markdown.match(/^>\s*(Expressive hand-drawn ink and watercolour illustration[^\n]+)/m);

  if (!styleRefMatch || !origImgMatch || !sharedMatch) {
    throw new Error("prompts.md is missing style reference, original image, or shared style blockquote");
  }

  const styleReferenceUrl = styleRefMatch[1].trim();
  const originalImageUrl = origImgMatch[1].trim();
  const sharedStyle = sharedMatch[1].trim();

  const compositionsByTitle = new Map<string, string>();
  const compRegex = /^(\d+)\.\s+\*\*([^*]+)\.\*\*\s+(.+)$/gm;
  for (const match of markdown.matchAll(compRegex)) {
    const title = match[2].trim();
    const composition = match[3].trim();
    compositionsByTitle.set(title, composition);
  }

  const rows: Array<{
    masterFilename: string;
    derivativeFilename: string;
    title: string;
    caption: string;
  }> = [];
  const tableRegex = /^\|\s*(0\d_[^|]+\.png|10_[^|]+\.png)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
  for (const match of markdown.matchAll(tableRegex)) {
    rows.push({
      masterFilename: match[1].trim(),
      derivativeFilename: match[2].trim(),
      title: match[3].trim(),
      caption: match[4].trim(),
    });
  }

  if (rows.length !== 10) {
    throw new Error(`Expected 10 deliverable mapping rows in prompts.md, found ${rows.length}`);
  }

  const concepts: PortraitConcept[] = rows.map((row, idx) => {
    const canonical = PORTRAIT_CONCEPTS[idx];
    const composition = compositionsByTitle.get(row.title);
    if (!composition) {
      throw new Error(`Missing individual composition for "${row.title}" in prompts.md`);
    }
    if (!canonical || row.masterFilename !== canonical.masterFilename) {
      throw new Error(`Deliverable row ${idx + 1} master filename "${row.masterFilename}" does not match expected "${canonical?.masterFilename}"`);
    }
    const fullPrompt = buildFullPrompt(sharedStyle, row.title, composition);
    return {
      index: idx + 1,
      conceptId: canonical.conceptId,
      masterFilename: canonical.masterFilename,
      derivativeFilename: row.derivativeFilename,
      title: row.title,
      caption: row.caption,
      composition,
      fullPrompt,
      promptSha256: sha256Hex(fullPrompt),
    };
  });

  return {
    styleReferenceUrl,
    originalImageUrl,
    sharedStyle,
    promptPackSha256: sha256Hex(markdown),
    referenceSha256: sha256Hex(originalImageUrl),
    concepts,
  };
}

const SHA256_RE = /^[0-9a-f]{64}$/;
const FILE_ID_RE = /^file_[A-Za-z0-9_-]{4,120}$/;
const SECRET_LEAK_RE = /\b(xai-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})\b/;

const isRecordObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function isAllowedCdnUrl(urlText: string, expectedExt?: ".png" | ".jpg"): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlText);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "files-cdn.x.ai") return false;
  if (parsed.port !== "" || parsed.search !== "" || parsed.hash !== "") return false;
  if (parsed.username !== "" || parsed.password !== "") return false;
  if (parsed.pathname.includes("..") || parsed.pathname.includes("//")) return false;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  const last = segments.at(-1) ?? "";
  if (expectedExt && !last.endsWith(expectedExt)) return false;
  if (!expectedExt && !last.endsWith(".png") && !last.endsWith(".jpg")) return false;
  return true;
}

export type ManifestValidationOptions = {
  requirePeople?: boolean;
  allowFixtures?: boolean;
  promptPack?: PromptPack;
};

export type ManifestValidationResult = {
  valid: boolean;
  errors: string[];
  records: PortraitRecord[];
};

export function validatePortraitManifest(
  raw: unknown,
  options: ManifestValidationOptions = {},
): ManifestValidationResult {
  const errors: string[] = [];

  let items: unknown[];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (isRecordObject(raw) && Array.isArray(raw.records)) {
    const extraKeys = Object.keys(raw).filter((k) => k !== "records" && k !== "version");
    if (extraKeys.length > 0) {
      errors.push(`manifest contains unknown top-level keys: ${extraKeys.join(", ")}`);
    }
    items = raw.records;
  } else {
    return {
      valid: false,
      errors: ["manifest must be a JSON array of portrait records"],
      records: [],
    };
  }

  const serialized = JSON.stringify(raw);
  if (SECRET_LEAK_RE.test(serialized)) {
    errors.push("manifest contains a credential or Bearer token leak");
  }

  if (items.length === 0) {
    if (options.requirePeople) {
      errors.push("manifest contains 0 records; --require-people requires all 10 reviewed portrait records");
    }
    return {
      valid: errors.length === 0,
      errors,
      records: [],
    };
  }

  if (items.length !== PORTRAIT_CONCEPTS.length) {
    errors.push(
      `manifest is partial or has extra entries: expected exactly ${PORTRAIT_CONCEPTS.length} records (or 0 before activation), found ${items.length}`,
    );
  }

  const expectedConcepts = options.promptPack?.concepts ?? PORTRAIT_CONCEPTS;
  const seenConcepts = new Set<string>();
  const seenFilenames = new Set<string>();
  const seenDerivatives = new Set<string>();
  const seenTitles = new Set<string>();
  const seenFileIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  const validated: PortraitRecord[] = [];

  items.forEach((item, index) => {
    const label = `record[${index}]`;
    if (!isRecordObject(item)) {
      errors.push(`${label}: must be an object`);
      return;
    }

    const expected = expectedConcepts[index];
    const conceptId = typeof item.conceptId === "string" ? item.conceptId : "";
    const filename = typeof item.filename === "string" ? item.filename : "";
    const derivativeFilename = typeof item.derivativeFilename === "string" ? item.derivativeFilename : "";
    const title = typeof item.title === "string" ? item.title : "";
    const caption = typeof item.caption === "string" ? item.caption : "";
    const attemptId = typeof item.attemptId === "string" ? item.attemptId : "";
    const model = typeof item.model === "string" ? item.model : "";
    const nativeWidth = typeof item.nativeWidth === "number" ? item.nativeWidth : NaN;
    const nativeHeight = typeof item.nativeHeight === "number" ? item.nativeHeight : NaN;
    const candidateSha256 = typeof item.candidateSha256 === "string" ? item.candidateSha256 : "";
    const promptSha256 = typeof item.promptSha256 === "string" ? item.promptSha256 : "";
    const promptPackSha256 = typeof item.promptPackSha256 === "string" ? item.promptPackSha256 : "";
    const settingsSha256 = typeof item.settingsSha256 === "string" ? item.settingsSha256 : "";
    const referenceSha256 = typeof item.referenceSha256 === "string" ? item.referenceSha256 : "";

    if (expected) {
      if (conceptId !== expected.conceptId) {
        errors.push(`${label}: conceptId "${conceptId}" must be "${expected.conceptId}"`);
      }
      if (filename !== expected.masterFilename) {
        errors.push(`${label}: filename "${filename}" must be "${expected.masterFilename}"`);
      }
      if (derivativeFilename !== expected.derivativeFilename) {
        errors.push(`${label}: derivativeFilename "${derivativeFilename}" must be "${expected.derivativeFilename}"`);
      }
      if (title !== expected.title) {
        errors.push(`${label}: title "${title}" must be "${expected.title}"`);
      }
      if (caption !== expected.caption) {
        errors.push(`${label}: caption "${caption}" must match prompts.md ("${expected.caption}")`);
      }
    }

    if (seenConcepts.has(conceptId)) errors.push(`${label}: duplicate conceptId "${conceptId}"`);
    seenConcepts.add(conceptId);
    if (seenFilenames.has(filename)) errors.push(`${label}: duplicate filename "${filename}"`);
    seenFilenames.add(filename);
    if (seenDerivatives.has(derivativeFilename)) errors.push(`${label}: duplicate derivativeFilename "${derivativeFilename}"`);
    seenDerivatives.add(derivativeFilename);
    if (seenTitles.has(title)) errors.push(`${label}: duplicate title "${title}"`);
    seenTitles.add(title);

    if (!attemptId.trim()) errors.push(`${label}: attemptId must be a non-empty string`);
    if (!model.trim()) errors.push(`${label}: model must be a non-empty string`);

    if (!Number.isInteger(nativeWidth) || !Number.isInteger(nativeHeight) || nativeWidth < 64 || nativeHeight < 64) {
      errors.push(`${label}: nativeWidth and nativeHeight must be positive integers`);
    } else if (nativeWidth * 4 !== nativeHeight * 3) {
      errors.push(`${label}: native dimensions ${nativeWidth}x${nativeHeight} do not have an exact 3:4 aspect ratio`);
    }

    for (const [field, val] of [
      ["candidateSha256", candidateSha256],
      ["promptSha256", promptSha256],
      ["promptPackSha256", promptPackSha256],
      ["settingsSha256", settingsSha256],
    ] as const) {
      if (!SHA256_RE.test(val)) {
        errors.push(`${label}: ${field} must be a 64-character lowercase hex SHA-256`);
      }
    }
    if (referenceSha256 !== "none" && !SHA256_RE.test(referenceSha256)) {
      errors.push(`${label}: referenceSha256 must be a 64-character lowercase hex SHA-256 or "none"`);
    }

    if (SHA256_RE.test(candidateSha256)) {
      if (seenHashes.has(`candidate:${candidateSha256}`)) {
        errors.push(`${label}: duplicate candidateSha256 "${candidateSha256}"`);
      }
      seenHashes.add(`candidate:${candidateSha256}`);
    }

    // Review validation
    if (!isRecordObject(item.review)) {
      errors.push(`${label}: review must be an object`);
    } else {
      if (item.review.disposition !== "accepted") {
        errors.push(`${label}: review.disposition must be "accepted" (got "${String(item.review.disposition)}")`);
      }
      if (typeof item.review.reviewer !== "string" || !item.review.reviewer.trim()) {
        errors.push(`${label}: review.reviewer must be a non-empty string`);
      }
      if (typeof item.review.reviewedAt !== "string" || Number.isNaN(Date.parse(item.review.reviewedAt))) {
        errors.push(`${label}: review.reviewedAt must be an ISO-8601 timestamp`);
      }
    }

    // Provenance validation
    if (!isRecordObject(item.provenance)) {
      errors.push(`${label}: provenance must be an object`);
    } else {
      if (item.provenance.provider !== "xai") {
        errors.push(`${label}: provenance.provider must be "xai"`);
      }
      if (item.provenance.fileExpiresAt !== null) {
        errors.push(`${label}: provenance.fileExpiresAt must be null (non-expiring file required)`);
      }
      if (item.provenance.publicUrlExpiresAt !== null) {
        errors.push(`${label}: provenance.publicUrlExpiresAt must be null (non-expiring public URL required)`);
      }
      if (!options.allowFixtures && item.provenance.fixture === true) {
        errors.push(`${label}: fake/fixture records are rejected in delivery mode`);
      }
    }

    if (!options.allowFixtures && (/^(fake|fixture)\b/i.test(model) || /^(fake|fixture)\b/i.test(attemptId))) {
      errors.push(`${label}: fake/fixture model or attemptId is rejected in delivery mode`);
    }

    // Master asset validation
    if (!isRecordObject(item.master)) {
      errors.push(`${label}: master must be an object`);
    } else {
      const m = item.master;
      if (m.filename !== filename) {
        errors.push(`${label}: master.filename "${String(m.filename)}" must equal "${filename}"`);
      }
      if (typeof m.fileId !== "string" || !FILE_ID_RE.test(m.fileId)) {
        errors.push(`${label}: master.fileId must match file_<id>`);
      } else {
        if (!options.allowFixtures && /^file_fixture_/i.test(m.fileId)) {
          errors.push(`${label}: master.fileId "${m.fileId}" is a fixture id`);
        }
        if (seenFileIds.has(m.fileId)) errors.push(`${label}: duplicate fileId "${m.fileId}"`);
        seenFileIds.add(m.fileId);
      }
      if (typeof m.publicUrl !== "string" || !isAllowedCdnUrl(m.publicUrl, ".png")) {
        errors.push(`${label}: master.publicUrl must be a permanent https://files-cdn.x.ai/.../*.png URL without query parameters`);
      } else {
        if (seenUrls.has(m.publicUrl)) errors.push(`${label}: duplicate publicUrl "${m.publicUrl}"`);
        seenUrls.add(m.publicUrl);
      }
      if (typeof m.sha256 !== "string" || !SHA256_RE.test(m.sha256)) {
        errors.push(`${label}: master.sha256 must be a 64-character hex SHA-256`);
      } else {
        if (seenHashes.has(`master:${m.sha256}`)) {
          errors.push(`${label}: duplicate master.sha256 "${m.sha256}"`);
        }
        seenHashes.add(`master:${m.sha256}`);
      }
      if (m.mimeType !== "image/png") {
        errors.push(`${label}: master.mimeType must be "image/png"`);
      }
      if (typeof m.bytes !== "number" || !Number.isInteger(m.bytes) || m.bytes <= 0) {
        errors.push(`${label}: master.bytes must be a positive integer`);
      }
      if (m.width !== nativeWidth || m.height !== nativeHeight) {
        errors.push(`${label}: master dimensions ${String(m.width)}x${String(m.height)} must match nativeWidth x nativeHeight (${nativeWidth}x${nativeHeight})`);
      }
      if (m.expiresAt !== null) {
        errors.push(`${label}: master.expiresAt must be null (non-expiring)`);
      }
    }

    // Derivative asset validation
    if (!isRecordObject(item.derivative)) {
      errors.push(`${label}: derivative must be an object`);
    } else {
      const d = item.derivative;
      if (d.filename !== derivativeFilename) {
        errors.push(`${label}: derivative.filename "${String(d.filename)}" must equal "${derivativeFilename}"`);
      }
      if (typeof d.fileId !== "string" || !FILE_ID_RE.test(d.fileId)) {
        errors.push(`${label}: derivative.fileId must match file_<id>`);
      } else {
        if (!options.allowFixtures && /^file_fixture_/i.test(d.fileId)) {
          errors.push(`${label}: derivative.fileId "${d.fileId}" is a fixture id`);
        }
        if (seenFileIds.has(d.fileId)) errors.push(`${label}: duplicate fileId "${d.fileId}"`);
        seenFileIds.add(d.fileId);
      }
      if (typeof d.publicUrl !== "string" || !isAllowedCdnUrl(d.publicUrl, ".jpg")) {
        errors.push(`${label}: derivative.publicUrl must be a permanent https://files-cdn.x.ai/.../*.jpg URL without query parameters`);
      } else {
        if (seenUrls.has(d.publicUrl)) errors.push(`${label}: duplicate publicUrl "${d.publicUrl}"`);
        seenUrls.add(d.publicUrl);
      }
      if (typeof d.sha256 !== "string" || !SHA256_RE.test(d.sha256)) {
        errors.push(`${label}: derivative.sha256 must be a 64-character hex SHA-256`);
      } else {
        if (seenHashes.has(`derivative:${d.sha256}`)) {
          errors.push(`${label}: duplicate derivative.sha256 "${d.sha256}"`);
        }
        seenHashes.add(`derivative:${d.sha256}`);
      }
      if (d.mimeType !== "image/jpeg") {
        errors.push(`${label}: derivative.mimeType must be "image/jpeg"`);
      }
      if (typeof d.bytes !== "number" || !Number.isInteger(d.bytes) || d.bytes <= 0 || d.bytes >= 600_000) {
        errors.push(`${label}: derivative.bytes (${String(d.bytes)}) must be between 1 and 599999 (< 600000 bytes)`);
      }
      if (d.width !== 1152 || d.height !== 1536) {
        errors.push(`${label}: derivative dimensions must be 1152x1536 (got ${String(d.width)}x${String(d.height)})`);
      }
      if (d.expiresAt !== null) {
        errors.push(`${label}: derivative.expiresAt must be null (non-expiring)`);
      }
    }

    validated.push(item as unknown as PortraitRecord);
  });

  return {
    valid: errors.length === 0,
    errors,
    records: errors.length === 0 ? validated : [],
  };
}

export type SketchesCollection = {
  sketches: Sketch[];
  intro: string;
  hint: string;
  peopleCount: number;
  portraitRecords: PortraitRecord[];
};

export function resolveSketchesCollection(
  manifestInput: unknown = rawPortraits,
  options: { allowFixtures?: boolean } = {},
): SketchesCollection {
  const validation = validatePortraitManifest(manifestInput, {
    requirePeople: false,
    allowFixtures: options.allowFixtures,
  });
  if (!validation.valid) {
    throw new Error(`Invalid content/portraits.json manifest:\n${validation.errors.join("\n")}`);
  }

  if (validation.records.length === 0) {
    return {
      sketches: [...BASE_SKETCHES],
      intro: "Twelve studies from one sketchbook. Places first, then the things that sit still.",
      hint: "places and small things",
      peopleCount: 0,
      portraitRecords: [],
    };
  }

  const peopleSketches: Sketch[] = validation.records.map((record) => ({
    src: record.derivative.publicUrl,
    title: record.title,
    kind: "person",
    note: record.caption,
    downloadHref: `/sketches/download/${record.filename}`,
    downloadFilename: record.filename,
  }));

  return {
    sketches: [...BASE_SKETCHES, ...peopleSketches],
    intro: "Twenty-two studies from one sketchbook. Places first, then the things that sit still, and the people.",
    hint: "places, small things and people",
    peopleCount: peopleSketches.length,
    portraitRecords: validation.records,
  };
}

export function getSketchDimensions(kind: SketchKind): { width: number; height: number; sizes?: string } {
  if (kind === "place") {
    return { width: 1248, height: 832 };
  }
  if (kind === "person") {
    return { width: 1152, height: 1536, sizes: PORTRAIT_Responsive_SIZES };
  }
  return { width: 1024, height: 1024 };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSketchesGalleryHtml(collection: SketchesCollection): string {
  const places = collection.sketches.filter((s) => s.kind === "place");
  const objects = collection.sketches.filter((s) => s.kind === "object");
  const people = collection.sketches.filter((s) => s.kind === "person");

  const renderFigure = (sketch: Sketch): string => {
    const dims = getSketchDimensions(sketch.kind);
    const sizesAttr = dims.sizes ? ` sizes="${escapeHtml(dims.sizes)}"` : "";
    const titleBlock =
      sketch.downloadHref && sketch.downloadFilename
        ? `<div class="flex items-baseline justify-between gap-2"><span class="block font-semibold">${escapeHtml(sketch.title)}</span><a href="${escapeHtml(sketch.downloadHref)}" download="${escapeHtml(sketch.downloadFilename)}" class="text-xs text-muted underline underline-offset-4 hover:text-ink">PNG (${escapeHtml(sketch.downloadFilename)})</a></div>`
        : `<span class="block font-semibold">${escapeHtml(sketch.title)}</span>`;
    return `<li><figure><img src="${escapeHtml(sketch.src)}" alt="" width="${dims.width}" height="${dims.height}"${sizesAttr} class="h-auto w-full border border-line bg-field"/><figcaption class="mt-2">${titleBlock}<span class="text-muted">${escapeHtml(sketch.note)}</span></figcaption></figure></li>`;
  };

  const placesHtml = `<section aria-labelledby="places" class="mt-8"><h2 id="places" class="caption">Places</h2><ul class="mt-3 grid gap-x-8 gap-y-8 sm:grid-cols-2">${places.map(renderFigure).join("")}</ul></section>`;
  const objectsHtml = `<section aria-labelledby="objects" class="mt-12"><h2 id="objects" class="caption">Small things</h2><ul class="mt-3 grid gap-x-8 gap-y-8 sm:grid-cols-2 md:grid-cols-3">${objects.map(renderFigure).join("")}</ul></section>`;
  const peopleHtml =
    people.length > 0
      ? `<section aria-labelledby="people" class="mt-12"><h2 id="people" class="caption">People</h2><ul class="mt-3 grid gap-x-8 gap-y-8 sm:grid-cols-2 md:grid-cols-3">${people.map(renderFigure).join("")}</ul></section>`
      : "";

  return `<div class="rise"><p class="mt-2 max-w-prose text-muted">${escapeHtml(collection.intro)}</p>${placesHtml}${objectsHtml}${peopleHtml}</div>`;
}

const REQUIRED_FILENAME_SET = new Set<string>(REQUIRED_MASTER_FILENAMES);

export async function handlePortraitDownload(
  request: Request,
  filename: string,
  options: {
    records?: PortraitRecord[];
    fetchImpl?: typeof fetch;
    allowFixtures?: boolean;
  } = {},
): Promise<Response> {
  let reqUrl: URL;
  try {
    reqUrl = new URL(request.url);
  } catch {
    return Response.json({ error: "Invalid request URL" }, { status: 400 });
  }

  // Reject any query string / external URL parameters
  if (reqUrl.search.length > 0) {
    return Response.json({ error: "External URL and query parameters are not permitted" }, { status: 400 });
  }

  // Only exact required filenames are permitted
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename.includes(":") ||
    !REQUIRED_FILENAME_SET.has(filename)
  ) {
    return Response.json({ error: "Portrait master not found" }, { status: 404 });
  }

  let activeRecords: PortraitRecord[];
  if (options.records !== undefined) {
    const check = validatePortraitManifest(options.records, {
      requirePeople: false,
      allowFixtures: options.allowFixtures ?? true,
    });
    if (!check.valid || check.records.length === 0) {
      return Response.json({ error: "Portrait master not found" }, { status: 404 });
    }
    activeRecords = check.records;
  } else {
    const collection = resolveSketchesCollection(rawPortraits);
    activeRecords = collection.portraitRecords;
  }

  const record = activeRecords.find((r) => r.filename === filename);
  if (!record || !isAllowedCdnUrl(record.master.publicUrl, ".png")) {
    return Response.json({ error: "Portrait master not found" }, { status: 404 });
  }

  const fetchFn = options.fetchImpl ?? fetch;
  try {
    const upstream = await fetchFn(record.master.publicUrl, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel().catch(() => undefined);
      return Response.json({ error: "Upstream master asset unavailable" }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("image/png") && !contentType.includes("application/octet-stream")) {
      await upstream.body.cancel().catch(() => undefined);
      return Response.json({ error: "Upstream returned unexpected content type" }, { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${record.filename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Upstream master asset fetch failed" }, { status: 502 });
  }
}
