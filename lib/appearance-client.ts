// The browser side of the print-run appearance (lib/print-runs.ts, lib/ink-lab.ts): what every root layout carries
// so a chosen print run, or an applied Ink Lab snapshot, reaches the first painted frame of every document.
//
//   appearanceStyle(root)    one root's token aliases, generated from the trusted presets (components/appearance-boot.tsx
//                            renders it into <head>). House adds nothing: every rule needs data-print-run or data-ink-lab.
//   appearanceBootScript     the pre-paint script: validates the two storage keys exactly as the store does and marks
//                            <html>. Built from the schema below, and lib/appearance-client.test.ts runs it against the
//                            store, so the two cannot drift.
//   createBrowserAppearanceStore / appearanceStore
//                            the AppearanceStore over real local/session storage, reconciled on storage and pageshow.
//   appearancePlan/applyPlan the <html> attributes and inline custom properties for a snapshot.
//   appearanceTags/createFilterRuntime
//                            the SVG adapters: primitives tagged with their source values (data-ap-*), rescaled after
//                            hydration and restored exactly on House. Never a CSS var() in an SVG numeric attribute.
//
// Nothing here touches window, document or storage when imported; only the functions given them do.
import { HANDS, MATERIALS, SEEDS, type Primitive } from "./ink-modes.ts";
import {
  createAppearanceStore, INK_LAB_KEY, LAB_RANGES, MAX_LAB_QUERY_LENGTH, PRINT_RUN_KEY,
  type AppearanceSnapshot, type AppearanceStorage, type AppearanceStore,
} from "./ink-lab.ts";
import { PRINT_RUN_IDS, PRINT_RUNS, type AppearanceColors, type ColorScheme, type PrintRun, type PrintRunId } from "./print-runs.ts";

export const PRINT_RUN_ATTR = "data-print-run";
export const INK_LAB_ATTR = "data-ink-lab";
export const HALFTONE_ATTR = "data-ap-halftone";
// Every inline custom property the plan may set on <html>; anything not in a plan is removed.
export const APPEARANCE_VARS = Object.freeze([
  "--ap-grain", "--ap-plate-1", "--ap-plate-2", "--ap-plate-3", "--ap-plate-count", "--ap-transition",
] as const);
type AppearanceVar = (typeof APPEARANCE_VARS)[number];

export const HOUSE_SNAPSHOT: AppearanceSnapshot = Object.freeze({ printRun: "house", lab: null });

// ---------------------------------------------------------------------------------------------------------------
// <html> markers

export interface AppearancePlan {
  // The effective run when it is not House; House sets no attribute, so no alias rule can match.
  readonly printRun: Exclude<PrintRunId, "house"> | null;
  readonly inkLab: boolean;
  readonly halftone: boolean;
  readonly vars: Readonly<Partial<Record<AppearanceVar, string>>>;
}

export function appearancePlan(snapshot: AppearanceSnapshot): AppearancePlan {
  const lab = snapshot.lab;
  const effective = lab ? lab.printRun : snapshot.printRun;
  const printRun = effective === "house" ? null : effective;
  if (lab) {
    const s = lab.settings;
    return Object.freeze({
      printRun, inkLab: true, halftone: s.halftone,
      vars: Object.freeze({
        "--ap-grain": String(s.grain),
        "--ap-plate-1": s.plates[0], "--ap-plate-2": s.plates[1], "--ap-plate-3": s.plates[2],
        "--ap-plate-count": String(s.plateCount),
        "--ap-transition": `${s.transitionMs}ms`,
      }),
    });
  }
  return Object.freeze({
    printRun, inkLab: false, halftone: false,
    vars: Object.freeze(printRun ? { "--ap-grain": String(PRINT_RUNS[printRun].grain) } : {}),
  });
}

export interface AppearanceRoot {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  readonly style: { setProperty(name: string, value: string): void; removeProperty(name: string): unknown };
}

// Idempotent: the runtime re-applies what the boot script already set, and House removes every trace.
export function applyPlan(root: AppearanceRoot, plan: AppearancePlan) {
  if (plan.printRun) root.setAttribute(PRINT_RUN_ATTR, plan.printRun);
  else root.removeAttribute(PRINT_RUN_ATTR);
  if (plan.inkLab) root.setAttribute(INK_LAB_ATTR, "");
  else root.removeAttribute(INK_LAB_ATTR);
  if (plan.halftone) root.setAttribute(HALFTONE_ATTR, "");
  else root.removeAttribute(HALFTONE_ATTR);
  for (const name of APPEARANCE_VARS) {
    const value = plan.vars[name];
    if (value === undefined) root.style.removeProperty(name);
    else root.style.setProperty(name, value);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The pre-paint script

// The canonical stored Lab query, exactly as encodeLab writes it: every key, in order, lowercase hex, shortest numbers.
// Numbers are then re-quantized below and must print back unchanged, which is readStoredLab's decode/encode check.
const STORED_NUMBER = "(\\d+(?:\\.\\d+)?)";
const HEX6 = "([0-9a-f]{6})";
export const STORED_LAB_PATTERN =
  `^v=1&r=(${PRINT_RUN_IDS.join("|")})&t=${STORED_NUMBER}&d=${STORED_NUMBER}&w=${STORED_NUMBER}&g=${STORED_NUMBER}` +
  `&p=${HEX6}%2C${HEX6}%2C${HEX6}&n=([23])&m=${STORED_NUMBER}&h=(${HANDS.join("|")})&o=([01])$`;

// [field, regex group, min, max, step] for the five numeric fields.
const NUMERIC_GROUPS = (["turbulence", "displacement", "wobble", "grain", "transitionMs"] as const).map((field, i) => {
  const { min, max, step } = LAB_RANGES[field];
  return [field, [2, 3, 4, 5, 10][i], min, max, step] as const;
});
const PRESET_GRAIN = Object.fromEntries(PRINT_RUN_IDS.map((id) => [id, PRINT_RUNS[id].grain]));

// Mirrors appearancePlan/applyPlan on a fresh document. Every value it writes is a validated id, a regex-checked hex
// or a re-quantized number: storage text never reaches CSS or the DOM as it was read.
export const appearanceBootScript =
  `(function(){var d=document.documentElement,s=d.style,run,raw,m,lab=null,i,f,x,b,q;` +
  `try{run=localStorage.getItem(${JSON.stringify(PRINT_RUN_KEY)})}catch(e){}` +
  `try{raw=sessionStorage.getItem(${JSON.stringify(INK_LAB_KEY)})}catch(e){}` +
  `if(${JSON.stringify(PRINT_RUN_IDS)}.indexOf(run)<0)run="house";` +
  `if(typeof raw==="string"&&raw.length<=${MAX_LAB_QUERY_LENGTH}&&(m=new RegExp(${JSON.stringify(STORED_LAB_PATTERN)}).exec(raw))){` +
  `lab={r:m[1],p:["#"+m[6],"#"+m[7],"#"+m[8]],n:m[9],o:m[12]==="1"};f=${JSON.stringify(NUMERIC_GROUPS)};` +
  `for(i=0;i<f.length&&lab;i++){x=+m[f[i][1]];b=Math.max(f[i][2],Math.min(f[i][3],x));` +
  `q=Number((Math.round((b+${JSON.stringify(Number.EPSILON)})/f[i][4])*f[i][4]).toFixed(3));` +
  `if(String(q)!==m[f[i][1]])lab=null;else lab[f[i][0]]=q}}` +
  `var e=lab?lab.r:run;if(e!=="house")d.setAttribute(${JSON.stringify(PRINT_RUN_ATTR)},e);` +
  `if(lab){d.setAttribute(${JSON.stringify(INK_LAB_ATTR)},"");if(lab.o)d.setAttribute(${JSON.stringify(HALFTONE_ATTR)},"");` +
  `s.setProperty("--ap-grain",String(lab.grain));s.setProperty("--ap-plate-1",lab.p[0]);s.setProperty("--ap-plate-2",lab.p[1]);` +
  `s.setProperty("--ap-plate-3",lab.p[2]);s.setProperty("--ap-plate-count",lab.n);s.setProperty("--ap-transition",lab.transitionMs+"ms")}` +
  `else if(e!=="house")s.setProperty("--ap-grain",String(${JSON.stringify(PRESET_GRAIN)}[e]))})()`;

// ---------------------------------------------------------------------------------------------------------------
// Root layouts and their token aliases

// Every root layout under app/, plus app/global-not-found.tsx, which wears the site's sheets.
export const APPEARANCE_ROOTS = Object.freeze([
  "site", "articles", "barometer", "capsule", "design-system", "elements", "orrery", "planisphere", "rotor", "ryugu",
  "shore", "structures", "vinyl", "zine",
] as const);
export type AppearanceRootId = (typeof APPEARANCE_ROOTS)[number];

export interface RootAppearance {
  // The root's own stylesheet; lib/appearance-client.test.ts holds every alias to a property it declares.
  readonly sheet: string;
  // How the root picks light or dark: data-theme then the OS ("both"), or one scheme always.
  readonly scheme: "both" | ColorScheme;
  // Which of the root's own properties each preset color replaces. Unlisted colors are left to the root.
  readonly aliases: Readonly<Partial<Record<keyof AppearanceColors, readonly string[]>>>;
  // Whether the static grain/halftone layer may show: it sits behind the page, so a root painted over by an opaque
  // body image (Ryugu's sea) has nowhere to show it.
  readonly texture: boolean;
  // Declarations that switch the root's own paper texture off while a print run's texture replaces it, so the two
  // never stack past the 0.06 alpha budget.
  readonly houseTexture?: { readonly html?: string; readonly body?: string };
  // The root's own dark-theme values for the tokens it does not alias. A night run (Indigo) is dark whatever the saved
  // theme, so it carries them too: a light-theme visitor then sees the root's whole dark look, not light accents and
  // controls under dark ink. lib/appearance-client.test.ts holds them equal to the root's :root[data-theme="dark"] block.
  readonly darkTokens?: Readonly<Record<string, string>>;
  // Scene surfaces the root paints with literal colors rather than tokens, given the run's tokens while one is active
  // (night: only under a night run). Only a colored run, never House or a Lab on House. Trusted literals.
  readonly surfaces?: readonly { readonly selector: string; readonly body: string; readonly night?: true }[];
}

export const ROOT_APPEARANCE: Readonly<Record<AppearanceRootId, RootAppearance>> = Object.freeze({
  site: {
    sheet: "app/(site)/globals.css", scheme: "both", texture: true,
    aliases: { paper: ["--paper"], paper2: ["--paper-2"], field: ["--field"], ink: ["--ink"], muted: ["--muted"], hairline: ["--line"] },
  },
  articles: {
    sheet: "app/(articles)/articles.css", scheme: "both", texture: true, houseTexture: { html: "--grain:none" },
    aliases: { paper: ["--paper"], ink: ["--ink"], muted: ["--muted"], hairline: ["--rule"] },
    darkTokens: { "--spot": "#e07a6a" },
  },
  barometer: {
    sheet: "app/(barometer)/barometer.css", scheme: "both", texture: true,
    aliases: { paper: ["--paper"], paper2: ["--panel"], field: ["--field"], ink: ["--ink"], muted: ["--ink-soft"] },
    darkTokens: {
      "--coral": "#ff8a6e", "--wood": "#5a3d27", "--wood-edge": "#8a5f3a", "--on-wood": "#f0e4cf", "--cream": "#e4d9bd",
      "--glass": "#e9e0c6",
    },
  },
  capsule: {
    sheet: "app/(capsule)/capsule.css", scheme: "light", texture: true, houseTexture: { body: "background-image:none" },
    aliases: { paper: ["--paper"], paper2: ["--paper-deep"], field: ["--white"], ink: ["--ink"], muted: ["--ink-soft"], hairline: ["--rule"] },
  },
  "design-system": {
    sheet: "app/(design-system)/design-system.css", scheme: "both", texture: true,
    aliases: { paper: ["--paper"], ink: ["--ink"], muted: ["--muted"], line: ["--rule"], hairline: ["--grid"] },
    darkTokens: { "--spot": "#7aa2ff", "--hot": "#ff8a73" },
  },
  elements: {
    sheet: "app/(elements)/elements.css", scheme: "both", texture: true,
    aliases: { paper: ["--paper"], field: ["--card"], ink: ["--ink"], muted: ["--muted"], hairline: ["--line"] },
    darkTokens: { "--fact": "#2b2618", "--neutron": "#6c7079", "--shadow": "rgb(0 0 0 / 0.5)", "--backdrop": "rgb(0 0 0 / 0.6)" },
    // The category tints have a dark set of their own (elements.css: .tint { --cat: var(--cat-dark) }).
    surfaces: [{ selector: ".tint", body: "--cat:var(--cat-dark)", night: true }],
  },
  orrery: {
    sheet: "app/(orrery)/orrery.css", scheme: "light", texture: true,
    aliases: { paper: ["--paper"], paper2: ["--paper-edge"], ink: ["--ink"], muted: ["--ink-soft"] },
  },
  planisphere: {
    sheet: "app/(planisphere)/planisphere.css", scheme: "both", texture: true,
    aliases: { paper: ["--paper"], paper2: ["--panel"], field: ["--field"], ink: ["--ink"], muted: ["--ink-soft"] },
    darkTokens: {
      "--coral": "#ff8a6e", "--amber": "#ffb648", "--sky": "#0c1330", "--sky-day": "#4a6a85", "--star-line": "#7f93cc",
    },
  },
  rotor: {
    sheet: "app/(rotor)/rotor.css", scheme: "both", texture: true,
    aliases: { paper: ["--paper"], paper2: ["--panel"], field: ["--field"], ink: ["--ink"], muted: ["--ink-soft"] },
    darkTokens: { "--glass": "#2f2823", "--amber": "#ffb648", "--amber-glow": "rgb(255 182 72 / 0.55)", "--coral": "#ff8a6e" },
  },
  ryugu: {
    sheet: "app/(ryugu)/ryugu.css", scheme: "dark", texture: false,
    aliases: { paper: ["--deep"], paper2: ["--sea"], ink: ["--ink"], muted: ["--muted"] },
  },
  shore: {
    sheet: "app/(shore)/shore.css", scheme: "light", texture: true,
    aliases: { paper: ["--paper"], paper2: ["--stage"], ink: ["--ink"], muted: ["--muted"], hairline: ["--line"] },
    // The light scene and its controls are painted in literal greens (shore.css); its own dark scene stays its own.
    surfaces: [
      { selector: ".shore:not(.dark-scene)", body: "background:radial-gradient(ellipse at 50% 22%,var(--paper) 0%,var(--stage) 80%)" },
      { selector: ".shore:not(.dark-scene) .scene-buttons", body: "background:var(--stage)" },
      { selector: ".shore:not(.dark-scene) .scene-button.selected", body: "background:var(--paper)" },
      { selector: ".shore:not(.dark-scene) .home-link:hover", body: "background:var(--stage)" },
      { selector: ".shore:not(.dark-scene) .plain-button:hover:not(:disabled)", body: "background:var(--stage)" },
      // Under a night run the light scene's white washes and red text take the values of Shore's own dark scene.
      { selector: ".shore:not(.dark-scene) .panel", body: "border-color:var(--line);background:#ffffff0a", night: true },
      { selector: ".shore:not(.dark-scene) .segmented button.chosen", body: "background:color-mix(in srgb,var(--ink) 16%,transparent)", night: true },
      { selector: ".shore:not(.dark-scene) .plain-button.danger", body: "color:#f0b4b4", night: true },
    ],
  },
  structures: {
    sheet: "app/(structures)/structures.css", scheme: "both", texture: true,
    aliases: { paper: ["--paper"], ink: ["--ink"], muted: ["--muted"], line: ["--rule"], hairline: ["--grid"] },
    darkTokens: { "--spot": "#7aa2ff", "--hot": "#ff8a73", "--hot-wash": "rgb(255 138 115 / 0.16)" },
  },
  vinyl: {
    sheet: "app/(vinyl)/vinyl.css", scheme: "dark", texture: true,
    aliases: { paper: ["--bg"], paper2: ["--card"], ink: ["--ink"], muted: ["--muted"], line: ["--line"] },
  },
  zine: {
    sheet: "app/(zine)/zine.css", scheme: "light", texture: true,
    aliases: { paper: ["--paper"], field: ["--sheet"], ink: ["--ink"], muted: ["--muted"], hairline: ["--line"] },
  },
});

type Rule = { readonly media?: string; readonly selector: string; readonly body: string };

// Light paper takes white specks and dark paper black ones, so the texture only moves paper away from the ink.
const tone = (scheme: ColorScheme) =>
  scheme === "light" ? "--ap-speck:var(--ap-speck-light);--ap-tone:#fff" : "--ap-speck:var(--ap-speck-dark);--ap-tone:#000";

function presetBody(root: RootAppearance, preset: PrintRun, scheme: ColorScheme): string {
  const colors = preset.colors![scheme];
  const ghosts = preset.plates[scheme];
  const out: string[] = [];
  for (const [key, names] of Object.entries(root.aliases) as [keyof AppearanceColors, readonly string[]][]) {
    for (const name of names) out.push(`${name}:${colors[key]}`);
  }
  // The anchor plate is the readable ink; the ghosts are decoration.
  out.push(`--ap-plate-1:${colors.ink}`, `--ap-plate-2:${ghosts[1]}`, `--ap-plate-3:${ghosts[2]}`, `--ap-plate-count:${preset.plateCount}`);
  out.push(tone(scheme));
  if (preset.colorScheme === "dark") {
    for (const [name, value] of Object.entries(root.darkTokens ?? {})) out.push(`${name}:${value}`);
    out.push("color-scheme:dark");
  }
  return out.join(";");
}

function bySchemes(mode: RootAppearance["scheme"], selector: string, body: (scheme: ColorScheme) => string): Rule[] {
  if (mode !== "both") return [{ selector, body: body(mode) }];
  return [
    { selector, body: body("light") },
    { selector: `${selector}[data-theme="dark"]`, body: body("dark") },
    { media: "(prefers-color-scheme:dark)", selector: `${selector}:not([data-theme="light"])`, body: body("dark") },
  ];
}

// One root's appearance rules, screen only (a printed zine stays the zine). Every selector needs an attribute that
// only a non-House run or an applied Lab sets, and html:root outranks the roots' own :root[data-theme] blocks.
export function appearanceStyle(id: AppearanceRootId): string {
  const root = ROOT_APPEARANCE[id];
  const rules: Rule[] = [];
  for (const runId of PRINT_RUN_IDS) {
    const preset = PRINT_RUNS[runId];
    if (!preset.colors) continue;
    const selector = `html:root[${PRINT_RUN_ATTR}="${runId}"]`;
    if (preset.colorScheme === "dark") rules.push({ selector, body: presetBody(root, preset, "dark") });
    else rules.push(...bySchemes(root.scheme, selector, (scheme) => presetBody(root, preset, scheme)));
  }
  // An applied Lab on House keeps the root's colors; only the texture's tone follows the root's scheme.
  rules.push(...bySchemes(root.scheme, `html:root[${INK_LAB_ATTR}]:not([${PRINT_RUN_ATTR}])`, tone));
  if (root.texture) {
    const active = `html:root:is([${PRINT_RUN_ATTR}],[${INK_LAB_ATTR}])`;
    const paper = root.aliases.paper![0];
    // The layer sits at z-index -1 over the canvas, so the page's paper moves from <body> to <html> beneath it.
    rules.push({ selector: active, body: [`background-color:var(${paper})`, root.houseTexture?.html].filter(Boolean).join(";") });
    rules.push({ selector: `${active} body`, body: ["background-color:transparent", root.houseTexture?.body].filter(Boolean).join(";") });
    rules.push({ selector: `${active}::before`, body: 'content:""' });
  }
  const night = PRINT_RUN_IDS.filter((runId) => PRINT_RUNS[runId].colorScheme === "dark").map((runId) => `[${PRINT_RUN_ATTR}="${runId}"]`);
  for (const surface of root.surfaces ?? []) {
    const scope = surface.night ? `html:root:is(${night.join(",")})` : `html:root[${PRINT_RUN_ATTR}]`;
    rules.push({ selector: `${scope} ${surface.selector}`, body: surface.body });
  }
  return rules
    .map((r) => `@media screen${r.media ? ` and ${r.media}` : ""}{${r.selector}{${r.body}}}`)
    .join("");
}

// ---------------------------------------------------------------------------------------------------------------
// Store

export interface BrowserAppearanceStore extends AppearanceStore {
  // Re-read both keys, e.g. after a storage event or a back/forward-cache restore.
  reconcile(): void;
}

export interface AppearanceWindow {
  readonly localStorage: AppearanceStorage;
  readonly sessionStorage: AppearanceStorage;
  addEventListener(type: string, listener: (event: never) => void): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
}

type StorageEventLike = { readonly key: string | null; readonly storageArea: unknown };

const sameSnapshot = (a: AppearanceSnapshot, b: AppearanceSnapshot) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function createBrowserAppearanceStore(win: AppearanceWindow): BrowserAppearanceStore {
  const ports = { local: () => win.localStorage, session: () => win.sessionStorage };
  let inner = createAppearanceStore(ports);
  let snapshot = inner.getSnapshot();
  const listeners = new Set<() => void>();
  const publish = () => {
    const next = inner.getSnapshot();
    if (sameSnapshot(next, snapshot)) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  const reconcile = () => {
    inner = createAppearanceStore(ports);
    publish();
  };
  const area = (get: () => AppearanceStorage) => {
    try { return get(); } catch { return null; }
  };
  // Another tab chose a run (or reset): preset semantics, so this tab's applied Lab no longer hides it.
  const onStorage = (event: StorageEventLike) => {
    const local = area(ports.local);
    if (event.key === PRINT_RUN_KEY || (event.key === null && event.storageArea === local)) {
      try { win.sessionStorage.removeItem(INK_LAB_KEY); } catch { /* reconcile still drops nothing it cannot read */ }
      reconcile();
    } else if (event.key === INK_LAB_KEY || event.key === null) reconcile();
  };
  const onPageShow = (event: { readonly persisted?: boolean }) => {
    if (event.persisted) reconcile();
  };
  const mutate = <T>(run: () => T): T => {
    const result = run();
    publish();
    return result;
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (listeners.size === 0) {
        win.addEventListener("storage", onStorage);
        win.addEventListener("pageshow", onPageShow);
      }
      listeners.add(listener);
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        win.removeEventListener("storage", onStorage);
        win.removeEventListener("pageshow", onPageShow);
      };
    },
    setPrintRun: (id: PrintRunId) => mutate(() => inner.setPrintRun(id)),
    applyLab: (lab: Parameters<AppearanceStore["applyLab"]>[0]) => mutate(() => inner.applyLab(lab)),
    resetHouse: () => mutate(() => inner.resetHouse()),
    reconcile,
  });
}

let shared: BrowserAppearanceStore | null = null;

// The one store of this document. Browser only: components read it after hydration and render HOUSE_SNAPSHOT on the
// server, so the first client render matches the server's.
export function appearanceStore(): BrowserAppearanceStore {
  shared ??= createBrowserAppearanceStore(window as unknown as AppearanceWindow);
  return shared;
}

// ---------------------------------------------------------------------------------------------------------------
// SVG filter adapters

export interface FilterScale {
  readonly turbulence: number;
  readonly displacement: number;
  // Lab wobble: seed changes per second for line work tagged with data-ap-seed. 0 leaves the seeds as drawn.
  readonly wobble: number;
}

export const IDENTITY_SCALE: FilterScale = Object.freeze({ turbulence: 1, displacement: 1, wobble: 0 });
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

// A preset multiplies; an applied Lab sets the ink-hand values, read here as multiples of the chosen hand's own
// material (lib/ink-modes.ts), so a scene keeps its geometry and the amplitude its interaction gives it.
export function filterScale(snapshot: AppearanceSnapshot): FilterScale {
  if (snapshot.lab) {
    const s = snapshot.lab.settings;
    const m = MATERIALS[s.hand];
    return Object.freeze({
      turbulence: round4(s.turbulence / m.warp.frequency),
      displacement: round4(s.displacement / (3.5 * m.warp.scale)),
      wobble: s.wobble,
    });
  }
  const p = PRINT_RUNS[snapshot.printRun];
  return Object.freeze({ turbulence: p.turbulenceMultiplier, displacement: p.displacementMultiplier, wobble: 0 });
}

export const isIdentityScale = (s: FilterScale) => s.turbulence === 1 && s.displacement === 1 && s.wobble === 0;

export const FREQUENCY_TAG = "data-ap-frequency";
export const SCALE_TAG = "data-ap-scale";
export const SEED_TAG = "data-ap-seed";
const TAGGED = `[${FREQUENCY_TAG}],[${SCALE_TAG}],[${SEED_TAG}]`;

// The tags for one lib/ink-modes.ts primitive: the warp's frequency and seed, and the displacement it drives. The
// grain, wash and tooth keep their values. Spread after the primitive's own attributes.
export function appearanceTags(p: Primitive): Record<string, string | number> {
  if (p.tag === "feTurbulence" && p.attrs.result === "warp") return { [FREQUENCY_TAG]: p.attrs.baseFrequency, [SEED_TAG]: p.attrs.seed };
  if (p.tag === "feDisplacementMap" && p.attrs.in2 === "warp") return { [SCALE_TAG]: p.attrs.scale };
  return {};
}

// A source value list ("0.009 0.016") times k. k = 1 gives the source string back exactly.
export function scaleValues(source: string, k: number, digits: number): string {
  if (k === 1 || !source.trim()) return source;
  const parts = source.trim().split(/[\s,]+/).map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return source;
  const f = 10 ** digits;
  return parts.map((n) => String(Math.round(n * k * f) / f)).join(" ");
}

export function shiftSeed(source: string, offset: number): string {
  const n = Number(source);
  return offset === 0 || !Number.isFinite(n) ? source : String(n + (offset % SEEDS));
}

interface TaggedElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

// Writes one tagged primitive's live attributes from its source tags.
export function writeFilter(el: TaggedElement, scale: FilterScale, seedOffset: number) {
  const frequency = el.getAttribute(FREQUENCY_TAG);
  if (frequency !== null) el.setAttribute("baseFrequency", scaleValues(frequency, scale.turbulence, 5));
  const amount = el.getAttribute(SCALE_TAG);
  if (amount !== null) el.setAttribute("scale", scaleValues(amount, scale.displacement, 2));
  const seed = el.getAttribute(SEED_TAG);
  if (seed !== null) el.setAttribute("seed", shiftSeed(seed, seedOffset));
}

export interface FilterRuntime {
  update(scale: FilterScale): void;
  dispose(): void;
}

// Keeps every tagged primitive in the document at the current scale: now, when React re-renders one (its tag changes
// with its source value, in the same commit) and when new ones mount. At most one clock, for the Lab's wobble, and only
// while it is above zero, motion is allowed, the tab is visible and there is tagged line work to boil.
export function createFilterRuntime(doc: Document, win: Window): FilterRuntime {
  let scale = IDENTITY_SCALE;
  let offset = 0;
  let touched = false;
  let observer: MutationObserver | null = null;
  let frame = 0;
  let started = -1;
  const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
  const writeAll = (root: ParentNode) => {
    for (const el of root.querySelectorAll(TAGGED)) writeFilter(el, scale, offset);
  };
  const tick = (now: number) => {
    if (started < 0) started = now;
    const next = Math.floor(((now - started) / 1000) * scale.wobble) % SEEDS;
    if (next !== offset) {
      offset = next;
      for (const el of doc.querySelectorAll(`[${SEED_TAG}]`)) writeFilter(el, scale, offset);
    }
    frame = win.requestAnimationFrame(tick);
  };
  const clock = () => {
    const needed = scale.wobble > 0 && !reduce.matches && !doc.hidden && doc.querySelector(`[${SEED_TAG}]`) !== null;
    if (needed && !frame) {
      started = -1;
      frame = win.requestAnimationFrame(tick);
    } else if (!needed && frame) {
      win.cancelAnimationFrame(frame);
      frame = 0;
    }
    if (!needed && offset !== 0) {
      offset = 0;
      for (const el of doc.querySelectorAll(`[${SEED_TAG}]`)) writeFilter(el, scale, 0);
    }
  };
  const observe = (records: MutationRecord[]) => {
    for (const record of records) {
      if (record.type === "attributes") writeFilter(record.target as Element, scale, offset);
      else for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if ((node as Element).matches(TAGGED)) writeFilter(node as Element, scale, offset);
        writeAll(node as Element);
      }
    }
    clock();
  };
  doc.addEventListener("visibilitychange", clock);
  reduce.addEventListener("change", clock);
  return {
    update(next) {
      scale = next;
      const active = !isIdentityScale(next);
      // House on a page nothing ever rescaled writes nothing at all.
      if (active || touched) writeAll(doc);
      touched = active;
      if (active && !observer) {
        observer = new MutationObserver(observe);
        observer.observe(doc.documentElement, {
          subtree: true, childList: true, attributes: true, attributeFilter: [FREQUENCY_TAG, SCALE_TAG, SEED_TAG],
        });
      } else if (!active && observer) {
        observer.disconnect();
        observer = null;
      }
      clock();
    },
    dispose() {
      observer?.disconnect();
      observer = null;
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      doc.removeEventListener("visibilitychange", clock);
      reduce.removeEventListener("change", clock);
    },
  };
}
