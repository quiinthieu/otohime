import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createAir, type Source } from "./on-air.ts";

const ROOT = join(import.meta.dirname, "..");

test("claiming the air stops the source that held it, never the claimer", () => {
  const air = createAir();
  const stopped: string[] = [];
  air.subscribe("tv", (by) => stopped.push(`tv by ${by}`));
  air.subscribe("radio", (by) => stopped.push(`radio by ${by}`));
  air.claim("radio");
  assert.equal(air.owner(), "radio");
  assert.deepEqual(stopped, [], "the TV was not playing, so nothing is paused");
  air.claim("tv");
  assert.equal(air.owner(), "tv");
  assert.deepEqual(stopped, ["radio by tv"]);
  air.claim("radio");
  assert.deepEqual(stopped, ["radio by tv", "tv by radio"]);
});

test("claiming again while on air stops nobody; release only lets go of one's own air", () => {
  const air = createAir();
  air.subscribe("tv", () => assert.fail("the TV never held the air"));
  air.subscribe("radio", () => assert.fail("the radio is never told to stop by itself"));
  air.claim("radio");
  air.claim("radio");
  air.release("tv");
  assert.equal(air.owner(), "radio", "the TV cannot release the radio's air");
  air.release("radio");
  assert.equal(air.owner(), null);
});

test("a source that stopped of its own accord is not stopped again", () => {
  const air = createAir();
  let tvStops = 0;
  air.subscribe("tv", () => tvStops++);
  air.claim("tv");
  air.release("tv");
  air.claim("radio");
  assert.equal(tvStops, 0);
});

test("an unsubscribed source hears nothing, and leaving the page frees its air", () => {
  const air = createAir();
  const heard: Source[] = [];
  const off = air.subscribe("tv", (by) => heard.push(by));
  air.subscribe("radio", () => {});
  air.claim("tv");
  off();
  assert.equal(air.owner(), null, "the TV unmounted while it held the air");
  air.claim("radio");
  assert.deepEqual(heard, []);
});

test("negative control: without a claim nobody is stopped", () => {
  const air = createAir();
  let stops = 0;
  air.subscribe("tv", () => stops++);
  air.subscribe("radio", () => stops++);
  air.release("tv");
  air.release("radio");
  assert.equal(stops, 0);
  assert.equal(air.owner(), null);
});

test("both players on /music go through the one shared air", () => {
  for (const [file, source] of [
    ["components/television.tsx", "tv"],
    ["components/ink-radio.tsx", "radio"],
  ]) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.match(src, /import \{ air \} from "@\/lib\/on-air"/, `${file} imports the shared air`);
    assert.match(src, new RegExp(`air\\.claim\\("${source}"\\)`), `${file} claims as ${source}`);
    assert.match(src, new RegExp(`air\\.subscribe\\("${source}"`), `${file} listens as ${source}`);
  }
});

test("the radio never autoplays: its audio element has no autoplay and preloads nothing", () => {
  const src = readFileSync(join(ROOT, "components/ink-radio.tsx"), "utf8");
  assert.doesNotMatch(src, /autoPlay|autoplay/);
  assert.match(src, /<audio[^>]*preload="none"/);
  // The stream's src is set in one place: the effect that runs on a loading attempt the listener started.
  assert.equal(src.match(/\.src = /g)?.length, 1, "one place sets the audio's src");
});
