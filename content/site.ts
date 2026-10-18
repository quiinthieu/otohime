import type { Swatch } from "@/components/figures";

export type Game = { title: string; note: string; colour: Swatch };

// The words on the public pages, in one place. A first draft: everything
// marked TODO(otohime) is invented and waits for the real thing.
export const site = {
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
