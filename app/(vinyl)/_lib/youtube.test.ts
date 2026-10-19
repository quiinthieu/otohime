// The iframe_api loader with a fake window and document: one script however
// many callers (strict mode, HMR, several consumers), an earlier handler still
// runs, and a failed load can be retried.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { YTNamespace } from "./player.ts";
import { IFRAME_API, loadYouTubeApi, PROMISE_KEY, type DocLike, type WinLike } from "./youtube.ts";

class FakeScript {
  src = "";
  async = false;
  removed = false;
  listeners: Record<string, (() => void)[]> = {};
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  remove() {
    this.removed = true;
  }
  fire(type: string) {
    for (const fn of this.listeners[type] ?? []) fn();
  }
}

function fakes(existing?: FakeScript) {
  const win: WinLike = {};
  const appended: FakeScript[] = [];
  const doc = {
    querySelector: (selector: string) => (existing && selector === `script[src="${IFRAME_API}"]` ? existing : null),
    createElement: (tag: "script") => {
      assert.equal(tag, "script");
      return new FakeScript();
    },
    head: { append: (s: FakeScript) => void appended.push(s) },
  } as unknown as DocLike;
  // What YouTube's script does once it has loaded.
  const arrive = () => {
    win.YT = { Player: class {} };
    win.onYouTubeIframeAPIReady?.();
  };
  return { win, doc, appended, arrive };
}

test("two calls share one promise and one script, which is async and YouTube's", async () => {
  const { win, doc, appended, arrive } = fakes();
  const a = loadYouTubeApi(win, doc);
  const b = loadYouTubeApi(win, doc); // strict mode mounts twice
  assert.equal(a, b);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, "https://www.youtube.com/iframe_api");
  assert.equal(appended[0].async, true);
  arrive();
  const [ya, yb] = await Promise.all([a, b]);
  assert.equal(ya, win.YT);
  assert.equal(yb, win.YT);
});

test("a re-evaluated module (HMR) finds the promise on the window", async () => {
  const { win, doc, appended, arrive } = fakes();
  const first = loadYouTubeApi(win, doc);
  // a fresh copy of the module has no module-level state; the window still has the promise
  const fresh = await import(`./youtube.ts?hmr=${Date.now()}`);
  assert.notEqual(fresh.loadYouTubeApi, loadYouTubeApi);
  assert.equal(fresh.loadYouTubeApi(win, doc), first);
  assert.equal(appended.length, 1);
  arrive();
  await first;
});

test("an existing YT.Player resolves at once with no script", async () => {
  const { win, doc, appended } = fakes();
  const YT = { Player: class {} };
  win.YT = YT;
  assert.equal(await loadYouTubeApi(win, doc), YT as unknown as YTNamespace);
  assert.equal(appended.length, 0);
  assert.equal(win[PROMISE_KEY], undefined);
});

test("a YT object without Player yet still waits for the ready call", async () => {
  const { win, doc, appended, arrive } = fakes();
  win.YT = {}; // iframe_api defines YT before the player itself
  const p = loadYouTubeApi(win, doc);
  assert.equal(appended.length, 1);
  arrive();
  assert.equal(await p, win.YT);
});

test("a previous onYouTubeIframeAPIReady still runs", async () => {
  const { win, doc, arrive } = fakes();
  let ran = 0;
  win.onYouTubeIframeAPIReady = () => void ran++;
  const p = loadYouTubeApi(win, doc);
  arrive();
  await p;
  assert.equal(ran, 1);
});

test("a script already in the document is reused, not duplicated", async () => {
  const existing = new FakeScript();
  const { win, doc, appended, arrive } = fakes(existing);
  const p = loadYouTubeApi(win, doc);
  assert.equal(appended.length, 0);
  arrive();
  await p;
});

test("a script error rejects, removes the script, and the next call appends a fresh one", async () => {
  const { win, doc, appended, arrive } = fakes();
  let ran = 0;
  const before = () => void ran++;
  win.onYouTubeIframeAPIReady = before;
  const p = loadYouTubeApi(win, doc);
  appended[0].fire("error");
  await assert.rejects(p, /didn't load/);
  assert.equal(appended[0].removed, true);
  assert.equal(win[PROMISE_KEY], undefined);
  assert.equal(win.onYouTubeIframeAPIReady, before, "the earlier handler is put back");

  const retry = loadYouTubeApi(win, doc);
  assert.notEqual(retry, p);
  assert.equal(appended.length, 2);
  arrive();
  assert.equal(await retry, win.YT);
  assert.equal(ran, 1);
});

test("the ready call without a Player rejects instead of resolving nothing", async () => {
  const { win, doc } = fakes();
  const p = loadYouTubeApi(win, doc);
  win.onYouTubeIframeAPIReady?.();
  await assert.rejects(p, /didn't load/);
  assert.equal(win[PROMISE_KEY], undefined);
});

// Compile-time only: the browser's own window and document fit the loader.
export const typecheck = (w: Window, d: Document) => loadYouTubeApi(w, d);
