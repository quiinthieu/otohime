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
};
export type Game = { title: string; note: string; colour: Swatch };
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

// The words on the public pages, in one place. A first draft: everything
// marked TODO(otohime) is invented and waits for the real thing.
export const site = {
  tagline: "Data engineer. Plays games.",
  // The masthead's speaker: the console beeps only once it is on.
  sound: { label: "Console sounds" },
  // TODO(otohime): the rest is a first draft
  bio: [
    "I move data from where it lands to where people can use it, and keep it honest on the way.",
    "Most days that means warehouses, schedules and SQL. Some nights it means a backfill.",
    "The rest of the time I'm playing something with a skill tree, a speedrun timer or a factory that must grow.",
  ],
  // TODO(otohime)
  now: [
    { what: "Building", note: "a streaming pipeline that pages nobody" },
    { what: "Playing", note: "Hades II, one more run" },
    { what: "Reading", note: "Designing Data-Intensive Applications, again" },
  ],
  lines: [
    { label: "Telegram", handle: "@otohime73", href: "https://t.me/otohime73", code: "TG", colour: "blue" },
    { label: "X", handle: "@otohime73", href: "https://x.com/otohime73", code: "X", colour: "yellow" },
    // TODO(otohime): the handle should be the profile's display name
    {
      label: "Spotify",
      handle: "otohime",
      href: "https://open.spotify.com/user/2rjk8knzs0fyfc7oovb2zezqw",
      code: "SP",
      colour: "mint",
    },
    // TODO(otohime): a first draft
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
  // TODO(otohime)
  notes: [
    {
      date: "2026-10-12",
      title: "Backfills are a feature",
      body: "Two years of events, replayed in an afternoon, because the jobs were idempotent from day one.",
    },
    {
      date: "2026-09-28",
      title: "On twos",
      body: "The figures here animate at twelve frames a second, like hand-drawn film. Smoother looked worse.",
    },
    {
      date: "2026-09-03",
      title: "The contract caught it",
      body: "A data contract stopped a breaking change before anyone opened a dashboard. First time. Worth it.",
    },
  ],
  // TODO(otohime)
  work: "I build the pipes between where data lands and where people use it: batch jobs, streams, and the odd 3 a.m. backfill.",
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
  // TODO(otohime): your stack
  stack: [
    { what: "Warehouse", tools: "Snowflake, BigQuery", note: "where the questions get answered" },
    { what: "Transformation", tools: "dbt", note: "SQL with version control and manners" },
    { what: "Orchestration", tools: "Airflow, Dagster", note: "the schedule, and what happens when it slips" },
    { what: "Streaming", tools: "Kafka", note: "for whatever can't wait for the nightly run" },
    { what: "Storage", tools: "Iceberg on S3", note: "cheap, open, time travel included" },
    { what: "Quality", tools: "tests, contracts, alerts", note: "so the dashboard is right before anyone asks" },
  ],
  // TODO(otohime)
  play: "Six games in rotation. Win one from the cabinet to hear why.",
  // TODO(otohime): your games; the swatch is the capsule's colour
  games: [
    { title: "Factorio", note: "The factory must grow. So must the DAG.", colour: "yellow" },
    { title: "Celeste", note: "Every strawberry, eventually.", colour: "pink" },
    { title: "Hades II", note: "One more run, then bed.", colour: "coral" },
    { title: "Stardew Valley", note: "The crops have a spreadsheet.", colour: "mint" },
    { title: "Tetris Effect", note: "Bin packing, with feelings.", colour: "blue" },
    { title: "Outer Wilds", note: "Twenty-two minutes at a time.", colour: "yellow" },
  ] satisfies Game[],
  // TODO(otohime)
  projects: "Independent projects, built in my own time and not for any employer.",
  // Add a project here and it shows up on /projects.
  projectList: [
    { title: "Shore", note: "A focus timer that leaves sea glass behind.", href: "/shore", status: "live", colour: "mint", started: "2026-10-01", shipped: "2026-10-19", lastActivityAt: "2026-10-25" },
    { title: "Capsule", note: "A coin, a crank, and a printed card to keep.", href: "/capsule", status: "live", colour: "coral", started: "2026-10-03", shipped: "2026-10-19", lastActivityAt: "2026-10-24" },
    { title: "Orrery", note: "The Sun, the planets and five stars, cut open and drawn by hand.", href: "/orrery", status: "live", colour: "yellow", started: "2026-10-05", shipped: "2026-10-20", lastActivityAt: "2026-10-24" },
    { title: "Elements", note: "All 118, each with a spinning atom and one surprising fact.", href: "/elements", status: "live", colour: "blue", started: "2026-10-04", shipped: "2026-10-19", lastActivityAt: "2026-10-25" },
    { title: "Vinyl", note: "Dig the crate, drop the needle, watch it play.", href: "/vinyl", status: "live", colour: "pink", started: "2026-10-06", shipped: "2026-10-19", lastActivityAt: "2026-10-23" },
    { title: "Rotor", note: "An Enigma, drawn by hand. Type and watch the lamps.", href: "/rotor", status: "live", colour: "coral", started: "2026-10-08", shipped: "2026-10-20", lastActivityAt: "2026-10-24" },
    { title: "Planisphere", note: "Tonight's sky for your city, on a star wheel drawn in ink.", href: "/planisphere", status: "live", colour: "blue", started: "2026-10-09", shipped: "2026-10-20", lastActivityAt: "2026-10-25" },
    { title: "Barometer", note: "A brass weather station for your city, read every quarter hour.", href: "/barometer", status: "building", colour: "yellow", started: "2026-10-18", lastActivityAt: "2026-10-25" },
    { title: "Gazette", note: "A small newspaper: six short pieces on everyday science, each with a drawn infographic.", href: "/articles", status: "live", colour: "pink", started: "2026-10-11", shipped: "2026-10-21", lastActivityAt: "2026-10-26" },
    { title: "Structures", note: "Eight ways to keep things, drawn by hand so you can poke them.", href: "/structures", status: "shelved", colour: "mint", started: "2026-05-12", lastActivityAt: "2026-06-20", abandoned: true },
    { title: "Design system", note: "A box of decisions made once, drawn so you can turn the knobs.", href: "/design-system", status: "shelved", colour: "coral", lastActivityAt: "2026-06-01" },
  ] as Project[],
  // TODO(otohime)
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
  // TODO(otohime): the reasons are a first draft; make them yours
  songs: [
    {
      title: "Nicole Kidman",
      artist: "ADÉLA",
      note: "A song about dressing up like a film star for one night. It turns any Tuesday into a premiere.",
      colour: "pink",
      video: "IXA6bQsVNjs",
    },
    {
      title: "bye",
      artist: "Altare",
      note: "A goodbye that waves instead of slamming the door. Three minutes, then out, like any good exit.",
      colour: "blue",
      video: "agneRtEe-t8",
    },
    {
      title: "Less than a Lover",
      artist: "JENNIE",
      note: "Lo-fi guitar, old keys and the space between friends and more. A whole summer in under three minutes.",
      colour: "yellow",
      video: "vR49dHUwMUA",
    },
  ] satisfies Song[],
  // TODO(otohime)
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
