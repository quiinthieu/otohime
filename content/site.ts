import type { Swatch } from "@/components/figures";

export type Project = {
  title: string;
  note: string;
  href?: string;
  status: "building" | "live" | "shelved";
  colour: Swatch;
};
export type Game = { title: string; note: string; colour: Swatch };
// A way to reach me, as a line on the home page's switchboard. code is the
// line's label on the board.
export type Line = { label: string; handle: string; href: string; code: string; colour: Swatch };
// video: the song's YouTube upload, the id after watch?v= in its link.
export type Song = { title: string; artist: string; note: string; colour: Swatch; video: string };

// The words on the public pages, in one place. A first draft: everything
// marked TODO(otohime) is invented and waits for the real thing.
export const site = {
  tagline: "Data engineer. Plays games.",
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
    { title: "Shore", note: "A focus timer that leaves sea glass behind.", href: "/shore", status: "live", colour: "mint" },
    { title: "Capsule", note: "A coin, a crank, and a printed card to keep.", href: "/capsule", status: "live", colour: "coral" },
    { title: "Sun", note: "Our star, cut open and drawn by hand.", href: "/sun", status: "live", colour: "yellow" },
    { title: "Elements", note: "All 118, each with a spinning atom and one surprising fact.", href: "/elements", status: "live", colour: "blue" },
    { title: "Vinyl", note: "Dig the crate, drop the needle, watch it play.", href: "/vinyl", status: "live", colour: "pink" },
  ] as Project[],
  // TODO(otohime)
  music: "Songs on repeat, one channel each. Tune in.",
  // The same songs on Spotify, linked under the player: the id after
  // /playlist/ in Share → Copy link.
  playlist: "609w1YzsoSy1zuHmyBhYwu",
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
};
