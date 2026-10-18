import type { Swatch } from "@/components/figures";

export type Game = { title: string; note: string; colour: Swatch };

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
};
