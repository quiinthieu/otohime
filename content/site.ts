import type { Swatch } from "@/components/figures";
import { PUBLIC_PAGES } from "../lib/pages.ts";
import { resolveSketchesCollection, type Sketch } from "../lib/sketches.ts";
import type { ZineConfig } from "../lib/zine.ts";

export type { Sketch };

export type Project = {
  title: string;
  note: string;
  href?: string;
  status: "building" | "live" | "shelved";
  colour: Swatch;
  started?: string;
  shipped?: string;
  lastActivityAt?: string;
  abandoned?: boolean;
  demoFixture?: boolean;
};
export type Game = { title: string; note: string; colour: Swatch };
export type Note = { slug: string; date: string; title: string; body: string; tags: string[] };
// A way to reach me, as a line on the home page's switchboard. code is the
// line's label on the board.
export type Line = { label: string; handle: string; href: string; code: string; colour: Swatch };
// video: the song's YouTube upload, the id after watch?v= in its link.
export type Song = { title: string; artist: string; note: string; colour: Swatch; video: string };
export type EndCue = {
  lcd: readonly [string, string];
  readout: string;
};
export type EndCopy = {
  title: string;
  sub: string;
  status: string;
  signature: string;
  badge: string;
  achievement: string;
  // the link under the footer's waterline, down to Ryugu-jo
  below: string;
  idle: EndCue;
  tenth: EndCue;
  unlocked: EndCue;
  lines: readonly EndCue[];
};

const sketchesCollection = resolveSketchesCollection();

// The words on the public pages, in one place. Central single source of truth
// for public copy, capability statements, and navigation.
export const site = {
  tagline: "High-throughput data platforms, lakehouse systems, and tactile software",
  // The masthead's speaker: the console beeps only once it is on.
  sound: { label: "Console sounds" },
  bio: [
    "I architect high-throughput data platforms, petabyte lakehouses, and real-time streaming engines that keep multi-billion-row workloads honest.",
    "Eight years in distributed systems funds an obsession with tactile software, bespoke mechanical hardware, and uncompromising digital craft.",
    "By night, I push max heat in Hades II, min-max Factorio megabases on a custom liquid-cooled rig, or curate rare geisha coffee lots.",
  ],
  now: [
    { what: "Architecting", note: "a sub-second streaming engine for petabyte lakehouses" },
    { what: "Playing", note: "Hades II high-heat runs on a custom water-cooled OLED rig" },
    { what: "Curating", note: "analog synths, geisha coffee lots, and bespoke mechanical keyboards" },
  ],
  lines: [
    { label: "Telegram", handle: "@otohime73", href: "https://t.me/otohime73", code: "TG", colour: "blue" },
    { label: "X", handle: "@otohime73", href: "https://x.com/otohime73", code: "X", colour: "yellow" },
    {
      label: "Spotify",
      handle: "otohime",
      href: "https://open.spotify.com/user/2rjk8knzs0fyfc7oovb2zezqw",
      code: "SP",
      colour: "mint",
    },
    { label: "Email", handle: "hello@otohime.dev", href: "mailto:hello@otohime.dev", code: "@", colour: "coral" },
  ] satisfies Line[],
  // The knobs under every machine: the material it is drawn in, a fresh set
  // of strokes, and boiling lines (off unless pressed, never under reduced motion).
  ink: {
    hand: "Hand",
    hands: { ink: "Ink", pencil: "Pencil", crayon: "Crayon", watercolour: "Watercolour" },
    reroll: "Re-roll",
    rerollLabel: "Re-roll the strokes",
    boil: "Boil",
    boilLabel: "Boil the lines",
    still: "Boiling is off: your system asks for less motion.",
  },
  // The switchboard's plug, carried by hand to a jack.
  switchboard: { held: "Plug in hand. Let go over a jack to connect." },
  // The pocket console's game behind B (lib/snake.ts): chips, LCD lines and the readout.
  pocket: {
    play: "B Play",
    menu: "B Menu",
    start: "A Start",
    restart: "A Restart",
    left: "◀ Left",
    right: "▶ Right",
    title: "SNAKE",
    pressA: "PRESS A",
    over: "GAME OVER",
    won: "FULL!",
    ready: (best: number, reduced: boolean) =>
      `Pipeline snake. Press A to start; ${reduced ? "each arrow moves one cell" : "the d-pad steers"}. Best ${best}.`,
    playing: (score: number, best: number) => `Score ${score}. Best ${best}.`,
    lost: (score: number, best: number) => `Crashed with ${score}. Best ${best}. A plays again, B goes back to the menu.`,
    full: (score: number) => `The pipeline is full: ${score}! A plays again.`,
    wrap: "Debug mode: walls wrap.",
    badge: "★",
    // The way down to Ryugu-jo (app/(ryugu)/), beside the menu's chips.
    dive: "▽ Dive",
    // Ryugu-jo's sea sound, beside Dive: it sounds only in the palace, never up here.
    seaSound: "♪ Sea sound",
    seaSoundLabel: "Sea sound in Ryugu-jo",
  },
  notes: [
    {
      slug: "backfills-are-a-feature",
      tags: ["data-engineering", "backfills", "idempotency"],
      date: "2026-10-12",
      title: "Backfills are a feature",
      body: "Two years of events, replayed in an afternoon, because the jobs were idempotent from day one.",
    },
    {
      slug: "on-twos",
      tags: ["animation", "hand-drawn"],
      date: "2026-09-28",
      title: "On twos",
      body: "The figures here animate at twelve frames a second, like hand-drawn film. Smoother looked worse.",
    },
    {
      slug: "the-contract-caught-it",
      tags: ["data-engineering", "data-contracts"],
      date: "2026-09-03",
      title: "The contract caught it",
      body: "A data contract stopped a breaking change before anyone opened a dashboard. First time. Worth it.",
    },
  ] satisfies Note[],
  work: "I architect the core data stack engineers use at work: sub-second streaming pipelines, petabyte lakehouse governance, and deterministic execution engines designed for zero-downtime scale.",
  // The Work page's source-to-dashboard figure (components/pipeline.tsx, lib/pipeline.ts): made-up packets,
  // never real data.
  pipeline: {
    label: "Pipeline simulation",
    caption: "Simulation",
    note: "An illustrative simulation: the packets are made up, and nothing is fetched.",
    emit: "Emit",
    backfill: "Backfill",
    pause: "Pause",
    resume: "Resume",
    stations: { source: "SOURCE", queue: "QUEUE", warehouse: "WAREHOUSE", dashboard: "DASHBOARD" },
    hold: "HOLD",
    stats: { inFlight: "In flight", queued: "Queue", stored: "Stored", lag: "Lag", emitted: "Sent", shown: "Shown" },
    idle: "Emit a packet, or backfill eight.",
    flowing: "Packets are on their way to the dashboard.",
    filling: "Paused: the source keeps sending and the queue fills.",
    held: (queued: number) => `Paused with ${queued} in the queue. Resume to drain it.`,
    caught: (shown: number) => `All ${shown} on the dashboard. No lag.`,
    full: "The pipes are full. Let some packets land first.",
  },
  stack: [
    { what: "Warehouse", tools: "Snowflake, BigQuery", note: "petabyte lakehouse architecture and compute separation" },
    { what: "Streaming", tools: "Kafka", note: "sub-second event streams and real-time topology routing" },
    { what: "Transformation", tools: "dbt", note: "contract-driven SQL models with strict boundary invariants" },
    { what: "Storage", tools: "Iceberg on S3", note: "open table formats with zero-copy branch isolation and time travel" },
    { what: "Orchestration", tools: "Airflow", note: "deterministic distributed DAGs and calm, observable schedules" },
    { what: "Embedded OLAP", tools: "DuckDB", note: "in-process vectorized execution for sub-second analytical workloads" },
    { what: "Quality & Governance", tools: "tests, contracts, alerts", note: "strict schema enforcement before bad data fans out" },
  ],
  play: "Six games in rotation on a custom water-cooled OLED rig. Win one from the cabinet to hear why.",
  games: [
    { title: "Factorio", note: "5,000 science per minute, zero bottlenecks, pure architectural discipline.", colour: "yellow" },
    { title: "Hades II", note: "Max heat, relentless rhythm, and unyielding mechanical precision.", colour: "coral" },
    { title: "Elden Ring", note: "Patience, frame-perfect dodges, and clean no-hit boss encounters.", colour: "blue" },
    { title: "Cyberpunk 2077", note: "Night City maxed out at 4K path tracing on a custom liquid-cooled rig.", colour: "pink" },
    { title: "Balatro", note: "High-stakes mathematical min-maxing and probability engine design.", colour: "mint" },
    { title: "Tetris Effect", note: "Pure flow state, high-tempo bin packing, and audio-visual euphoria.", colour: "yellow" },
  ] satisfies Game[],
  projects: "Independent tools, distributed systems experiments, and interactive tactile software built with unhurried craft.",
  // Add a project here and it shows up on /projects.
  projectList: [
    { title: "Shore", note: "A tactile focus timer that leaves smoothed sea glass along the tide line.", href: "/shore", status: "live", colour: "mint", started: "2026-10-19", shipped: "2026-10-19", lastActivityAt: "2026-10-26" },
    { title: "Capsule", note: "A mechanical gashapon cabinet with custom brass tokens and collectible keepsake cards.", href: "/capsule", status: "live", colour: "coral", started: "2026-10-19", shipped: "2026-10-19", lastActivityAt: "2026-10-26" },
    { title: "Orrery", note: "The celestial mechanics of our solar system, calculated in vector orbits and drawn by hand.", href: "/orrery", status: "live", colour: "yellow", started: "2026-10-19", shipped: "2026-10-20", lastActivityAt: "2026-10-26" },
    { title: "Elements", note: "Interactive atomic lattice models for all 118 elements with subatomic physics telemetry.", href: "/elements", status: "live", colour: "blue", started: "2026-10-19", shipped: "2026-10-19", lastActivityAt: "2026-10-26" },
    { title: "Vinyl", note: "An analog turntable simulation featuring curated late-night jazz and electronic master pressings.", href: "/vinyl", status: "live", colour: "pink", started: "2026-10-19", shipped: "2026-10-19", lastActivityAt: "2026-10-26" },
    { title: "Rotor", note: "A hand-drawn cryptographic Enigma rotor simulation with real-time permutation stepping.", href: "/rotor", status: "live", colour: "coral", started: "2026-10-20", shipped: "2026-10-20", lastActivityAt: "2026-10-26" },
    { title: "Planisphere", note: "A real-time night-sky star wheel rendered from high-precision astronomical coordinates.", href: "/planisphere", status: "live", colour: "blue", started: "2026-10-20", shipped: "2026-10-20", lastActivityAt: "2026-10-26" },
    { title: "Barometer", note: "A precision brass meteorological instrument tracking atmospheric pressure and weather deltas.", href: "/barometer", status: "live", colour: "yellow", started: "2026-10-20", shipped: "2026-10-20", lastActivityAt: "2026-10-26" },
    { title: "Gazette", note: "A curated digital broadsheet covering distributed systems, interactive engines, and physics.", href: "/articles", status: "live", colour: "pink", started: "2026-10-21", shipped: "2026-10-21", lastActivityAt: "2026-10-26" },
    { title: "Structures", note: "Eight foundational data structures and graph algorithms rendered as tactile, inspectable toys.", href: "/structures", status: "live", colour: "mint", started: "2026-10-21", shipped: "2026-10-21", lastActivityAt: "2026-10-26" },
    { title: "Design system", note: "A bespoke design token workbench balancing quiet luxury minimalism with cyber-aesthetic precision.", href: "/design-system", status: "live", colour: "coral", started: "2026-10-21", shipped: "2026-10-21", lastActivityAt: "2026-10-26" },
  ] as Project[],
  music: "Songs on repeat, one channel each. Tune in.",
  // The same songs on Spotify, linked under the player: the id after
  // /playlist/ in Share → Copy link.
  playlist: "609w1YzsoSy1zuHmyBhYwu",
  // Music's cassette and game cartridge (components/cassette.tsx). At rest they print the playlist and the
  // "Playing" line of site.now; a reading from Spotify or Steam (lib/now-playing.ts) only swaps the words.
  nowPlaying: {
    heading: "Now playing",
    tape: "Side A · Spotify",
    tapeListenBrainz: "Side A · ListenBrainz",
    last: "Last on the deck",
    publicTrack: "The public track",
    profile: "The ListenBrainz profile",
    cart: "Cartridge · Steam",
    cartLanyard: "Cartridge · Lanyard",
    playing: "On the deck",
    paused: "Paused on the deck",
    quiet: "Quiet",
    quietTape: "Nothing on the deck right now.",
    quietTapeNote: "The playlist is always on.",
    playlist: "The playlist on Spotify",
    track: "The track on Spotify",
    inGame: "In a game now",
    game: "The game on Steam",
    quietGame: "From my Now list, not read live.",
    read: "Read",
    unread: "Not read live: the labels are the static ones.",
    credit: { lanyard: "game presence from Lanyard / Discord", listenbrainz: "Track details from ListenBrainz (CC0)", spotify: "Track details from Spotify", steam: "game details from Steam" },
  },
  // The songs in play order, each with why it's there.
  songs: [
    {
      title: "Nicole Kidman",
      artist: "ADÉLA",
      note: "Effortless glamour and velvet bass for late-night architecture sessions.",
      colour: "pink",
      video: "IXA6bQsVNjs",
    },
    {
      title: "bye",
      artist: "Altare",
      note: "Cinematic wave and crystalline synths that match an ultra-clean desk setup.",
      colour: "blue",
      video: "agneRtEe-t8",
    },
    {
      title: "Less than a Lover",
      artist: "JENNIE",
      note: "Polished, chic, and warm—the soundtrack to an unhurried morning.",
      colour: "yellow",
      video: "vR49dHUwMUA",
    },
  ] satisfies Song[],
  sketchesHint: sketchesCollection.hint,
  sketchesIntro: sketchesCollection.intro,
  sketches: sketchesCollection.sketches satisfies Sketch[],
  // The fold zine on /zine (lib/zine.ts): four projects by title, one sketch by title, and the issue line on the
  // cover. The rest is picked for you: the bio, and the newest note on the back.
  zine: {
    projects: ["Shore", "Orrery", "Rotor", "Planisphere"],
    sketch: "Lake",
    issue: "No. 1 · Autumn 2026",
  } satisfies ZineConfig,
  end: {
    title: "You've reached the end of the internet.",
    sub: "Thanks for stopping by. See you on the next level.",
    status: "SAVE POINT · 12 FPS · DRAWN ON PAPER",
    signature: "Drawn in SVG, built with Next.js, animated on twos.",
    badge: "★ 1/1 Reached the end",
    achievement: "Achievement unlocked: Reached the end.",
    // The link under the footer's waterline, down to Ryugu-jo (components/end-footer.tsx).
    below: "Below the waterline: Ryugu-jo ↓",
    idle: {
      lcd: ["SAVE", "POINT"] as const,
      readout: "Save point ready. Poke the console or tap a key sequence.",
    },
    tenth: {
      lcd: ["STOP", "POKING"] as const,
      readout: "Ten pokes. The A button needs a breather.",
    },
    unlocked: {
      lcd: ["REACHED", "THE END"] as const,
      readout: "Achievement unlocked: Reached the end.",
    },
    lines: [
      {
        lcd: ["SAVE", "POINT"] as const,
        readout: "Save point ready. Your place on the paper is kept.",
      },
      {
        lcd: ["HI", "THERE"] as const,
        readout: "Still scrolling? There is only paper past this edge.",
      },
      {
        lcd: [`${PUBLIC_PAGES.length} PAGES`, "INDEXED"] as const,
        readout: `${PUBLIC_PAGES.length} public pages in the index above.`,
      },
      {
        lcd: ["12 FPS", "ON TWOS"] as const,
        readout: "Drawn on twos at twelve frames a second.",
      },
      {
        lcd: ["TRY THE", "ARROWS"] as const,
        readout: "Old muscle memory still works on the keys here.",
      },
      {
        lcd: ["NEXT", "LEVEL"] as const,
        readout: "Thanks for stopping by. See you on the next level.",
      },
    ],
  } satisfies EndCopy,
};
