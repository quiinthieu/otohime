import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  BOOT,
  BOOT_ATTR,
  BOOT_END,
  BOOT_KEY,
  BOOT_START,
  bootScript,
  bootStyle,
  booted,
  chimeAllowed,
  finishBoot,
  MAX_BOOT_MS,
  MAX_STEP_MS,
  splashStyle,
  step,
  stepEnd,
  type BootPart,
} from "./boot.ts";

const PARTS: BootPart[] = ["cart", "lamp", "lcd", "scan", "print", "menu"];
const read = (file: string) => readFileSync(resolve(import.meta.dirname, "..", file), "utf8");

// A stand-in <html>: just the attributes.
function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    hasAttribute: (name: string) => attrs.has(name),
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
  };
}

function fakeSession() {
  const items = new Map<string, string>();
  return { items, getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

const denied = () => {
  throw new Error("SecurityError: storage denied");
};

test("the boot is finite: every part once, in order, after the figure's print, done within 2.4 s", () => {
  assert.deepEqual(
    BOOT.map((s) => s.part),
    PARTS,
  );
  assert.ok(BOOT[0].at >= BOOT_START, "starts after the figure has printed");
  for (let i = 1; i < BOOT.length; i++) {
    assert.ok(BOOT[i].at >= stepEnd(BOOT[i - 1]), `${BOOT[i].part} waits for ${BOOT[i - 1].part}`);
  }
  assert.equal(BOOT_END, stepEnd(BOOT[BOOT.length - 1]));
  assert.ok(BOOT_END <= MAX_BOOT_MS, `${BOOT_END} ms`);
  assert.equal(MAX_BOOT_MS, 2400);
});

test("no step moves for more than 400 ms, and every step moves", () => {
  assert.equal(MAX_STEP_MS, 400);
  for (const s of BOOT) {
    assert.ok(s.ms > 0 && s.ms <= MAX_STEP_MS, `${s.part}: ${s.ms} ms`);
    assert.ok(Number.isInteger(s.at) && Number.isInteger(s.ms));
  }
});

test("each part's inline timing is its step", () => {
  for (const part of PARTS) {
    assert.deepEqual(bootStyle(part), { animationDelay: `${step(part).at}ms`, animationDuration: `${step(part).ms}ms` });
  }
});

test("the name shows from its first letter until the menu", () => {
  const { animationDelay, animationDuration } = splashStyle();
  assert.equal(parseInt(animationDelay), step("print").at);
  assert.equal(parseInt(animationDelay) + parseInt(animationDuration), step("menu").at);
  assert.ok(step("menu").at >= stepEnd(step("print")), "the whole name prints before it goes");
});

test("the pre-paint script marks a returning session, and only that", () => {
  const run = (storage: unknown) => {
    const root = fakeRoot();
    new Function("sessionStorage", "document", bootScript)(storage, { documentElement: root });
    return root;
  };
  const session = fakeSession();
  assert.equal(booted(run(session)), false, "a fresh session boots");
  session.items.set(BOOT_KEY, "1");
  const back = run(session);
  assert.equal(booted(back), true, "a returning visit skips");
  assert.equal(back.attrs.get(BOOT_ATTR), "");
  const blocked = {
    getItem: denied,
  };
  assert.equal(booted(run(blocked)), false, "denied storage: no throw, and the boot plays");
  // the getter itself throws in some sandboxes
  assert.doesNotThrow(() => new Function("document", bootScript)({ documentElement: fakeRoot() }));
});

test("finishing marks the document, and the session when storage works", () => {
  const root = fakeRoot();
  const session = fakeSession();
  finishBoot(root, () => session);
  assert.equal(booted(root), true);
  assert.equal(session.items.get(BOOT_KEY), "1");

  const alone = fakeRoot();
  assert.doesNotThrow(() => finishBoot(alone, denied));
  assert.equal(booted(alone), true, "denied storage still skips a client-side return to Home");
  const full = fakeRoot();
  finishBoot(full, () => ({ setItem: denied }));
  assert.equal(booted(full), true, "a full quota too");
});

test("the chime needs a running boot, motion and an earlier gesture", () => {
  assert.equal(chimeAllowed({ booted: false, reduced: false, activated: true }), true);
  assert.equal(chimeAllowed({ booted: false, reduced: false, activated: false }), false, "cold load: silent");
  assert.equal(chimeAllowed({ booted: true, reduced: false, activated: true }), false, "no boot, no chime");
  assert.equal(chimeAllowed({ booted: false, reduced: true, activated: true }), false, "reduced motion: no boot");
});

test("globals.css animates every part, rests booted, and drops the boot on a returning visit", () => {
  const css = read("app/(site)/globals.css");
  for (const name of ["boot-cart", "boot-lamp", "boot-lcd", "boot-scan", "boot-print", "splash"]) {
    assert.match(css, new RegExp(`\\.${name} \\{[^}]*animation:`), `.${name} has an animation`);
  }
  for (const frames of ["boot-cart", "boot-flicker", "boot-scan", "boot-print", "boot-show"]) {
    assert.match(css, new RegExp(`@keyframes ${frames} \\{`), `@keyframes ${frames}`);
  }
  const reset = css.match(/:root\[data-booted\][^{]*\{[^}]*\}/)?.[0] ?? "";
  for (const sel of [".boot", ".boot-cart", ".boot-lamp", ".boot-lcd", ".boot-scan", ".splash", ".boot-print"]) {
    assert.ok(reset.includes(sel), `${sel} is reset under data-booted`);
  }
  assert.match(reset, /animation: none/);
  assert.match(reset, /\.figure:has\(\.boot-cart\)/, "the console's print is skipped too");
});

test("the root layout runs the pre-paint script, and the console times every part from the data", () => {
  const layout = read("app/(site)/layout.tsx");
  assert.match(layout, /bootScript/);
  const handheld = read("components/handheld.tsx");
  for (const part of PARTS) assert.ok(handheld.includes(`bootStyle("${part}")`), `${part} is timed from lib/boot.ts`);
  assert.ok(handheld.includes("splashStyle()"));
  assert.doesNotMatch(handheld, /animationDelay: "/, "no hand-typed delays");
});
