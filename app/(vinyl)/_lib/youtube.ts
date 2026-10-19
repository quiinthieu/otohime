// Loads YouTube's IFrame Player API once per page, however many times it is
// asked: React's strict-mode double mount, a hot reload that re-evaluates this
// module and several consumers all get the same promise, because it is kept
// on the window rather than in a module variable. window and document are
// passed in, so node:test can drive it with fakes.

import type { YTNamespace } from "./player.ts";

export const IFRAME_API = "https://www.youtube.com/iframe_api";
export const PROMISE_KEY = "__vinylYouTubeApi";

export type WinLike = {
  YT?: { Player?: unknown };
  onYouTubeIframeAPIReady?: () => void;
  [PROMISE_KEY]?: Promise<YTNamespace>;
};

// The three things the loader needs from document; tests pass a fake.
export type DocLike = Pick<Document, "querySelector" | "createElement" | "head">;

export function loadYouTubeApi(win: WinLike, doc: DocLike): Promise<YTNamespace> {
  // Already here (another consumer, or a page that loaded it first).
  if (win.YT?.Player) return Promise.resolve(win.YT as YTNamespace);
  const pending = win[PROMISE_KEY];
  if (pending) return pending;

  const promise = new Promise<YTNamespace>((resolve, reject) => {
    // YouTube calls this one global when the API is ready; keep whoever set it first.
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      try {
        previous?.();
      } finally {
        if (win.YT?.Player) resolve(win.YT as YTNamespace);
        else fail();
      }
    };

    let script: HTMLScriptElement | null = null;
    function fail() {
      win.onYouTubeIframeAPIReady = previous;
      script?.remove();
      if (win[PROMISE_KEY] === promise) delete win[PROMISE_KEY]; // so the next call tries again
      reject(new Error("YouTube's player API didn't load"));
    }

    const existing = doc.querySelector(`script[src="${IFRAME_API}"]`);
    if (existing) {
      existing.addEventListener("error", fail);
    } else {
      script = doc.createElement("script");
      script.src = IFRAME_API;
      script.async = true;
      script.addEventListener("error", fail);
      doc.head.append(script);
    }
  });
  win[PROMISE_KEY] = promise;
  return promise;
}
