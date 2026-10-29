import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CODE_MAX,
  cleanNote,
  decodePostcard,
  encodePostcard,
  NOTE_MAX,
  noteLength,
  POSTCARD_SKETCHES,
  postcardFilename,
  postcardPaths,
  postmarkDate,
  sketchById,
  validatePostcard,
  type Postcard,
} from "./postcard.ts";
import { BASE_SKETCHES } from "./sketches.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const TS = Date.UTC(2026, 9, 26, 9, 30);
const card = (over: Partial<Postcard> = {}): Postcard => ({ sketch: "cove", note: "Wish you were here.", ts: TS, ...over });
const raw = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

test("the allow-list is the sketchbook's twelve, in order, with their files and titles", () => {
  assert.equal(POSTCARD_SKETCHES.length, 12);
  assert.deepEqual(
    POSTCARD_SKETCHES.map((s) => [s.src, s.title]),
    BASE_SKETCHES.map((s) => [s.src, s.title]),
  );
  assert.equal(new Set(POSTCARD_SKETCHES.map((s) => s.id)).size, 12);
  for (const s of POSTCARD_SKETCHES) {
    assert.match(s.id, /^[a-z]+$/);
    assert.ok(existsSync(new URL(`../public${s.src}`, import.meta.url)), `${s.src} is missing from public/`);
  }
  assert.equal(sketchById("lake")?.title, "Lake");
  assert.equal(sketchById("../etc/passwd"), undefined);
});

test("a postcard survives the round trip, unicode and emoji included", () => {
  for (const note of ["Wish you were here.", "", "お元気ですか 🌊", "a < b & \"c\" </script>"]) {
    const postcard = card({ note });
    const code = encodePostcard(postcard);
    assert.match(code, /^[A-Za-z0-9_-]+$/, "base64url, no padding");
    assert.deepEqual(decodePostcard(code), postcard);
  }
});

test("every sketch on the list encodes and decodes", () => {
  for (const { id } of POSTCARD_SKETCHES) assert.equal(decodePostcard(encodePostcard(card({ sketch: id })))?.sketch, id);
});

test("the code uses short keys, so a full 140-character note stays well under CODE_MAX", () => {
  const code = encodePostcard(card({ note: "あ".repeat(NOTE_MAX) }));
  assert.ok(code.length < CODE_MAX / 1.5, `${code.length}`);
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(code, "base64url").toString())), ["s", "n", "t"]);
});

test("cleanNote strips controls and bidi overrides, flattens line breaks and caps at 140 code points", () => {
  assert.equal(cleanNote("  hi\n\nthere\tfriend  "), "hi there friend");
  assert.equal(cleanNote("a\u0000b\u0007c\u001bd\u007fe\u0085f"), "abcdef");
  assert.equal(cleanNote("evil‮gnp.exe⁦x⁩"), "evilgnp.exex");
  assert.equal(Array.from(cleanNote("x".repeat(500))).length, NOTE_MAX);
  // 139 letters then an emoji: the cut keeps the emoji whole instead of half a surrogate pair.
  const near = "x".repeat(139) + "🌊🌊";
  assert.equal(cleanNote(near), "x".repeat(139) + "🌊");
  assert.equal(cleanNote("\u0001\u0002"), "");
});

test("noteLength counts the stripped note before any cut, so the picker can say it is over", () => {
  assert.equal(noteLength("  a\n\nb\u0000  "), 3);
  assert.equal(noteLength("🌊".repeat(3)), 3);
  assert.equal(noteLength("x".repeat(NOTE_MAX + 27)), NOTE_MAX + 27);
  // The desk counts with it: counting the cut note could never go over.
  assert.match(read("app/(site)/(app)/postcard/_components/desk.tsx"), /const left = NOTE_MAX - noteLength\(note\);/);
});

test("validatePostcard refuses unknown sketches, non-string or over-long notes and bad timestamps", () => {
  assert.equal(validatePostcard(card()).ok, true);
  const bad: Array<[unknown, string]> = [
    [null, "not an object"],
    [[], "not an object"],
    ["cove", "not an object"],
    [{ ...card(), sketch: "nope" }, "unknown sketch"],
    [{ ...card(), sketch: "/sketches/01-cove.jpg" }, "unknown sketch"],
    [{ ...card(), sketch: "toString" }, "unknown sketch"],
    [{ ...card(), note: 42 }, "note is not a string"],
    [{ ...card(), note: "x".repeat(NOTE_MAX + 1) }, "note is too long"],
    [{ ...card(), ts: 1.5 }, "bad timestamp"],
    [{ ...card(), ts: "2026-10-26" }, "bad timestamp"],
    [{ ...card(), ts: Date.UTC(2019, 11, 31) }, "bad timestamp"],
    [{ ...card(), ts: Date.UTC(2100, 0, 2) }, "bad timestamp"],
    [{ ...card(), ts: Number.NaN }, "bad timestamp"],
  ];
  for (const [input, error] of bad) assert.deepEqual(validatePostcard(input), { ok: false, error }, JSON.stringify(input));
  // Exactly 140 is fine, and the controls do not count toward it.
  assert.equal(validatePostcard({ ...card(), note: "x".repeat(NOTE_MAX) + "\u0000\u0000" }).ok, true);
});

test("validatePostcard hands back the cleaned note, so what is shown never holds a control", () => {
  const result = validatePostcard({ ...card(), note: "line one\nline\u0000 two" });
  assert.ok(result.ok);
  assert.equal(result.postcard.note, "line one line two");
});

test("encodePostcard throws on an invalid postcard instead of minting a bad link", () => {
  assert.throws(() => encodePostcard(card({ sketch: "nope" as never })), /unknown sketch/);
  assert.throws(() => encodePostcard(card({ note: "x".repeat(NOTE_MAX + 1) })), /too long/);
});

test("decodePostcard returns null for anything that is not a postcard", () => {
  const junk = [
    undefined,
    null,
    "",
    "not base64!",
    "a".repeat(CODE_MAX + 1),
    "%7B%7D",
    Buffer.from("not json").toString("base64url"),
    Buffer.from([0xff, 0xfe, 0x00]).toString("base64url"),
    raw([1, 2, 3]),
    raw("cove"),
    raw({ s: "nope", n: "", t: TS }),
    raw({ s: "cove", n: "x".repeat(NOTE_MAX + 1), t: TS }),
    raw({ s: "cove", n: "", t: -1 }),
    raw({ s: "cove", t: TS }),
    raw({ sketch: "cove", note: "", ts: TS }),
  ];
  for (const code of junk) assert.equal(decodePostcard(code as string), null, String(code).slice(0, 40));
});

test("decodePostcard strips controls a hand-made code smuggles in", () => {
  const code = raw({ s: "key", n: "hi\u0007‮ there", t: TS });
  assert.deepEqual(decodePostcard(code), { sketch: "key", note: "hi there", ts: TS });
});

test("postcardPaths, postmarkDate and postcardFilename", () => {
  const code = encodePostcard(card());
  assert.deepEqual(postcardPaths(code), { view: `/postcard/view?c=${code}`, image: `/postcard/image?c=${code}` });
  assert.equal(postmarkDate(TS), "26 OCT 2026");
  assert.equal(postmarkDate(Date.UTC(2027, 0, 3, 23, 59)), "03 JAN 2027");
  assert.equal(postcardFilename(card()), "postcard-cove-2026-10-26.png");
});

test("lib/postcard.ts stays pure: no imports, no network, no storage, no React", () => {
  const src = read("lib/postcard.ts");
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bprocess\.env\b/);
});

// The mailroom's wiring, read as source: Next's metadata files and layouts are not importable under node --test.
const SEGMENTS = ["work", "play", "notes", "music", "projects", "sketches", "postcard"];
const ROOT_LAYOUTS = readdirSync(new URL("../app", import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name))
  .map((e) => `app/${e.name}/layout.tsx`);

test("each site room has its own titled stamp, drawn by lib/og.tsx at 1200x630", () => {
  for (const segment of SEGMENTS) {
    const src = read(`app/(site)/(app)/${segment}/opengraph-image.tsx`);
    assert.match(src, /from "@\/lib\/og"/, segment);
    assert.match(src, /export const size = OG_SIZE/, segment);
    assert.match(src, /export const contentType = OG_CONTENT_TYPE/, segment);
    assert.match(src, new RegExp(`stamp\\("[^"]+", "otohime\\.dev/${segment}"\\)`), segment);
  }
  const og = read("lib/og.tsx");
  assert.match(og, /OG_SIZE = \{ width: 1200, height: 630 \}/);
  assert.match(og, /process\.env\.BUILD_DATE/);
  assert.match(og, /<svg/);
  assert.match(read("next.config.ts"), /BUILD_DATE: process\.env\.BUILD_DATE \?\? new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
});

test("every root layout and the global 404 set metadataBase and name the shared /og stamp", () => {
  assert.ok(ROOT_LAYOUTS.length >= 12, `${ROOT_LAYOUTS.length} root layouts`);
  for (const file of [...ROOT_LAYOUTS, "app/global-not-found.tsx"]) {
    const src = read(file);
    assert.match(src, /metadataBase: new URL\(process\.env\.SITE_URL \?\? "https:\/\/otohime\.dev"\)/, file);
    assert.match(src, /openGraph: \{ images: \[\{ url: "\/og", alt: "[^"]+", width: 1200, height: 630 \}\] \}/, file);
  }
  assert.match(read("app/og/route.tsx"), /export function GET\(request: NextRequest\)/);
});

test("the view is noindex with its own card; the image route only draws decoded, allow-listed postcards", () => {
  const view = read("app/(site)/(app)/postcard/view/page.tsx");
  assert.match(view, /robots = \{ index: false, follow: false \}/);
  assert.match(view, /images: \[image\]/);
  assert.match(view, /postcardPaths\(code\)\.image/);
  assert.doesNotMatch(view, /dangerouslySetInnerHTML/);
  const route = read("app/(site)/(app)/postcard/image/route.tsx");
  assert.match(route, /decodePostcard\(request\.nextUrl\.searchParams\.get\("c"\)\)/);
  assert.match(route, /status: 404/);
  assert.match(route, /sketchById\(postcard\.sketch\)/);
});

test("the desk shares with download and navigator.share, falling back to copying the link", () => {
  const desk = read("app/(site)/(app)/postcard/_components/desk.tsx");
  assert.match(desk, /^"use client";/);
  assert.match(desk, /download=\{postcardFilename\(stamped\.postcard\)\}/);
  assert.match(desk, /navigator\.share\(/);
  assert.match(desk, /navigator\.clipboard\.writeText\(url\)/);
  assert.match(desk, /AbortError/);
});

test("first-load JS of / and /play stays put: shared client code never reaches the mailroom", () => {
  // Importing next/image in the desk made Turbopack re-export it through a chunk /play shares (+55 bytes), so
  // the thumbnails are drawn by the server page instead.
  assert.doesNotMatch(read("app/(site)/(app)/postcard/_components/desk.tsx"), /from "next\/image"/);
  for (const file of ["app/(site)/(home)/page.tsx", "app/(site)/(app)/play/page.tsx", "app/(site)/(app)/layout.tsx", "app/(site)/layout.tsx"]) {
    assert.doesNotMatch(read(file), /lib\/(postcard|og)|postcard\//, file);
  }
});
