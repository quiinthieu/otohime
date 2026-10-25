// The hop between root layouts, read from the twelve stylesheets as text. The site
// and each project are separate documents, so a hop crossfades only when both
// carry @view-transition; the rule is copied into every stylesheet, never
// imported. The groups are read from app/, so a new project that forgets the
// rule fails here. scripts/probe-motion.sh watches it run in a browser.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import { site } from "../content/site.ts";

const ROOT = resolve(import.meta.dirname, "..");

// A group is a document once it has a root layout; one that holds only its
// engine (_lib/) serves nothing yet, so it has no hop to check.
const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && existsSync(join(ROOT, "app", e.name, "layout.tsx")))
  .map((e) => e.name.slice(1, -1))
  .sort();
const PROJECTS = GROUPS.filter((g) => g !== "site");

// Each group's one top-level stylesheet, comments stripped.
function stylesheet(group: string): { file: string; css: string } {
  const dir = join(ROOT, "app", `(${group})`);
  const files = readdirSync(dir).filter((f) => f.endsWith(".css"));
  assert.equal(files.length, 1, `app/(${group}) has ${files.length} top-level stylesheets`);
  const file = `app/(${group})/${files[0]}`;
  return { file, css: readFileSync(join(dir, files[0]), "utf8").replace(/\/\*[\s\S]*?\*\//g, "") };
}

type Block = { prelude: string; body: string };

// The top-level blocks of a stylesheet: rules, @media and @keyframes, each with
// its whole body (nested braces included). Statements such as @import are dropped.
function blocks(text: string): Block[] {
  const out: Block[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        const prelude = text.slice(start, open).split(";").pop()!.trim().replace(/\s+/g, " ");
        out.push({ prelude, body: text.slice(open + 1, i) });
        start = i + 1;
      }
    }
  }
  assert.equal(depth, 0, "unbalanced braces");
  return out;
}

const selectors = (b: Block) => b.prelude.split(",").map((s) => s.trim());
const rule = (top: Block[], sel: string) => top.filter((b) => !b.prelude.startsWith("@") && selectors(b).includes(sel));
const reducedMotion = (top: Block[]) => top.filter((b) => /^@media[^{]*prefers-reduced-motion:\s*reduce/.test(b.prelude));

const HOP = ":root:active-view-transition-type(hop)";
const SHEETS = GROUPS.map((g) => ({ group: g, ...stylesheet(g) }));

// The /projects rows that link to a project, as slugs: "/shore" -> "shore".
const HREFS = site.projectList.flatMap((p) => (p.href?.startsWith("/") ? [p.href.slice(1)] : []));

test("the scan finds the site and the eleven projects", () => {
  assert.ok(GROUPS.includes("site"));
  assert.equal(PROJECTS.length, 11, PROJECTS.join(", "));
  assert.equal(SHEETS.find((s) => s.group === "site")!.file, "app/(site)/globals.css");
});

for (const { group, file, css } of SHEETS) {
  const top = blocks(css);

  test(`${file} opts in to the cross-document hop`, () => {
    const at = top.filter((b) => b.prelude === "@view-transition");
    assert.equal(at.length, 1, "no single @view-transition block");
    assert.match(at[0].body, /navigation:\s*auto\s*;/);
    assert.match(at[0].body, /types:\s*hop\s*;?/);
  });

  test(`${file} fades the root out fast and in gently, on the hop alone`, () => {
    // Typed, so the site's own page changes keep the default crossfade: their root does not change.
    const old = rule(top, `${HOP}::view-transition-old(root)`);
    const now = rule(top, `${HOP}::view-transition-new(root)`);
    assert.equal(old.length, 1, `no ${HOP}::view-transition-old(root) rule`);
    assert.equal(now.length, 1, `no ${HOP}::view-transition-new(root) rule`);
    assert.ok(!top.some((b) => selectors(b).some((s) => /^::view-transition-(?:old|new)\(root\)$/.test(s))), "an untyped root rule would fade the site's own page changes");
    assert.match(old[0].body, /animation:\s*150ms ease-in both (?:vt-)?fade-out\s*;/);
    assert.match(now[0].body, /animation:\s*210ms ease-out 150ms both (?:vt-)?fade-in\s*;/);
  });

  test(`${file} defines the fade keyframes it uses`, () => {
    const used = new Set([...css.matchAll(/\b((?:vt-)?fade-(?:in|out))\b/g)].map((m) => m[1]));
    assert.ok(used.size >= 2, "uses no fade keyframes");
    const defined = top.filter((b) => b.prelude.startsWith("@keyframes ")).map((b) => b.prelude.slice("@keyframes ".length));
    for (const name of used) assert.ok(defined.includes(name), `uses ${name} but defines no @keyframes ${name}`);
  });

  test(`${file} stops the hop under reduced motion`, () => {
    const reduced = reducedMotion(top);
    assert.ok(reduced.length >= 1, "no prefers-reduced-motion block");
    const named = reduced.filter((b) => b.body.includes("::view-transition-group(*)"));
    assert.equal(named.length, 1, "no reduced-motion block names ::view-transition-group(*)");
    assert.match(named[0].body, /::view-transition-group\(\*\)[^{]*::view-transition-old\(\*\)[^{]*::view-transition-new\(\*\)\s*\{[^}]*animation-duration:\s*0s\s*!important;[^}]*animation-delay:\s*0s\s*!important/);
  });

  if (group === "site") continue;

  test(`${file} names its h1 project-${group}, a row on /projects`, () => {
    const h1 = rule(top, "h1").filter((b) => /view-transition-name/.test(b.body));
    assert.equal(h1.length, 1, "no single h1 rule with a view-transition-name");
    assert.match(h1[0].body, new RegExp(`view-transition-name:\\s*project-${group}\\s*;`));
    assert.ok(HREFS.includes(group), `/projects has no row linking /${group}`);
  });

  test(`${file} keeps its reduced-motion block last`, () => {
    const reduced = reducedMotion(top);
    assert.equal(reduced.length, 1);
    assert.equal(top.at(-1), reduced[0]);
  });
}

test("every root layout also opts in inline, so a first visit's hop does not wait on its stylesheet", () => {
  // Chromium settles the inbound opt-in before an external stylesheet that is still loading applies, whenever
  // an inline script sits behind it (every Next page has some), so the copy in the stylesheet alone cuts on a
  // first visit. scripts/probe-motion.sh proves the hop from a fresh context.
  for (const group of GROUPS) {
    const layout = readFileSync(join(ROOT, "app", `(${group})`, "layout.tsx"), "utf8");
    assert.match(layout, /<head>[\s\S]*<style>\{"@view-transition\{navigation:auto;types:hop\}"\}<\/style>[\s\S]*<\/head>/, `app/(${group})/layout.tsx`);
  }
});

test("the site root layout hands the hop to React from an inline <head> script, so a streamed reveal waits for it", () => {
  // A full load into a streamed site page (a sign-in, a hop from a project) would otherwise start React's reveal
  // transition inside the hop, and Chromium skips it with an uncaught "Transition was skipped".
  // scripts/probe-motion-signed-in.sh watches it, and strips this script by its opening to prove it can fail.
  const layout = readFileSync(join(ROOT, "app/(site)/layout.tsx"), "utf8");
  const head = layout.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
  const inline = [...head.matchAll(/<script dangerouslySetInnerHTML=\{\{ __html: (\w+) \}\} \/>/g)].map(
    ([, name]) => layout.match(new RegExp(`const ${name} = \`([^\`]*)\`;`))?.[1] ?? "",
  );
  const guard = inline.filter((s) => s.includes("pagereveal"));
  assert.equal(guard.length, 1, "no single inline <head> script listens for pagereveal");
  assert.match(guard[0], /^addEventListener\("pagereveal",function\((\w)\)\{var (\w)=\1\.viewTransition;/);
  assert.match(guard[0], /document\.__reactViewTransition=(\w);/);
  // It clears only its own hop, and never hides a rejection (finished.then(c, c) adds no unhandled one).
  assert.match(guard[0], /if\(document\.__reactViewTransition===(\w)\)document\.__reactViewTransition=null/);
  assert.doesNotMatch(guard[0], /unhandledrejection|preventDefault|\.catch\(|\.finally\(/);
});

test("every project row on /projects has a project that names its h1 after it", () => {
  const named = SHEETS.flatMap(({ css }) => [...css.matchAll(/view-transition-name:\s*project-([\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual(named.sort(), [...HREFS].sort());
  assert.equal(named.length, PROJECTS.length);
});

test("the site's root fade sits outside :root.theming, so the theme's ink spread still wins", () => {
  const top = blocks(SHEETS.find((s) => s.group === "site")!.css);
  for (const pseudo of ["::view-transition-old(root)", "::view-transition-new(root)"]) {
    const hop = top.filter((b) => selectors(b).includes(`${HOP}${pseudo}`));
    assert.equal(hop.length, 1, `no ${HOP}${pseudo} rule`);
    assert.ok(!hop[0].prelude.includes(".theming"));
    assert.ok(top.some((b) => selectors(b).includes(`:root.theming${pseudo}`)), `the ink spread lost :root.theming${pseudo}`);
  }
});

test("the row titles take their name from --vt, and a theme switch drops it", () => {
  const top = blocks(SHEETS.find((s) => s.group === "site")!.css);
  assert.match(rule(top, ".project-title")[0]?.body ?? "", /view-transition-name:\s*var\(--vt,\s*none\)/);
  assert.match(rule(top, ":root.theming .project-title")[0]?.body ?? "", /view-transition-name:\s*none/);
  const page = readFileSync(join(ROOT, "app/(site)/(app)/projects/page.tsx"), "utf8");
  assert.match(page, /className="project-title"/);
  assert.match(page, /"--vt": `project-\$\{project\.href\.slice\(1\)\}`/);
  assert.doesNotMatch(page, /viewTransitionName/, "an inline name would beat the :root.theming reset");
});

// Every site file Next renders as a page, walked from app/(site): page.tsx, not-found.tsx, forbidden.tsx,
// loading.tsx, and layout.tsx kept apart. Paths are relative to the repo.
function siteFiles(names: string[]): string[] {
  const dir = join(ROOT, "app", "(site)");
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && names.includes(e.name))
    .map((e) => relative(ROOT, join(e.parentPath, e.name)))
    .sort();
}

test("every site page hands over with a <ViewTransition> of its own", () => {
  const pages = siteFiles(["page.tsx", "not-found.tsx", "forbidden.tsx", "loading.tsx"]);
  // The rooms, the auth pages, the public pages, the 404, the 403 and the skeleton.
  assert.ok(pages.length >= 18, pages.join(", "));
  for (const name of ["not-found.tsx", "forbidden.tsx", "loading.tsx"]) {
    assert.ok(pages.some((p) => p.endsWith(name)), `no ${name} under app/(site)`);
  }
  const bare = pages.filter((p) => !readFileSync(join(ROOT, p), "utf8").includes("<ViewTransition"));
  assert.deepEqual(bare, [], "pages with no <ViewTransition>");
});

test("the pages fade like /work, and the skeleton only leaves", () => {
  for (const p of siteFiles(["page.tsx", "not-found.tsx", "forbidden.tsx"])) {
    const text = readFileSync(join(ROOT, p), "utf8");
    assert.match(text, /<ViewTransition enter="page-in" exit="page-out" default="none"/, p);
    assert.match(text, /import \{[^}]*\bViewTransition\b[^}]*\} from "react";/, p);
  }
  const loading = readFileSync(join(ROOT, "app/(site)/(app)/loading.tsx"), "utf8");
  assert.match(loading, /<ViewTransition exit="page-out" default="none">/);
});

test("an unknown address gets app/global-not-found.tsx, drawn on the server with the opt-in in its <head>", () => {
  // A notFound() from a catch-all page outside a Suspense boundary is served as Next's empty error shell and drawn
  // on the client: no inline opt-in (a hop into it aborts with "ViewTransition opt-in disabled") and a blank page
  // without JavaScript. scripts/probe-motion.sh watches the hop into the 404 and its Go home with JavaScript off.
  assert.deepEqual(siteFiles(["page.tsx"]).filter((p) => p.includes("[...")), [], "a catch-all page under app/(site)");
  assert.match(readFileSync(join(ROOT, "next.config.ts"), "utf8"), /experimental:\s*\{[^}]*\bglobalNotFound:\s*true\b/);
  const page = readFileSync(join(ROOT, "app/global-not-found.tsx"), "utf8");
  assert.match(page, /<head>[\s\S]*<style>\{"@view-transition\{navigation:auto;types:hop\}"\}<\/style>[\s\S]*<\/head>/);
  assert.match(page, /import "\.\/\(site\)\/globals\.css";/);
  assert.match(page, /import NotFound from "\.\/\(site\)\/not-found";/);
  assert.match(page, /<body[^>]*>\s*<NotFound \/>\s*<\/body>/);
});

// The JSX between a component's `return (` and its closing `);`, comments stripped.
function returned(p: string): string {
  const text = readFileSync(join(ROOT, p), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  return text.slice(text.indexOf("return ("));
}

test("the root layout stays bare, and each group layout wraps everything below its masthead", () => {
  // React runs enter and exit only for a <ViewTransition> above every node it swaps. A move between groups swaps the
  // whole group layout, so the pages' own wrappers (inside <main>) never fire and the layout's must.
  assert.doesNotMatch(readFileSync(join(ROOT, "app/(site)/layout.tsx"), "utf8"), /<ViewTransition/);
  const layouts = siteFiles(["layout.tsx"]);
  assert.deepEqual(layouts, ["(app)", "(auth)", "(home)", ""].map((g) => join("app", "(site)", g, "layout.tsx")).sort());
  for (const group of ["home", "app", "auth"]) {
    const p = `app/(site)/(${group})/layout.tsx`;
    const jsx = returned(p);
    const wrappers = [...jsx.matchAll(/<ViewTransition\b[^>]*>/g)].map((m) => m[0]);
    assert.deepEqual(wrappers, ['<ViewTransition enter="page-in" exit="page-out" default="none">'], p);
    assert.equal(jsx.match(/<\/ViewTransition>/g)?.length, 1, p);
    const open = jsx.indexOf("<ViewTransition");
    const close = jsx.indexOf("</ViewTransition>");
    const masthead = jsx.search(/<Masthead \/>|<header className="masthead">/);
    assert.ok(masthead !== -1 && masthead < open, `${p}: the masthead is not above the wrapper`);
    // Everything below the masthead is inside: nothing but the closing fragment follows the wrapper.
    assert.match(jsx.slice(close), /^<\/ViewTransition>\s*<\/>\s*\);/, `${p}: something follows the wrapper`);
    assert.doesNotMatch(jsx.slice(open, close), /<Masthead|className="masthead"/, `${p}: the masthead is inside the wrapper`);
    assert.match(readFileSync(join(ROOT, p), "utf8"), /import \{[^}]*\bViewTransition\b[^}]*\} from "react";/, p);
  }
});

test("the 404's bar, with the brand mark, stays out of its wrapper", () => {
  const jsx = returned("app/(site)/not-found.tsx");
  const header = jsx.indexOf('<header className="masthead">');
  assert.ok(header !== -1 && header < jsx.indexOf("<ViewTransition"));
  assert.match(jsx, /<header className="masthead">\s*<BrandMark \/>/);
});

test("the /projects rows rise one after another, and reduced motion drops the delay", () => {
  const { css } = SHEETS.find((s) => s.group === "site")!;
  const page = readFileSync(join(ROOT, "app/(site)/(app)/projects/page.tsx"), "utf8");
  assert.match(page, /<li\s[^>]*className="rise [^"]*"[^>]*style=\{\{ "--i": i \} as CSSProperties\}/);
  // .rise sits in a layer, so the stagger rule is matched wherever it is nested. Eleven rows of 0.4 s, 40 ms
  // apart, are all up by 0.8 s.
  assert.match(css, /\.rise\[style\*="--i"\]\s*\{\s*animation-delay:\s*calc\(var\(--i\) \* 40ms\);\s*\}/);
  const top = blocks(css);
  const all = reducedMotion(top).filter((b) => /(?:^|[\s,{])\*\s*,/.test(b.body));
  assert.equal(all.length, 1, "no reduced-motion rule for *");
  assert.match(all[0].body, /\*\s*,[^{]*\{[^}]*animation-delay:\s*0s\s*!important/);
});

test("EndFooter sits inside the group ViewTransition after main on (home) and after the grid on (app), and nowhere else", () => {
  const homeJsx = returned("app/(site)/(home)/layout.tsx");
  assert.equal(homeJsx.match(/<EndFooter \/>/g)?.length, 1);
  assert.match(homeJsx, /<\/main>\s*<EndFooter \/>\s*<\/ViewTransition>/);

  const appJsx = returned("app/(site)/(app)/layout.tsx");
  assert.equal(appJsx.match(/<EndFooter \/>/g)?.length, 1);
  assert.match(appJsx, /<\/main>\s*<\/div>\s*<EndFooter \/>\s*<\/ViewTransition>/);

  for (const bare of ["app/(site)/layout.tsx", "app/(site)/(auth)/layout.tsx", "app/(site)/not-found.tsx", "app/global-not-found.tsx"]) {
    const src = readFileSync(join(ROOT, bare), "utf8");
    assert.doesNotMatch(src, /EndFooter|<footer\b/, `${bare} must stay footer-free`);
  }
  for (const project of PROJECTS) {
    const src = readFileSync(join(ROOT, "app", `(${project})`, "layout.tsx"), "utf8");
    assert.doesNotMatch(src, /EndFooter/, `app/(${project})/layout.tsx must stay isolated from site EndFooter`);
  }

  const { css } = SHEETS.find((s) => s.group === "site")!;
  const top = blocks(css);
  const reduced = reducedMotion(top);
  assert.equal(top.at(-1), reduced.at(-1), "app/(site)/globals.css must keep its reduced-motion block last");
  const layer = top.find((b) => b.prelude === "@layer components");
  const endBlocks = blocks(layer?.body ?? "").filter((b) => /\.end\b/.test(b.prelude));
  assert.ok(endBlocks.length > 0, "missing .end rules in @layer components");
  for (const b of endBlocks) {
    assert.doesNotMatch(b.body, /view-transition-name/, `${b.prelude} must not add a view-transition-name`);
  }
});
