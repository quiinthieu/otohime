import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../content/site.ts";
import { CONSOLE_MENU, LCD, menuBaseline, PUBLIC_PAGES } from "./pages.ts";

test("PUBLIC_PAGES exposes the four core portfolio routes in order", () => {
  assert.deepEqual(PUBLIC_PAGES, [
    { href: "/", label: "Home" },
    { href: "/work", label: "Work" },
    { href: "/projects", label: "Projects" },
    { href: "/notes", label: "Notes" },
  ]);
});

test("CONSOLE_MENU lists the non-home core routes without duplicates", () => {
  assert.deepEqual(
    CONSOLE_MENU,
    PUBLIC_PAGES.filter((page) => page.href !== "/"),
  );
  assert.equal(new Set(CONSOLE_MENU.map((page) => page.href)).size, CONSOLE_MENU.length);
});

test("every console menu line fits inside the LCD", () => {
  for (let i = 0; i < CONSOLE_MENU.length; i++) {
    const y = menuBaseline(i);
    assert.ok(y >= LCD.y + 8 && y <= LCD.y + LCD.h - 3, `line ${i} at ${y}`);
  }
  assert.ok(menuBaseline(0) - 7.5 >= LCD.y);
});

test("the projects list and intro are in site", () => {
  assert.ok(Array.isArray(site.projectList));
  assert.equal(typeof site.projects, "string");
  assert.ok(site.projects.length > 0);
});

