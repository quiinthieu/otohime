import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../content/site.ts";
import { CONSOLE_MENU, DESK_PAGE, LCD, menuBaseline, PUBLIC_PAGES } from "./pages.ts";

test("/projects is the sixth public page", () => {
  assert.equal(PUBLIC_PAGES[5].href, "/projects");
});

test("the console menu excludes Home, Lab and Apps, then adds the desk cartridge", () => {
  assert.deepEqual(CONSOLE_MENU, [...PUBLIC_PAGES.filter((page) => page.href !== "/" && page.href !== "/lab" && page.href !== "/apps"), { href: "/desk", label: "Desk" }]);
  assert.equal(CONSOLE_MENU.length, 7);
  assert.equal(new Set(CONSOLE_MENU.map((page) => page.href)).size, CONSOLE_MENU.length);
});

test("the desk is a console cartridge only: not in the nav's public pages", () => {
  assert.equal(DESK_PAGE.href, "/desk");
  assert.ok(!PUBLIC_PAGES.some((page) => (page.href as string) === "/desk"));
  assert.equal(CONSOLE_MENU.at(-1), DESK_PAGE);
});

test("/sketches is the seventh public page", () => {
  assert.equal(PUBLIC_PAGES[6].href, "/sketches");
});

test("the sketches collection is in site", () => {
  assert.equal(site.sketches.length, 22);
  assert.equal(site.sketches.filter((sketch) => sketch.kind === "person").length, 10);
  assert.equal(
    site.sketchesIntro,
    "Twenty-two studies from one sketchbook. Places first, then the things that sit still, and the people.",
  );
});

test("every console menu line fits inside the LCD", () => {
  for (let i = 0; i < CONSOLE_MENU.length; i++) {
    const y = menuBaseline(i);
    assert.ok(y >= LCD.y + 8 && y <= LCD.y + LCD.h - 3, `line ${i} at ${y}`);
  }
  // The cursor's top (baseline - 7) and the label's top (baseline - 7.5) stay on the screen too.
  assert.ok(menuBaseline(0) - 7.5 >= LCD.y);
});

test("the projects list and intro are in site", () => {
  assert.ok(Array.isArray(site.projectList));
  assert.equal(typeof site.projects, "string");
  assert.ok(site.projects.length > 0);
});

test("Ink Lab is public without adding an eighth physical LCD cartridge", () => {
  assert.ok(PUBLIC_PAGES.some(page => page.href === "/lab" && page.label === "Ink Lab"));
  assert.ok(!CONSOLE_MENU.some(page => (page.href as string) === "/lab"));
});

test("Apps follows /sketches in PUBLIC_PAGES without adding an eighth physical LCD cartridge", () => {
  assert.deepEqual(PUBLIC_PAGES[7], { href: "/apps", label: "Apps" });
  assert.equal(CONSOLE_MENU.length, 7);
  assert.ok(!CONSOLE_MENU.some(page => (page.href as string) === "/apps"));
});
