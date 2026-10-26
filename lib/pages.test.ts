import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../content/site.ts";
import { CONSOLE_MENU, DESK_PAGE, LCD, menuBaseline, PUBLIC_PAGES } from "./pages.ts";

test("/projects is the sixth public page", () => {
  assert.equal(PUBLIC_PAGES[5].href, "/projects");
});

test("the console menu is the public pages minus Home, in order, then the desk cartridge", () => {
  assert.deepEqual(CONSOLE_MENU, [...PUBLIC_PAGES.filter((page) => page.href !== "/"), { href: "/desk", label: "Desk" }]);
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
  assert.equal(site.sketches.length, 12);
  assert.equal(typeof site.sketchesIntro, "string");
  assert.ok(site.sketchesIntro.length > 0);
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
