import type { Season } from "./seasons.ts";

export type PrintRunId = "house" | "sumi" | "riso" | "indigo";
export type ColorScheme = "light" | "dark";
export type HexColor = `#${string}`;
export type PlateColors = readonly [HexColor, HexColor, HexColor];

export interface AppearanceColors {
  readonly paper: HexColor;
  readonly paper2: HexColor;
  readonly field: HexColor;
  readonly ink: HexColor;
  readonly muted: HexColor;
  readonly line: HexColor;
  readonly hairline: HexColor;
  readonly focus: HexColor;
}

export interface PrintRun {
  readonly id: PrintRunId;
  readonly label: string;
  readonly colorScheme: "inherit" | "dark";
  // Null means inherit the root project's existing theme/season colors.
  readonly colors: Readonly<Record<ColorScheme, AppearanceColors>> | null;
  readonly plates: Readonly<Record<ColorScheme, PlateColors>>;
  readonly plateCount: 2 | 3;
  readonly turbulenceMultiplier: number;
  readonly displacementMultiplier: number;
  readonly grain: number;
  readonly halftone: boolean;
}

export interface AppearanceContext {
  readonly theme: ColorScheme;
  readonly season: Season | null;
  readonly house: AppearanceColors;
}

export interface ResolvedPrintRun {
  readonly preset: PrintRun;
  readonly context: AppearanceContext;
  readonly colorScheme: ColorScheme;
  readonly colors: AppearanceColors;
  readonly overrides: AppearanceColors | null;
  readonly plates: PlateColors;
}

export const PRINT_RUN_IDS = Object.freeze(["house", "sumi", "riso", "indigo"] as const);
export const isPrintRunId = (value: unknown): value is PrintRunId =>
  typeof value === "string" && (PRINT_RUN_IDS as readonly string[]).includes(value);

function colors(paper: HexColor, paper2: HexColor, field: HexColor, ink: HexColor, muted: HexColor, hairline: HexColor): AppearanceColors {
  // Meaningful borders and focus use readable ink; hairline is decorative only.
  return Object.freeze({ paper, paper2, field, ink, muted, line: muted, hairline, focus: ink });
}

// Main-site fallback only. House resolution takes the root's actual colors,
// including any existing seasonal tint, rather than imposing these everywhere.
export const HOUSE_COLORS = Object.freeze({
  light: colors("#f2efe7", "#ebe7dc", "#faf8f3", "#231e16", "#6b6456", "#ddd6c8"),
  dark: colors("#1c1915", "#27231d", "#221f1a", "#ebe6da", "#a39b8b", "#3a342c"),
});

const plates = (a: HexColor, b: HexColor, c: HexColor): PlateColors => Object.freeze([a, b, c]);
const schemes = <T>(light: T, dark: T): Readonly<Record<ColorScheme, T>> => Object.freeze({ light, dark });

export const PRINT_RUNS: Readonly<Record<PrintRunId, PrintRun>> = Object.freeze({
  house: Object.freeze({
    id: "house", label: "House", colorScheme: "inherit", colors: null,
    plates: schemes(plates("#231e16", "#f3a6bb", "#93d3b0"), plates("#ebe6da", "#f3a6bb", "#93d3b0")),
    plateCount: 3, turbulenceMultiplier: 1, displacementMultiplier: 1, grain: 0.06, halftone: false,
  }),
  sumi: Object.freeze({
    id: "sumi", label: "Sumi black", colorScheme: "inherit", colors: HOUSE_COLORS,
    plates: schemes(plates("#231e16", "#65605a", "#65605a"), plates("#ebe6da", "#aaa296", "#aaa296")),
    plateCount: 2, turbulenceMultiplier: 0.85, displacementMultiplier: 0.8, grain: 0.03, halftone: false,
  }),
  riso: Object.freeze({
    id: "riso", label: "Riso pink + mint", colorScheme: "inherit",
    colors: schemes(
      colors("#fff4e8", "#f2e5d8", "#fff4e8", "#292522", "#696154", "#ddd1c4"),
      colors("#201e1c", "#2a2724", "#201e1c", "#f3ebdf", "#b1a598", "#403a35"),
    ),
    plates: schemes(plates("#292522", "#ff48b0", "#00a95c"), plates("#f3ebdf", "#ff48b0", "#00a95c")),
    plateCount: 3, turbulenceMultiplier: 1.1, displacementMultiplier: 1.15, grain: 0.04, halftone: false,
  }),
  indigo: Object.freeze({
    id: "indigo", label: "Indigo night", colorScheme: "dark",
    colors: schemes(
      colors("#10152d", "#19203b", "#10152d", "#f2edff", "#b4b8d3", "#363d59"),
      colors("#10152d", "#19203b", "#10152d", "#f2edff", "#b4b8d3", "#363d59"),
    ),
    plates: schemes(plates("#f2edff", "#9baaff", "#f39dcc"), plates("#f2edff", "#9baaff", "#f39dcc")),
    plateCount: 3, turbulenceMultiplier: 0.9, displacementMultiplier: 0.9, grain: 0.03, halftone: false,
  }),
});

export function resolvePrintRun(id: unknown, context: AppearanceContext): ResolvedPrintRun {
  const preset = PRINT_RUNS[isPrintRunId(id) ? id : "house"];
  const colorScheme = preset.colorScheme === "dark" ? "dark" : context.theme;
  const overrides = preset.colors?.[colorScheme] ?? null;
  const house = Object.freeze({ ...context.house });
  const colors = overrides ?? house;
  const ghosts = preset.plates[colorScheme];
  return Object.freeze({
    preset, context: Object.freeze({ ...context, house }), colorScheme,
    colors, overrides, plates: plates(colors.ink, ghosts[1], ghosts[2]),
  });
}
