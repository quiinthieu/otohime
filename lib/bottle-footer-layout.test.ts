import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const globalCSS = readFileSync(new URL("../app/(site)/globals.css", import.meta.url), "utf8");
const buttonCSS = readFileSync(new URL("../components/bottle/button.css", import.meta.url), "utf8");
const rule = (css: string, selector: string) => {
  const body = css.split(`${selector} {`)[1]?.split("}")[0];
  assert.ok(body, `missing stylesheet rule ${selector}`);
  return body;
};
const entry = rule(buttonCSS, ".bottle-entry");
const anchor = rule(buttonCSS, ".bottle-footer-entry");
const band = rule(globalCSS, ".end-inner");
const topRem = Number(band.match(/padding-block:\s*([\d.]+)rem/)?.[1]);
const textRem = Number(entry.match(/font-size:\s*([\d.]+)rem/)?.[1]);
const gapRem = Number(anchor.match(/margin-block-end:\s*([\d.]+)rem/)?.[1]);
const minHeight = Number(entry.match(/min-height:\s*([\d.]+)px/)?.[1]);

// Independent vertical box model, relative to the content edge BELOW both
// footer rules. The browser suite measures real glyphs, borders and the cascade.
function clearance(root: number, text: number, padding = topRem, oldOffset?: number) {
  const height = Math.max(minHeight, text * 1.3 + 12); // chip: 5px padding + 1px border per edge
  const scene = padding * root;
  const bottom = oldOffset === undefined ? scene - gapRem * root : scene + oldOffset * root + height;
  return { height, top: bottom - height, gap: scene - bottom };
}
function assertContained(box: ReturnType<typeof clearance>) {
  assert.ok(box.gap >= 0, "scene-top separation");
  assert.ok(box.top >= 0, "footer top-border containment");
  assert.ok(box.height >= 44, "44px touch target");
}

test("Bottle stylesheet reserves a rem header band with a bottom anchor and 44px targets", () => {
  assert.ok(topRem >= 3.75);
  assert.ok(textRem > 0 && textRem <= 1);
  assert.ok(minHeight >= 44);
  assert.ok(gapRem > 0);
  assert.match(anchor, /position:\s*absolute;/);
  assert.match(anchor, /inset-block-end:\s*100%;/);
  assert.doesNotMatch(anchor, /inset-block-start|\btop\s*:/);
});

test("Bottle clearance contains default, 24px and 32px text at normal and 200% roots", () => {
  for (const root of [16, 32]) {
    for (const text of [textRem * root, 24, 32]) assertContained(clearance(root, text));
  }
  const normal = clearance(16, textRem * 16);
  const scaled = clearance(32, textRem * 32);
  assert.ok(scaled.height > normal.height, "rem scaling grows the actual target height");
  assert.equal(scaled.gap, normal.gap * 2, "scene margin scales with the root");
});

test("Bottle clearance rejects the old -2.4rem scene overlap using the same invariant", () => {
  const old = clearance(16, 24, topRem, -2.4);
  assert.ok(old.gap < 0);
  assert.throws(() => assertContained(old), /scene-top separation/);
});

test("Bottle clearance rejects the old 2.5rem top-border protrusion using the same invariant", () => {
  const old = clearance(16, 24, 2.5);
  assert.ok(old.gap > 0, "bottom anchor alone still clears the scene");
  assert.ok(old.top < 0);
  assert.throws(() => assertContained(old), /footer top-border containment/);
});
