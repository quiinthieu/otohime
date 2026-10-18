import type { Swatch } from "@/components/figures";

export type Game = { title: string; note: string; colour: Swatch };
// track: the id after /track/ in Share → Copy song link. Optional; it lets
// the deck show which song is playing.
export type Song = { title: string; artist: string; note: string; colour: Swatch; track?: string };

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
  // TODO(otohime): add GitHub, a game profile, anything else
  links: [{ label: "Email", href: "mailto:hello@otohime.dev" }],
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
  music: "Songs I keep coming back to, on one tape. Press play on the deck.",
  // TODO(otohime): your playlist, the id after /playlist/ in Share → Copy link.
  // A public Spotify playlist stands in for now.
  playlist: "37i9dQZF1DX4UtSsGT1Sbe",
  // TODO(otohime): your songs, best first
  songs: [
    { title: "Take on Me", artist: "a-ha", note: "One impossible note, attempted every time.", colour: "yellow", track: "2WfaOiMkCvy7F5fcp2zZ8L" },
    { title: "Billie Jean", artist: "Michael Jackson", note: "A bassline steady enough to set a cron by.", colour: "coral", track: "5ChkMS8OtdzJeqyybCc9R5" },
    { title: "Total Eclipse of the Heart", artist: "Bonnie Tyler", note: "For the 3 a.m. backfill.", colour: "blue", track: "7wuJGgpTNzbUyn26IOY6rj" },
    { title: "Heaven Is A Place On Earth", artist: "Belinda Carlisle", note: "Volume up, tests green.", colour: "pink", track: "37Q5anxoGWYdRsyeXkkNoI" },
    { title: "La Isla Bonita", artist: "Madonna", note: "The holiday the pipeline never takes.", colour: "mint", track: "6r8k1vznHrzlEKYxL4dZEe" },
    { title: "The Winner Takes It All", artist: "ABBA", note: "Plays whenever a deploy rolls back.", colour: "yellow", track: "3oEkrIfXfSh9zGnE7eBzSV" },
  ] satisfies Song[],
};
