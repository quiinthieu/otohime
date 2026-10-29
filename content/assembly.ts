// Qualitative descriptions of the stack already published on Work. No client
// names or unverified performance figures are presented as case studies.
export const assemblyStations = [
  { id: "ingest", title: "Ingest", machine: "The receiving hopper", project: "Batch jobs & event streams", detail: "Bring events and files onto a line that can be replayed when a source arrives late.", tech: "Kafka · Airflow · Dagster", impact: "Replayable inputs, ready for the next step.", colour: "--blue" },
  { id: "clean", title: "Clean", machine: "The contract cutter", project: "Tests & data contracts", detail: "Check the shape of incoming data before a breaking change can reach a dashboard.", tech: "SQL · tests · contracts · alerts", impact: "Bad data gets a checkpoint before it travels.", colour: "--coral" },
  { id: "transform", title: "Transform", machine: "The SQL sorting press", project: "Versioned transformations", detail: "Turn source records into models that carry their logic and history with them.", tech: "dbt · SQL · version control", impact: "Business logic can be reviewed and reproduced.", colour: "--yellow" },
  { id: "load", title: "Load", machine: "The warehouse packer", project: "Warehouse & open storage", detail: "Put the shaped data where it can be queried, with storage that keeps its history.", tech: "Snowflake · BigQuery · Iceberg on S3", impact: "Queryable tables, with room to look back.", colour: "--mint" },
  { id: "serve", title: "Serve", machine: "The dispatch window", project: "Data people can use", detail: "Carry the work through to the questions people ask, and keep the schedule and quality checks close by.", tech: "SQL · warehouses · orchestration", impact: "A clear path from landed data to an answer.", colour: "--pink" },
] as const;
