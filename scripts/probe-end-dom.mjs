// Page-side expressions for scripts/probe-end.mjs's footer heading and SVG checks, shared with their Chrome regression in
// scripts/probe-end-dom.test.mjs. Each function is serialized into the page with inPage(), so it must not close
// over anything in this module.

// Shared by hydrated and no-JS probes. This serialized function must have no module closure.
export function endSvgStructure(footer) {
  if (!footer) return { ok: false, reason: "missing footer" };
  const svgs = [...(footer?.querySelectorAll("svg") ?? [])];
  const baskets = svgs.filter((s) => s.hasAttribute("data-paper-basket"));
  const scene = svgs.filter((s) => !s.hasAttribute("data-paper-basket") && !s.closest("[data-end-waterline]"));
  const waterline = footer?.lastElementChild?.matches("[data-end-waterline]") ? footer.lastElementChild : null;
  const waves = [...(waterline?.querySelectorAll("svg") ?? [])];
  const waterlineLast = Boolean(waterline) && footer.querySelectorAll("[data-end-waterline]").length === 1;
  const basket = baskets[0];
  const basketNamed = baskets.length === 1 && basket.getAttribute("role") === "img" &&
    basket.getAttribute("aria-label") === "Wastepaper basket" &&
    !basket.closest('[aria-hidden="true"], [hidden], [inert]') && !basket.closest("[data-end-waterline]");
  const ground = footer?.querySelectorAll(".end-ground-wrap svg.end-svg.end-ink") ?? [];
  const console = footer?.querySelectorAll(".end-console-wrap svg.end-svg.end-ink") ?? [];
  const sky = scene.filter((s) => s.matches("svg.end-svg.end-sky"));
  const originalLayers = scene.length === 3 && ground.length === 1 && console.length === 1 && sky.length === 1 &&
    new Set([ground[0], console[0], sky[0]]).size === 3 && [ground[0], console[0], sky[0]].every((s) => scene.includes(s));
  const wave = waves[0];
  const waveOk = waves.length === 1 && wave.matches("svg.end-wave") && wave.getAttribute("viewBox") === "0 0 1000 16" &&
    wave.getAttribute("preserveAspectRatio") === "none" && wave.querySelector("path")?.getAttribute("d") ===
      "M0 8Q25 0 50 8T100 8T150 8T200 8T250 8T300 8T350 8T400 8T450 8T500 8T550 8T600 8T650 8T700 8T750 8T800 8T850 8T900 8T950 8T1000 8V16H0Z";
  const decorativeHidden = [...scene, ...waves].every((s) => s.getAttribute("aria-hidden") === "true");
  return {
    ok: Boolean(basketNamed && originalLayers && waveOk && decorativeHidden && waterlineLast && svgs.length === 5),
    basketCount: baskets.length, basketNamed, sceneSvgCount: scene.length, originalLayers,
    waveCount: waves.length, waveOk, decorativeHidden, waterlineLast,
  };
}

// The footer heading's accessible plain text. RisoText (components/riso-heading.tsx) renders one uninterrupted
// .riso-source span and then aria-hidden character plates, so the whole heading's textContent repeats the title.
// Read the source inside h2#end-title only; a plain heading without RisoText keeps its own text. Null when the
// heading is missing, and a never-matching marker when more than one source claims the name.
export function endTitleText(footer) {
  const heading = footer?.querySelector("h2#end-title");
  if (!heading) return null;
  const sources = heading.querySelectorAll(".riso-source");
  if (sources.length > 1) return `[${sources.length} riso-source spans]`;
  return (sources[0] ?? heading).textContent.trim();
}

// Waits for the heading's finite Riso entry (the plates slide in once, for about 420 ms plus each character's
// delay) so the bounds check measures settled ink, not a plate mid-flight. Infinite animations are not waited
// for. Bounded by timeoutMs; returns what was still running so a failure can say so.
export async function settleEndTitle(footer, timeoutMs) {
  const heading = footer?.querySelector("h2#end-title");
  if (!heading) return { pending: -1, waitedMs: 0 };
  const start = performance.now();
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  // A heading still "ready" has not been seen by its IntersectionObserver, so its entry has not begun.
  while (heading.querySelector('.riso-text[data-riso-state="ready"]') && performance.now() - start < timeoutMs) await frame();
  const finite = () =>
    heading
      .getAnimations({ subtree: true })
      .filter((a) => a.playState !== "finished" && a.effect?.getComputedTiming().endTime !== Infinity);
  await Promise.race([
    Promise.all(finite().map((a) => a.finished.catch(() => {}))),
    new Promise((resolve) => setTimeout(resolve, Math.max(0, timeoutMs - (performance.now() - start)))),
  ]);
  await frame();
  return { pending: finite().length, waitedMs: Math.round(performance.now() - start) };
}

// Observe the same six entrance starts the probe asserts, rather than sampling at a fixed wall-clock delay.
// Preserve the last state on timeout so missing/replayed animations still fail with useful diagnostics.
export async function settleEndEntrance(footer, timeoutMs) {
  const started = performance.now();
  let state;
  do {
    state = {
      seen: footer?.dataset.seen ?? null,
      active: footer?.querySelector("[data-end-stage]")?.dataset.active ?? null,
      playStates: [".end-cloud", ".end-star", ".end-lamp", ".end-packet"].map((sel) => {
        const node = footer?.querySelector(sel);
        return node ? getComputedStyle(node).animationPlayState : null;
      }),
      starts: window.__endEntranceStarts,
    };
    if (state.seen === "true" && state.active === "true" && state.starts === 6 &&
      state.playStates.every((s) => s === "running")) return state;
    if (performance.now() - started >= timeoutMs) return state;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  } while (true);
}

// The heading's real text geometry: its visible glyphs (RisoText's anchors, or a plain heading's own text) must sit
// inside the heading and the viewport. The anchors are measured rather than the opacity-0 source, whose pre-wrap
// line ends hang their spaces past the edge. A Riso heading's scrollWidth also counts its aria-hidden ::before/
// ::after plates, offset off the glyphs by design even once settled (about 5 px on /music at 1366 wide), so for
// it the overflow is reported as plateOverflow rather than failed; a plain heading must still not scroll. Metrics
// go into the failure detail, so a genuine overflow reads differently from decorative ink.
export function endTitleBounds(footer, vw) {
  const heading = footer?.querySelector("h2#end-title");
  if (!heading) return { ok: false, reason: "missing h2#end-title" };
  const anchors = [...heading.querySelectorAll(".riso-visual .riso-anchor")];
  const range = document.createRange();
  range.selectNodeContents(heading);
  const lines = (anchors.length ? anchors.map((a) => a.getBoundingClientRect()) : [...range.getClientRects()]).filter(
    (r) => r.width > 0 && r.height > 0,
  );
  const box = heading.getBoundingClientRect();
  const round = (n) => Math.round(n * 10) / 10;
  const text = lines.length
    ? {
        left: round(Math.min(...lines.map((r) => r.left))),
        right: round(Math.max(...lines.map((r) => r.right))),
        lines: new Set(lines.map((r) => Math.round(r.top))).size,
        glyphs: anchors.length,
      }
    : null;
  const textInside = Boolean(text) && text.left >= box.left - 2 && text.right <= box.right + 2 && text.left >= 0 && text.right <= vw;
  const noScroll = heading.scrollWidth <= heading.clientWidth + 2;
  return {
    ok: textInside && (anchors.length > 0 || noScroll),
    textInside,
    noScroll,
    plateOverflow: anchors.length ? Math.max(0, heading.scrollWidth - heading.clientWidth) : 0,
    scrollWidth: heading.scrollWidth,
    clientWidth: heading.clientWidth,
    heading: { left: round(box.left), right: round(box.right) },
    text,
    risoState: heading.querySelector(".riso-text")?.dataset.risoState ?? "plain",
  };
}

// "(fn)(args...)" for page.evaluate: arguments are JSON, plus the expression in footerExpr for the footer.
export function inPage(fn, footerExpr, ...args) {
  return `(${fn})(${[footerExpr, ...args.map((a) => JSON.stringify(a))].join(", ")})`;
}

// The visible footer.end, as probe-end.mjs's route checks pick it.
export const VISIBLE_FOOTER = `[...document.querySelectorAll("footer.end")].find((el) => typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null)`;
