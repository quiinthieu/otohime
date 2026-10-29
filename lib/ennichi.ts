/** Browser-free festival model. Scene coordinates are independent of CSS pixels. */
export const ENNICHI_SCENE_WIDTH = 1200;
export const ENNICHI_SCENE_HEIGHT = 800;
export const ENNICHI_STORAGE_KEY = "ennichi:v1";
export const ENNICHI_HINT_COOLDOWN_MS = 4000;

export type EnnichiOffset = Readonly<{ dx: number; dy: number }>;
export type EnnichiPlate = Readonly<{
  id: "cyan" | "magenta" | "yellow" | "key";
  colour: string;
  resting: EnnichiOffset;
  hover: EnnichiOffset;
}>;

export const ENNICHI_PLATES = [
  { id: "cyan", colour: "#237f92", resting: { dx: -1.5, dy: 0.5 }, hover: { dx: -3, dy: 1 } },
  { id: "magenta", colour: "#ba435e", resting: { dx: 1.5, dy: -0.5 }, hover: { dx: 3, dy: -1 } },
  { id: "yellow", colour: "#d9ac3d", resting: { dx: 0.5, dy: 1 }, hover: { dx: 1, dy: 2 } },
  { id: "key", colour: "#292723", resting: { dx: 0, dy: 0 }, hover: { dx: 0, dy: 0 } },
] as const satisfies readonly EnnichiPlate[];

/** The UI supplies its motion preference; no media query or global state here. */
export function getEnnichiPlates(reducedMotion = false): readonly EnnichiPlate[] {
  return reducedMotion
    ? ENNICHI_PLATES.map((plate) => ({ ...plate, resting: { dx: 0, dy: 0 }, hover: { dx: 0, dy: 0 } }))
    : ENNICHI_PLATES;
}

export type EnnichiMotif = Readonly<{
  id: string;
  title: string;
  japaneseTitle: string;
  x: number;
  y: number;
  r: number;
  hitRadius: number;
  stallRegion: string;
  unfoundLabel: string;
  hintClue: string;
  foundStory: string;
}>;

// Disjoint hit discs, all inside the scene. At a 390×260 fit, 144 scene units
// render as 46.8 CSS px. Smaller fits must enlarge targets in the UI.
export const ENNICHI_MOTIFS = [
  {
    id: "kame-turtle", title: "Kame turtle", japaneseTitle: "亀",
    x: 180, y: 530, r: 20, hitRadius: 72, stallRegion: "goldfish scooping basin",
    unfoundLabel: "Inspect the goldfish scooping basin",
    hintClue: "A little visitor keeps watch beside the goldfish water.",
    foundStory: "Kame has traded the open sea for a quiet evening by the goldfish basin.",
  },
  {
    id: "tamatebako", title: "Tamatebako box", japaneseTitle: "玉手箱",
    x: 600, y: 650, r: 22, hitRadius: 72, stallRegion: "shrine steps",
    unfoundLabel: "Inspect the shrine steps",
    hintClue: "Something carefully tied rests beside the shrine steps.",
    foundStory: "The sea princess's keepsake stays closed, holding its tide of memories.",
  },
  {
    id: "coral-crown", title: "Coral crown", japaneseTitle: "珊瑚の冠",
    x: 1000, y: 300, r: 20, hitRadius: 72, stallRegion: "kitsune mask stall",
    unfoundLabel: "Inspect the kitsune mask stall",
    hintClue: "Among the festival faces is a little treasure from the sea.",
    foundStory: "A crown of coral lends a touch of the undersea palace to the mask stall.",
  },
  {
    id: "daruma-doll", title: "Daruma doll", japaneseTitle: "だるま",
    x: 370, y: 330, r: 22, hitRadius: 72, stallRegion: "shaved ice stall",
    unfoundLabel: "Inspect the shaved ice stall",
    hintClue: "A patient guest waits beneath the shaved ice awning.",
    foundStory: "The little daruma keeps a wish safe while the ice melts into sweet summer water.",
  },
  {
    id: "hanko-seal", title: "Hanko seal", japaneseTitle: "判子",
    x: 1010, y: 620, r: 16, hitRadius: 72, stallRegion: "candied apple stand",
    unfoundLabel: "Inspect the candied apple stand",
    hintClue: "Look for a small mark of care near the glossy festival sweets.",
    foundStory: "A vermilion seal signs the evening like a freshly printed Otohime page.",
  },
  {
    id: "pocket-console", title: "Pocket console", japaneseTitle: "携帯ゲーム機",
    x: 780, y: 430, r: 21, hitRadius: 72, stallRegion: "lantern row",
    unfoundLabel: "Inspect the lantern row",
    hintClue: "A familiar plaything has been left under the warm paper lights.",
    foundStory: "The pocket console takes a night off beneath the chochin lanterns.",
  },
  {
    id: "urashima-bell", title: "Urashima bell", japaneseTitle: "浦島の鈴",
    x: 600, y: 140, r: 18, hitRadius: 72, stallRegion: "torii gate",
    unfoundLabel: "Inspect the torii gate",
    hintClue: "A quiet greeting hangs near the festival entrance.",
    foundStory: "Urashima's bell carries a small echo of the sea through the torii gate.",
  },
] as const satisfies readonly EnnichiMotif[];

export type EnnichiMotifId = (typeof ENNICHI_MOTIFS)[number]["id"];
export type EnnichiViewport = Readonly<{ scale: number; tx: number; ty: number }>;
const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function fitScale(width: number, height: number): number {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError("Ennichi viewport dimensions must be finite and positive");
  }
  return Math.min(width / ENNICHI_SCENE_WIDTH, height / ENNICHI_SCENE_HEIGHT);
}

/**
 * scale is zoom relative to contain-fit, in [1, 3.5]; tx/ty are CSS pixels
 * from the viewport's top-left. Render scene point (x,y) at
 * (tx + x*fit*scale, ty + y*fit*scale), using transform-origin: 0 0.
 * An axis smaller than its viewport is centered, otherwise its edges clamp.
 */
export function clampEnnichiViewport(
  viewport: EnnichiViewport, viewportWidth: number, viewportHeight: number,
): EnnichiViewport {
  const fit = fitScale(viewportWidth, viewportHeight);
  const scale = clamp(finiteOr(viewport.scale, 1), 1, 3.5);
  const axis = (translation: number, size: number, extent: number) => size <= extent
    ? (extent - size) / 2
    : clamp(finiteOr(translation, 0), extent - size, 0);
  return {
    scale,
    tx: axis(viewport.tx, ENNICHI_SCENE_WIDTH * fit * scale, viewportWidth),
    ty: axis(viewport.ty, ENNICHI_SCENE_HEIGHT * fit * scale, viewportHeight),
  };
}

/** Pointer and keyboard deltas are CSS pixels, independent of zoom. */
export function panEnnichiViewport(
  viewport: EnnichiViewport, dx: number, dy: number, viewportWidth: number, viewportHeight: number,
): EnnichiViewport {
  const current = clampEnnichiViewport(viewport, viewportWidth, viewportHeight);
  return clampEnnichiViewport({
    ...current, tx: current.tx + finiteOr(dx, 0), ty: current.ty + finiteOr(dy, 0),
  }, viewportWidth, viewportHeight);
}

/** focalX/Y are CSS pixels relative to the viewport, not scene coordinates. */
export function zoomEnnichiViewport(
  viewport: EnnichiViewport, factor: number, focalX: number, focalY: number,
  viewportWidth: number, viewportHeight: number,
): EnnichiViewport {
  const current = clampEnnichiViewport(viewport, viewportWidth, viewportHeight);
  if (!Number.isFinite(factor) || factor <= 0) return current;
  const scale = clamp(current.scale * factor, 1, 3.5);
  const ratio = scale / current.scale;
  const x = clamp(finiteOr(focalX, viewportWidth / 2), 0, viewportWidth);
  const y = clamp(finiteOr(focalY, viewportHeight / 2), 0, viewportHeight);
  return clampEnnichiViewport({
    scale, tx: x - (x - current.tx) * ratio, ty: y - (y - current.ty) * ratio,
  }, viewportWidth, viewportHeight);
}

/** x/y and hit radii are in scene units; convert pointer coordinates first. */
export function hitTestEnnichiMotif(
  x: number, y: number, motifs: readonly EnnichiMotif[] = ENNICHI_MOTIFS,
): EnnichiMotif | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return motifs.find((motif) => Math.hypot(x - motif.x, y - motif.y) <= motif.hitRadius) ?? null;
}

export type EnnichiDirection = "north" | "northeast" | "east" | "southeast" | "south" | "southwest" | "west" | "northwest" | "nearby";
export type EnnichiHint =
  | { status: "complete" }
  | { status: "cooldown"; remainingMs: number }
  | { status: "ready"; motifId: EnnichiMotifId; direction: EnnichiDirection; stallRegion: string; clue: string };
export type EnnichiHintRequest = {
  foundIds: ReadonlySet<string>;
  focusX: number;
  focusY: number;
  nowMs: number;
  lastHintAtMs?: number | null;
  cooldownMs?: number;
};

function directionTo(dx: number, dy: number): EnnichiDirection {
  if (Math.hypot(dx, dy) <= 72) return "nearby";
  const directions = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"] as const;
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return directions[(octant + 8) % 8];
}

/**
 * Focus is in scene units. No timers: caller stores nowMs as lastHintAtMs only
 * after a ready result. The clue payload exposes a broad region, never x/y.
 */
export function requestEnnichiHint({
  foundIds, focusX, focusY, nowMs, lastHintAtMs = null, cooldownMs = ENNICHI_HINT_COOLDOWN_MS,
}: EnnichiHintRequest): EnnichiHint {
  const unfound = ENNICHI_MOTIFS.filter((motif) => !foundIds.has(motif.id));
  if (unfound.length === 0) return { status: "complete" };
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new RangeError("Ennichi hint time must be finite and nonnegative");
  const cooldown = Math.max(0, finiteOr(cooldownMs, ENNICHI_HINT_COOLDOWN_MS));
  if (lastHintAtMs !== null && Number.isFinite(lastHintAtMs) && lastHintAtMs >= 0) {
    const elapsed = Math.max(0, nowMs - lastHintAtMs);
    if (elapsed < cooldown) return { status: "cooldown", remainingMs: cooldown - elapsed };
  }
  const x = finiteOr(focusX, ENNICHI_SCENE_WIDTH / 2);
  const y = finiteOr(focusY, ENNICHI_SCENE_HEIGHT / 2);
  let nearest = unfound[0];
  for (const motif of unfound.slice(1)) {
    if (Math.hypot(motif.x - x, motif.y - y) < Math.hypot(nearest.x - x, nearest.y - y)) nearest = motif;
  }
  const direction = directionTo(nearest.x - x, nearest.y - y);
  const lead = direction === "nearby" ? "Look nearby" : `Look ${direction}`;
  return {
    status: "ready", motifId: nearest.id, direction, stallRegion: nearest.stallRegion,
    clue: `${lead}, around the ${nearest.stallRegion}. ${nearest.hintClue}`,
  };
}

/** A damaged schema is empty; valid unknown IDs are ignored for forward safety. */
export function parseEnnichiProgress(raw: string | null | undefined): Set<EnnichiMotifId> {
  if (!raw) return new Set();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1 ||
        !("found" in data) || !Array.isArray(data.found) || !data.found.every((id) => typeof id === "string")) {
      return new Set();
    }
    const found = new Set<string>(data.found);
    return new Set(ENNICHI_MOTIFS.filter((motif) => found.has(motif.id)).map((motif) => motif.id));
  } catch {
    return new Set();
  }
}

/** Stable catalog order, deduplicated and stripped of unrelated IDs. */
export function serializeEnnichiProgress(foundIds: ReadonlySet<string>): string {
  return JSON.stringify({ version: 1, found: ENNICHI_MOTIFS.filter((motif) => foundIds.has(motif.id)).map((motif) => motif.id) });
}

export function isEnnichiStampUnlocked(foundIds: ReadonlySet<string>): boolean {
  return ENNICHI_MOTIFS.every((motif) => foundIds.has(motif.id));
}
