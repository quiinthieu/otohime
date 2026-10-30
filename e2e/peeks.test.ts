// Fan-out peeks over HTTP, against a running production server: the markers the pages ship, the index the
// layer fetches and every card's destination. What the layer does with them in a browser (hover, focus,
// long-press, reduced motion, edges) is scripts/probe-peeks.sh.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { before, test } from "node:test";
import { site } from "../content/site.ts";
import { peekSlug, type PeekIndex } from "../lib/peeks.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";

type Tag = { name: string; attrs: Record<string, string>; text: string };

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function attrsOf(open: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of open.matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)) out[m[1]] = decode(m[2] ?? "");
  return out;
}

// Every <a> and <button> in the page, with its attributes and its text.
function controls(html: string): Tag[] {
  return [...html.matchAll(/<(a|button)(\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map((m) => ({
    name: m[1],
    attrs: attrsOf(m[2] ?? ""),
    text: decode(m[3].replace(/<[^>]+>/g, "")).trim(),
  }));
}

const marked = (html: string) => controls(html).filter((t) => "data-peek" in t.attrs);

async function page(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`);
  assert.equal(res.status, 200, `${path}: status ${res.status}`);
  return res.text();
}

let index: PeekIndex;

before(async () => {
  const res = await fetch(`${BASE}/peeks.json`);
  assert.equal(res.status, 200, "/peeks.json is served");
  assert.match(res.headers.get("content-type") ?? "", /json/);
  index = (await res.json()) as PeekIndex;
});

test("the served index has three distinct, known items behind every key", () => {
  assert.equal(index.version, 1);
  const keys = Object.keys(index.peeks);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    const ids = index.peeks[key];
    assert.equal(ids.length, 3, key);
    assert.equal(new Set(ids).size, 3, `${key}: distinct`);
    for (const id of ids) assert.ok(index.items[id], `${key} -> ${id}`);
  }
});

test("/projects marks each project title and each Gazette desk, and they stay ordinary links", async () => {
  const html = await page("/projects");
  assert.match(html, /<span id="peek-hint" hidden="">[^<]+<\/span>/, "the layer's hint is in the shell");
  const marks = marked(html);
  const projects = site.projectList.filter((p) => p.href);
  for (const p of projects) {
    const key = `project:${peekSlug(p.title)}`;
    const link = marks.find((m) => m.attrs["data-peek"] === key);
    assert.ok(link, `${p.title} is marked ${key}`);
    assert.equal(link.name, "a");
    assert.equal(link.attrs.href, p.href, `${p.title} keeps its own href`);
    assert.equal(link.attrs.class, "project-title", `${p.title} keeps its class (and its hop name)`);
    assert.equal(link.attrs["aria-describedby"], "peek-hint");
  }
  const tags = Object.keys(index.peeks).filter((k) => k.startsWith("tag:"));
  assert.ok(tags.length >= 3, "the index has Gazette desks");
  for (const key of tags) {
    const link = marks.find((m) => m.attrs["data-peek"] === key);
    assert.ok(link, `${key} is on /projects`);
    assert.equal(link.name, "a");
    assert.equal(link.attrs.href, "/articles");
    assert.equal(link.text.toLowerCase(), key.slice("tag:".length).replace(/-/g, " "));
  }
  assert.equal(marks.length, projects.length + tags.length, "nothing else on /projects is marked");
});

test("/music marks each listed credit as a button, never a link", async () => {
  const html = await page("/music");
  const credits = marked(html).filter((m) => m.attrs["data-peek"].startsWith("credit:"));
  for (const song of site.songs) {
    const key = `credit:${peekSlug(song.artist)}`;
    const button = credits.find((m) => m.attrs["data-peek"] === key);
    assert.ok(button, `${song.artist} is marked ${key}`);
    assert.equal(button.name, "button");
    assert.equal(button.attrs.type, "button");
    assert.equal(button.text, song.artist);
    assert.equal(button.attrs["aria-describedby"], "peek-hint");
  }
});

test("negative control: unmarked pages and the nav carry no marker, and no marker names an unknown key", async () => {
  for (const path of ["/projects", "/music", "/notes", "/sketches", "/work", "/play"]) {
    const html = await page(path);
    const all = controls(html);
    const nav = all.filter((t) => (t.attrs.class ?? "").split(/\s+/).includes("nav-item"));
    assert.ok(nav.length > 0, `${path} has its nav`);
    assert.ok(nav.every((t) => !("data-peek" in t.attrs)), `${path}: nav links are not marked`);
    for (const m of marked(html)) assert.ok(index.peeks[m.attrs["data-peek"]], `${path}: ${m.attrs["data-peek"]} is in the index`);
    if (path !== "/projects" && path !== "/music") assert.equal(marked(html).length, 0, `${path} is not marked`);
    assert.ok(!html.includes('id="peek-panel"'), `${path}: no fan is open in the served page`);
  }
});

test("every card goes somewhere real: each destination answers 200 and has its #section", async () => {
  const items = Object.values(index.items);
  const paths = [...new Set(items.map((i) => i.href.split("#")[0]))];
  const pages = new Map<string, string>();
  for (const path of paths) pages.set(path, await page(path));
  for (const item of items) {
    const [path, hash] = item.href.split("#");
    assert.ok(path.startsWith("/") && !path.startsWith("//"), `${item.href} is internal`);
    if (hash) assert.match(pages.get(path)!, new RegExp(`id="${hash}"`), `${item.href}: #${hash} is on the page`);
  }
  for (const src of new Set(items.flatMap((i) => (i.src ? [i.src] : [])))) {
    const res = await fetch(new URL(src, BASE), { method: "HEAD" });
    assert.equal(res.status, 200, `${src}`);
  }
});
