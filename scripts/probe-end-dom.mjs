// Page-side expressions for scripts/probe-end.mjs's footer heading checks, shared with their Chrome regression in
// scripts/probe-end-dom.test.mjs. Each function is serialized into the page with inPage(), so it must not close
// over anything in this module.

// The named basket is semantic content; the three scene layers and waterline wave are decoration.
export function endSvgStructure(footer) {
  if (!footer) return { ok: false, reason: "missing footer" };
  const svgs = [...footer.querySelectorAll("svg")];
  const layers = svgs.filter((svg) => !svg.closest("[data-end-waterline]") && !svg.matches("[data-paper-basket]"));
  const baskets = svgs.filter((svg) => !svg.closest("[data-end-waterline]") && svg.matches("[data-paper-basket]"));
  const waterline = footer.lastElementChild?.matches("[data-end-waterline]") ? footer.lastElementChild : null;
  const waves = waterline ? [...waterline.querySelectorAll("svg")] : [];
  const basketNamed = baskets.length === 1 && baskets[0].getAttribute("role") === "img" &&
    baskets[0].getAttribute("aria-label") === "Wastepaper basket" && !baskets[0].closest('[aria-hidden="true"], [hidden], [inert]');
  const decorativeHidden = [...layers, ...waves].every((svg) => svg.getAttribute("aria-hidden") === "true");
  const waterlineLast = Boolean(waterline) && footer.querySelectorAll("[data-end-waterline]").length === 1;
  return {
    ok: layers.length === 3 && baskets.length === 1 && waves.length === 1 && basketNamed && decorativeHidden && waterlineLast,
    sceneSvgCount: layers.length, basketCount: baskets.length, waveCount: waves.length,
    basketNamed, decorativeHidden, waterlineLast,
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
