// Types for ./sea-glass.mjs (vendored; see the header there). This is a .d.mts
// because TypeScript ignores a sibling .d.ts when allowJs is on.
export type PaletteName = "lagoon" | "lilac" | "rose" | "amber" | "mint";
export type Shape = "rounded" | "capsule" | "disc";

export type Palette = { name: string; body: string; edge: string; ink: string };

export type Settings = {
  frost: number;
  grain: number;
  tumble: number;
  thickness: number;
  bulge: number;
  elevation: number;
  light: number;
  transmission: number;
  seed: number;
};

export type Point = { x: number; y: number };
export type Segment = { start: Point; control1: Point; control2: Point; end: Point };

export const PALETTES: Readonly<Record<PaletteName, Palette>>;
export const DEFAULT_SETTINGS: Readonly<Settings>;

export function seededRandom(seed: number): () => number;
export function buildContour(
  width: number,
  height: number,
  shape?: Shape,
  tumble?: number,
  seed?: number,
  count?: number,
): Point[];
export function contourSegments(points: Point[]): Segment[];

export type MountOptions = {
  shape?: Shape;
  palette?: PaletteName | Palette;
  seed?: number;
  settings?: Partial<Settings>;
};
export type Renderer = {
  update(settings?: Partial<Settings>, palette?: PaletteName | Palette): void;
  destroy(): void;
};
export function mountGlass(element: HTMLElement, options?: MountOptions): Renderer;
