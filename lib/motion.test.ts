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
import { CONSOLE_MENU } from "./pages.ts";
import { SEASON_ATTR, SEASON_KEY, SEASONS, seasonScript } from "./seasons.ts";

const ROOT = resolve(import.meta.dirname, "..");

// A group is a document once it has a root layout; one that holds only its
// engine (_lib/) serves nothing yet, so it has no hop to check.
const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && existsSync(join(ROOT, "app", e.name, "layout.tsx")))
  .map((e) => e.name.slice(1, -1))
  .sort();
// Documents that are neither the site nor a /projects row: they hop like the rest, but have no row to name an h1
// after. The fold zine (/zine) is a sheet to print, linked from the site's footer.
const SHEETS_ONLY = ["zine"];
const PROJECTS = GROUPS.filter((g) => g !== "site" && !SHEETS_ONLY.includes(g));

// Sheets a root layout imports beside its root stylesheet, named here so no other second import slips in. The
// site's season tints (lib/seasons.ts picks the season) hold only rules keyed on data-season, and keyframes; its
// letterpress keys (lib/letterpress.test.ts) only restyle the root sheet's buttons, nav items and labels.
const TINTS: Record<string, readonly string[]> = { site: ["seasons.css", "letterpress.css"] };

// The .css files a layout imports from its own folder, in order.
const cssImports = (src: string) => [...src.matchAll(/^import "\.\/([\w.-]+\.css)";/gm)].map((m) => m[1]);

// Each group's one root stylesheet, the one its layout.tsx imports, comments stripped. A group may keep a
// feature's rules in a sheet of their own (the site's peeks.css), imported further down.
function stylesheet(group: string): { file: string; css: string } {
  const dir = join(ROOT, "app", `(${group})`);
  const layout = readFileSync(join(dir, "layout.tsx"), "utf8");
  const files = cssImports(layout).filter((f) => !(TINTS[group] ?? []).includes(f));
  assert.equal(files.length, 1, `app/(${group})/layout.tsx imports ${files.length} root stylesheets`);
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

test("the scan finds the site, the eleven projects and the zine", () => {
  assert.ok(GROUPS.includes("site"));
  assert.deepEqual(GROUPS.filter((g) => SHEETS_ONLY.includes(g)), SHEETS_ONLY);
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

  if (!SHEETS_ONLY.includes(group)) {
    test(`${file} names its h1 project-${group}, a row on /projects`, () => {
      const h1 = rule(top, "h1").filter((b) => /view-transition-name/.test(b.body));
      assert.equal(h1.length, 1, "no single h1 rule with a view-transition-name");
      assert.match(h1[0].body, new RegExp(`view-transition-name:\\s*project-${group}\\s*;`));
      assert.ok(HREFS.includes(group), `/projects has no row linking /${group}`);
    });
  }

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
  const loaders = siteFiles(["loading.tsx"]);
  assert.deepEqual(loaders, [
    "app/(site)/(app)/account/loading.tsx",
    "app/(site)/(app)/admin/loading.tsx",
    "app/(site)/(app)/dashboard/loading.tsx",
  ], "public static pages must be present in a cross-document hop snapshot");
  for (const path of loaders) {
    const loading = readFileSync(join(ROOT, path), "utf8");
    assert.match(loading, /<ViewTransition exit="page-out" default="none">/, path);
  }
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

test("the site layout loads the season tints after its root sheet, and only the site does", () => {
  // Every tint rule outranks the :root it overrides on specificity; loading after globals.css keeps it so on order too.
  // The letterpress keys share globals.css's components layer and win its key rules on order, so they load last.
  assert.deepEqual(cssImports(readFileSync(join(ROOT, "app/(site)/layout.tsx"), "utf8")), ["globals.css", "seasons.css", "letterpress.css"]);
  for (const group of PROJECTS) assert.equal(TINTS[group], undefined, group);
  const page = readFileSync(join(ROOT, "app/global-not-found.tsx"), "utf8");
  assert.ok(page.indexOf('import "./(site)/globals.css";') < page.indexOf('import "./(site)/seasons.css";'), "the 404 loads the tints after globals.css");
  assert.ok(page.includes('import "./(site)/seasons.css";'), "the 404 does not load the tints");
});

test("seasons.css tints only under data-season, and the ambient layer and dial move only where motion is welcome", () => {
  const css = readFileSync(join(ROOT, "app/(site)/seasons.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const top = blocks(css);
  const tints = top.filter((b) => b.prelude.startsWith(":root"));
  assert.deepEqual(
    tints.map((b) => b.prelude),
    SEASONS.map((s) => `:root[${SEASON_ATTR}="${s}"]`),
  );
  // Besides the tints, the keyframes and two motion queries, only the layer's own resting rules: no hop, no other
  // selector, and nothing at rest that animates or transitions.
  const rest = top.filter((b) => !b.prelude.startsWith(":root") && !b.prelude.startsWith("@keyframes "));
  assert.deepEqual(rest.map((b) => b.prelude), [
    ".season-layer",
    ".season-layer > .almanac-bit",
    "@media (prefers-reduced-motion: no-preference)",
    "@media (prefers-reduced-motion: reduce)",
  ]);
  for (const { body } of [...tints, ...rest.slice(0, 2)]) assert.doesNotMatch(body, /\b(animation|transition)\b/);
  assert.match(rest[0].body, /position:\s*fixed;[\s\S]*z-index:\s*-1;[\s\S]*pointer-events:\s*none;/);
  assert.match(rest[1].body, /opacity:\s*0;/, "a bit at rest is invisible");
  // Motion lives only under no-preference: the layer's bits, with the season's keyframes, and the dial's stops.
  const moving = blocks(rest[2].body);
  for (const b of moving) assert.ok(selectors(b).every((sel) => sel.startsWith(".season-layer") || sel === ".season-dial label"), b.prelude);
  assert.match(rule(moving, ".season-dial label")[0]?.body ?? "", /transition:\s*background-color 0\.15s ease,\s*color 0\.15s ease;/);
  const named = moving.flatMap((b) => [...b.body.matchAll(/animation-name:\s*([\w-]+);/g)].map((m) => m[1]));
  assert.deepEqual(named.sort(), ["almanac-leaf", "almanac-petal", "almanac-rain", "almanac-snow"]);
  assert.match(rule(moving, ".season-layer[data-paused] > .almanac-bit")[0]?.body ?? "", /animation-play-state:\s*paused;/);
  // Reduced motion takes animation and transition away outright from the layer and the dial, in one rule: none,
  // not the site-wide 0.01ms run.
  const still = blocks(rest[3].body);
  assert.deepEqual(
    still.map((b) => [b.prelude.replace(/\s+/g, " "), b.body.trim().replace(/\s+/g, " ")]),
    [[".season-layer, .season-layer *, .season-dial, .season-dial *", "animation: none; transition: none;"]],
  );
});

test("the site root layout mounts the season layer first in <body>, ahead of every group's masthead", () => {
  const src = readFileSync(join(ROOT, "app/(site)/layout.tsx"), "utf8");
  assert.match(src, /^import \{ SeasonLayer \} from "@\/components\/season-layer";$/m);
  // The press cue's listener (components/press-sound.tsx) renders nothing, so it may follow the layer. The Pocket
  // Terminal's loader (components/pocket-terminal-loader.tsx) renders nothing until "/" or Cmd/Ctrl-K, and its dialog
  // opens in the top layer, so it stands between the layer and the pages without moving either.
  assert.match(returned("app/(site)/layout.tsx"), /<body className="min-h-full">\s*<SeasonLayer \/>\s*(?:<PressSound \/>\s*)?<PocketTerminalLoader \/>\s*\{children\}\s*<\/body>/);
  assert.equal(src.match(/<SeasonLayer\b/g)?.length, 1);
  assert.equal(src.match(/<PressSound\b/g)?.length, 1);
  // Mounted once, in the root layout only: no group layout or page mounts a second one.
  const others = siteFiles(["layout.tsx", "page.tsx", "not-found.tsx"]).filter((p) => p !== join("app", "(site)", "layout.tsx"));
  assert.deepEqual(others.filter((p) => readFileSync(join(ROOT, p), "utf8").includes("SeasonLayer")), []);
  const layer = readFileSync(join(ROOT, "components/season-layer.tsx"), "utf8");
  assert.match(layer, /^"use client";/);
  assert.match(layer, /<svg className="season-layer" aria-hidden="true"/);
  assert.match(layer, /addEventListener\("visibilitychange"/);
  assert.match(layer, /useSyncExternalStore\(subscribeHidden, hidden, \(\) => false\)/);
});

test("both documents pin data-season in <head> before first paint, beside the theme pin", () => {
  for (const p of ["app/(site)/layout.tsx", "app/global-not-found.tsx"]) {
    const src = readFileSync(join(ROOT, p), "utf8");
    assert.match(src, /import \{ seasonScript \} from "@\/lib\/seasons";/, p);
    const head = src.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
    const scripts = [...head.matchAll(/<script dangerouslySetInnerHTML=\{\{ __html: (\w+) \}\} \/>/g)].map((m) => m[1]);
    // Right after the theme pin: both attributes land before any stylesheet-driven paint, in one place.
    assert.equal(scripts[scripts.indexOf("pinTheme") + 1], "seasonScript", `${p}: ${scripts.join(", ")}`);
    assert.doesNotMatch(src, /usePathname|"use client"/, p);
  }
  // The script is plain inline ES5 that reads the dial's key and writes the attribute the sheet keys on.
  assert.ok(seasonScript.includes(`localStorage.getItem(${JSON.stringify(SEASON_KEY)})`));
  assert.ok(seasonScript.includes(`setAttribute(${JSON.stringify(SEASON_ATTR)},s)`));
  assert.doesNotMatch(seasonScript, /=>|`|\blet\b|\bconst\b|<\/script/i);
  assert.equal(SEASON_KEY, "season");
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

test("every sketch sheet keeps its picture, caption and download inside one frame and wash", () => {
  // One Sheet draws Places, Small things and People alike, so a portrait gets the frame the day it is activated.
  const page = readFileSync(join(ROOT, "app/(site)/(app)/sketches/page.tsx"), "utf8");
  for (const kind of ["places", "objects", "people"]) {
    assert.match(page, new RegExp(`\\{${kind}\\.map\\(\\(sketch\\) => \\(\\s*<li key=\\{sketch\\.src\\}>\\s*<Sheet sketch=\\{sketch\\} />\\s*</li>`), kind);
  }
  const sheet = page.slice(page.indexOf("function Sheet("), page.indexOf("export default"));
  // The figure stays bare (walk-sketches.sh counts '<figure>'), and the wrapper holds the art and nothing else.
  assert.match(sheet, /<figure>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<div className="sheet">\s*<Image\b[\s\S]*?\/>\s*<span className="sheet-wash" aria-hidden="true" \/>\s*<svg className="sheet-frame"[^>]*aria-hidden="true"[^>]*>\s*<path [^>]*pathLength=\{1\}[^>]*\/>\s*<\/svg>\s*<\/div>\s*<figcaption/);
  assert.match(sheet, /width=\{dims\.width\}\s*height=\{dims\.height\}\s*sizes=\{dims\.sizes\}/);
  assert.match(sheet, /href=\{sketch\.downloadHref\}\s*download=\{sketch\.downloadFilename\}/);
  assert.match(sheet, /viewBox=\{`0 0 \$\{dims\.width\} \$\{dims\.height\}`\}/, "the frame's viewBox is the sketch's own size, so it scales evenly");
  assert.doesNotMatch(sheet, /filter|vectorEffect|Math\.random|"use client"/);
  // Scroll timelines are CSS, so they would run with JavaScript off; a <noscript> style stands the sheets still.
  assert.match(page, /<noscript>\s*<style>\{"\.sheet-wash,\.sheet-frame path\{animation:none!important\}"\}<\/style>\s*<\/noscript>/);
});

test("the sketch sheets rest whole and draw on scroll only where view timelines exist, and never under reduced motion", () => {
  const { css } = SHEETS.find((s) => s.group === "site")!;
  const top = blocks(css);
  const [wash] = rule(top, ".sheet-wash");
  const [path] = rule(top, ".sheet-frame path");
  assert.match(rule(top, ".sheet")[0]?.body ?? "", /view-timeline:\s*--sheet block;/);
  // The resting pose is the base style: the wash scaled away, the frame fully drawn, nothing animating.
  assert.match(wash?.body ?? "", /transform:\s*scaleX\(0\);/);
  assert.match(path?.body ?? "", /stroke-dasharray:\s*1;[\s\S]*stroke-dashoffset:\s*0;/);
  for (const b of [wash, path]) assert.doesNotMatch(b.body, /animation|filter|transition/);
  // Every scroll-driven rule sits in the one @supports block, after its shorthand so the timeline is not reset.
  const supports = top.filter((b) => /^@supports \(animation-timeline: view\(\)\)$/.test(b.prelude));
  assert.equal(supports.length, 1);
  for (const [sel, name] of [[".sheet-wash", "sheet-wash"], [".sheet-frame path", "sheet-draw"]]) {
    const inner = blocks(supports[0].body).filter((b) => b.prelude === sel);
    assert.equal(inner.length, 1, sel);
    assert.match(inner[0].body, new RegExp(`animation:\\s*${name} linear both;\\s*animation-timeline:\\s*--sheet;\\s*animation-range:\\s*entry \\d+% entry \\d+%;`), sel);
  }
  assert.equal(css.match(/animation-timeline:\s*--sheet/g)?.length, 2, "a --sheet timeline outside @supports");
  // Each keyframe animates from somewhere, back to the base style.
  assert.match(top.find((b) => b.prelude === "@keyframes sheet-wash")?.body ?? "", /^\s*from\s*\{\s*transform:\s*scaleX\(1\);\s*\}\s*$/);
  assert.match(top.find((b) => b.prelude === "@keyframes sheet-draw")?.body ?? "", /^\s*from\s*\{\s*stroke-dashoffset:\s*1;\s*\}\s*$/);
  // A shortened duration does not stop a scroll timeline, so the final reduced-motion block turns them off.
  const last = top.at(-1)!;
  assert.equal(last, reducedMotion(top).at(-1));
  assert.match(last.body, /\.sheet-wash,\s*\.sheet-frame path\s*\{\s*animation:\s*none !important;\s*\}/);
});

// The pocket console's A (components/handheld.tsx): its chosen line, as HTML over the LCD, and the page's h1 are a
// named pair, title-<page>, and the navigation is typed console, which zooms the arriving page out of the LCD.
// scripts/probe-console-zoom.sh watches it run.
test("each console page names its h1 for the console's label, once, and nothing else takes a title name", () => {
  const pages = siteFiles(["page.tsx"]);
  const morphs = pages.flatMap((p) => [...readFileSync(join(ROOT, p), "utf8").matchAll(/\bmorph="([^"]+)"/g)].map((m) => `${p} ${m[1]}`));
  assert.deepEqual(
    morphs.sort(),
    CONSOLE_MENU.map(({ href }) => `app/(site)/(app)${href}/page.tsx ${href}`).sort(),
  );
  // FigTitle and StampHeading (Play) wrap their h1 alone, and only when asked.
  for (const p of ["components/figures.tsx", "components/stamp-heading.tsx"]) {
    const text = readFileSync(join(ROOT, p), "utf8");
    assert.match(text, /\{morph \? <TitleMorph page=\{morph\}>\{h1\}<\/TitleMorph> : h1\}/, p);
    assert.match(text, /const h1 = \(\s*<h1\b/, p);
  }
  // The names come from one place; no page, stylesheet or component spells one out.
  const figures = readFileSync(join(ROOT, "components/figures.tsx"), "utf8");
  assert.match(figures, /export const titleName = \(page: ConsolePage\) => `title-\$\{page\.slice\(1\)\}`;/);
  assert.match(figures, /<ViewTransition name=\{titleName\(page\)\} share="console-title" default="none">/);
  assert.match(figures, /export const CONSOLE_TRANSITION = "console";/);
  for (const p of [...pages, "app/(site)/globals.css", "components/handheld.tsx"]) {
    assert.doesNotMatch(readFileSync(join(ROOT, p), "utf8"), /["'\s:]title-(?:work|play|notes|music|projects|sketches)\b/, p);
  }
});

test("the console's label is the one HTML source of the pair, and only its A carries the console type", () => {
  const text = readFileSync(join(ROOT, "components/handheld.tsx"), "utf8");
  const jsx = text.slice(text.indexOf("const label = ("), text.indexOf("const art = ("));
  assert.match(jsx, /<TitleMorph key=\{shown\.href\} page=\{shown\.href\}>\s*<span\s+className="console-label"\s+aria-hidden="true"/);
  assert.equal(text.match(/<TitleMorph\b/g)?.length, 1);
  // The SVG text is never named: the label is the pair's source.
  assert.doesNotMatch(text.slice(text.indexOf("const art = (")), /<TitleMorph|viewTransitionName|view-transition-name/);
  const open = text.slice(text.indexOf("function open()"), text.indexOf("// B: into the game"));
  // Reduced motion: a plain push with no label. Otherwise the label is committed first and the push comes later.
  assert.match(open, /if \(matchMedia\(REDUCED\)\.matches\) \{\s*setTimeout\(\(\) => router\.push\(href\), 0\);\s*return;\s*\}/);
  assert.match(open, /setOpening\(href\);[\s\S]*setTimeout\(\(\) => router\.push\(href, \{ transitionTypes: \[CONSOLE_TRANSITION\] \}\), PRESS_MS\);/);
  assert.equal(text.match(/transitionTypes/g)?.length, 1, "one typed push");
  const press = Number(/const PRESS_MS = (\d+);/.exec(text)?.[1]);
  assert.ok(press > 0 && press <= 200, `PRESS_MS ${press}`);
  // The menu's plain links stay plain.
  assert.match(text, /<Link href=\{href\} className="btn btn-sm">/);
});

test("the console zoom is typed, from the LCD, within 400 ms, and the label rests hidden", () => {
  const { css } = SHEETS.find((s) => s.group === "site")!;
  const top = blocks(css);
  const ms = (body: string) => [...body.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
  // The untyped page fade is unchanged.
  assert.match(rule(top, "::view-transition-new(.page-in)")[0]?.body ?? "", /^\s*animation:\s*210ms ease-out 150ms both fade-in;\s*$/);
  const zoom = rule(top, ":root:active-view-transition-type(console)::view-transition-new(.page-in)");
  assert.equal(zoom.length, 1, "no typed console zoom rule");
  assert.match(zoom[0].body, /transform-origin:\s*var\(--zx, 50%\) var\(--zy, 50%\);/);
  assert.match(zoom[0].body, /animation:\s*\d+ms (?:cubic-bezier\([^)]*\)|[\w-]+) both console-zoom,\s*\d+ms ease-out both fade-in;/);
  const zoomTimes = ms(zoom[0].body);
  assert.ok(zoomTimes.length === 2 && zoomTimes.every((t) => t <= 400), `${zoomTimes}`);
  assert.ok(!top.some((b) => !b.prelude.startsWith("@") && /console-zoom/.test(b.body) && !selectors(b).every((s) => s.startsWith(":root:active-view-transition-type(console)"))), "an untyped rule runs console-zoom");
  assert.match(top.find((b) => b.prelude === "@keyframes console-zoom")?.body ?? "", /^\s*from\s*\{\s*transform:\s*scale\(0\.\d+\);\s*\}\s*$/);
  const morph = rule(top, "::view-transition-group(.console-title)");
  assert.equal(morph.length, 1);
  assert.ok(ms(morph[0].body).every((t) => t <= 400) && ms(morph[0].body).length === 1);
  // The rules sit before the final reduced-motion block, which zeroes every transition animation.
  assert.equal(top.at(-1), reducedMotion(top).at(-1));
  // The label: hidden at rest, shown only while A opens, never animated itself.
  const layer = blocks(top.find((b) => b.prelude === "@layer components")?.body ?? "");
  const label = layer.find((b) => b.prelude === ".console-label");
  assert.match(label?.body ?? "", /visibility:\s*hidden;/);
  assert.match(layer.find((b) => b.prelude === ".console-label[data-open]")?.body ?? "", /^\s*visibility:\s*visible;\s*$/);
  assert.doesNotMatch(label?.body ?? "", /animation|transition:|view-transition-name/);
});

// The Pocket Terminal's sheet, named here: imported only by the lazy terminal (components/pocket-terminal.tsx), so
// no root layout carries it and no page pays for it before the first "/" or Cmd/Ctrl-K. Its one motion, the ink
// settling as the dialog opens, stops under reduced motion.
const TERMINAL_SHEET = "components/pocket-terminal.css";

test(`${TERMINAL_SHEET} rides the lazy terminal only, and its open animation stops under reduced motion`, () => {
  const importers = ["components", ...GROUPS.map((g) => `app/(${g})`)].flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && readFileSync(join(ROOT, dir, f), "utf8").includes("pocket-terminal.css"))
      .map((f) => `${dir}/${f}`),
  );
  assert.deepEqual(importers, ["components/pocket-terminal.tsx"]);
  for (const group of GROUPS) {
    const imports = cssImports(readFileSync(join(ROOT, "app", `(${group})`, "layout.tsx"), "utf8"));
    assert.ok(!imports.some((f) => f.includes("pocket-terminal")), `app/(${group})/layout.tsx`);
  }
  const top = blocks(readFileSync(join(ROOT, TERMINAL_SHEET), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""));
  const animated = top.filter((b) => !b.prelude.startsWith("@") && /\banimation:\s*(?!none)/.test(b.body));
  assert.deepEqual(animated.map((b) => b.prelude), [".pocket-terminal[open]"]);
  const reduced = reducedMotion(top);
  assert.equal(reduced.length, 1);
  assert.equal(top.at(-1), reduced[0], "the reduced-motion block comes last, so it wins on order");
  assert.match(reduced[0].body, /\.pocket-terminal\[open\]\s*\{\s*animation:\s*none;/);
});
