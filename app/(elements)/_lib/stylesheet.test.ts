// Guards the two rules that keep the table still when the element dialog closes.
// Plain file reads only, so _lib stays free of React.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../elements.css", import.meta.url), "utf8");

const bodyOf = (selector: string): string | undefined => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1];
};

test("html reserves the scrollbar gutter so the grid does not reflow when the dialog toggles overflow", () => {
  const body = bodyOf("html");
  assert.ok(body, "no plain html rule");
  assert.match(body, /scrollbar-gutter:\s*stable/);
});

test("a settling table does not lift the hovered cell", () => {
  const body = bodyOf(".table[data-settle] .cell:hover");
  assert.ok(body, "no .table[data-settle] .cell:hover rule");
  assert.match(body, /transform:\s*none/);
});
