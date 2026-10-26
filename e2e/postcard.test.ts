// The Postcard Mailroom over HTTP, against a running production server: every page names a stamped Open Graph
// card that the server draws as a 1200x630 PNG, /postcard offers the twelve sheets, a postcard's link opens
// its view (noindex, its own card as og:image) and a bad link is a lost postcard, never a crash.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { test } from "node:test";
import { encodePostcard, NOTE_MAX, POSTCARD_SKETCHES } from "../lib/postcard.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
// A link-preview bot gets every tag in <head>; a browser may get metadata streamed later in the body.
const BOT = { "user-agent": "Twitterbot/1.0" };

async function html(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { headers: BOT });
  assert.equal(res.status, 200, `${path}: status ${res.status}`);
  return res.text();
}

const meta = (page: string, key: string) =>
  [...page.matchAll(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`, "g"))].map((m) => m[1]);

// og:image is absolute against the layout's metadataBase (production unless SITE_URL is set): fetch its path here.
const pathOf = (url: string) => {
  const u = new URL(url.replaceAll("&amp;", "&"));
  return u.pathname + u.search;
};

async function png(path: string): Promise<{ width: number; height: number; res: Response }> {
  const res = await fetch(`${BASE}${path}`);
  assert.equal(res.status, 200, `${path}: status ${res.status}`);
  assert.equal(res.headers.get("content-type"), "image/png", path);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG", `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), res };
}

const NOTE = "Wish you were here. <script>alert(1)</script> & 🌊";
const CODE = encodePostcard({ sketch: "lake", note: NOTE, ts: Date.UTC(2026, 9, 26) });

test("every kind of page names a stamped card, and each card is a 1200x630 PNG", async () => {
  const pages: Array<[string, RegExp]> = [
    ["/", /^\/og$/],
    ["/work", /^\/work\/opengraph-image/],
    ["/play", /^\/play\/opengraph-image/],
    ["/notes", /^\/notes\/opengraph-image/],
    ["/music", /^\/music\/opengraph-image/],
    ["/projects", /^\/projects\/opengraph-image/],
    ["/sketches", /^\/sketches\/opengraph-image/],
    ["/postcard", /^\/postcard\/opengraph-image/],
    ["/sign-in", /^\/og$/],
    ["/shore", /^\/og$/],
    ["/orrery/sun", /^\/og$/],
    ["/articles", /^\/og$/],
    ["/elements/h", /^\/og$/],
  ];
  const drawn = new Set<string>();
  for (const [page, expected] of pages) {
    const images = meta(await html(page), "og:image");
    assert.equal(images.length, 1, `${page}: ${images.length} og:image tags`);
    assert.match(images[0], /^https?:\/\//, `${page}: og:image is not absolute`);
    const path = pathOf(images[0]);
    assert.match(path, expected, `${page}: og:image ${path}`);
    if (drawn.has(path)) continue;
    drawn.add(path);
    const { width, height } = await png(path);
    assert.deepEqual([width, height], [1200, 630], path);
  }
});

test("/postcard offers the twelve sheets and a note capped at 140; /sketches links to it", async () => {
  const page = await html("/postcard");
  // The prerendered fallback desk, then the one streamed in for ?s=: each lists the twelve, in order.
  const radios = [...page.matchAll(/<input[^>]*type="radio"[^>]*name="sketch"[^>]*value="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(radios.length > 0 && radios.length % 12 === 0, `${radios.length} sketch radios`);
  assert.deepEqual(radios.slice(0, 12), POSTCARD_SKETCHES.map((s) => s.id));
  assert.match(page, /<textarea[^>]*name="note"/);
  assert.match(page, new RegExp(`${NOTE_MAX} of ${NOTE_MAX} left`));
  assert.match(page, />Stamp it</);
  assert.match(await html("/sketches"), /href="\/postcard"/);
  // ?s= picks the sheet: the streamed desk has cup checked.
  assert.match(await html("/postcard?s=cup"), /name="sketch" checked="" value="cup"/);
});

test("a postcard's link opens its view: noindex, titled, its own card as og:image, the note as text", async () => {
  const page = await html(`/postcard/view?c=${CODE}`);
  assert.match(page, /<title>A postcard: Lake · Otohime<\/title>/);
  assert.deepEqual(meta(page, "robots"), ["noindex, nofollow"]);
  const images = meta(page, "og:image");
  assert.equal(images.length, 1);
  assert.equal(pathOf(images[0]), `/postcard/image?c=${CODE}`);
  assert.deepEqual(meta(page, "twitter:card"), ["summary_large_image"]);
  assert.ok(!page.includes("<script>alert(1)</script>"), "the note reached the page as markup");
  assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; 🌊/);
  assert.match(page, /26 OCT 2026/);
});

test("/postcard/image draws the postcard as a 1200x630 PNG, cached a day and kept out of the index", async () => {
  const { width, height, res } = await png(`/postcard/image?c=${CODE}`);
  assert.deepEqual([width, height], [1200, 630]);
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.match(res.headers.get("cache-control") ?? "", /max-age=86400/);
});

test("a bad link is a lost postcard: the view says so (noindex) and the image is a 404", async () => {
  for (const code of ["junk", "", Buffer.from(JSON.stringify({ s: "../../etc/passwd", n: "", t: 1 })).toString("base64url")]) {
    const page = await html(`/postcard/view?c=${code}`);
    assert.match(page, /A lost postcard/);
    assert.deepEqual(meta(page, "robots"), ["noindex, nofollow"]);
    assert.equal(meta(page, "og:image").length, 1, "falls back to the desk's card");
    const res = await fetch(`${BASE}/postcard/image?c=${code}`);
    assert.equal(res.status, 404, `image for ${JSON.stringify(code)}`);
    await res.body?.cancel();
  }
});
