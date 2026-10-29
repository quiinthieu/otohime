export type SqlCell = string | number | boolean | null;
export type SqlRows = Record<string, SqlCell>[];
export const SQL_ROW_LIMIT = 200;
export const SQL_TIMEOUT_MS = 6000;
export const SQL_TABLES = {
  notes: "slug VARCHAR, title VARCHAR, date VARCHAR, tags VARCHAR",
  projects: "title VARCHAR, note VARCHAR, status VARCHAR, href VARCHAR, started VARCHAR, shipped VARCHAR",
  sketches: "title VARCHAR, kind VARCHAR, note VARCHAR, image VARCHAR",
  commits: "sha VARCHAR, date VARCHAR, subject VARCHAR, files INTEGER, added INTEGER, removed INTEGER",
  songs: "title VARCHAR, artist VARCHAR, note VARCHAR, video VARCHAR",
  music_plays: "title VARCHAR, artist VARCHAR, played_at VARCHAR",
} as const;
export type SqlTable = keyof typeof SQL_TABLES;
export type SqlDataset = { revision: string; tables: Record<SqlTable, SqlRows> };
export const SAVED_SQL = [
  { id: "notes", label: "Notes by month", sql: "SELECT substr(date, 1, 7) AS month, count(*) AS notes FROM notes GROUP BY month ORDER BY month" },
  { id: "projects", label: "Projects on the shelf", sql: "SELECT status, count(*) AS projects FROM projects GROUP BY status ORDER BY status" },
  { id: "commits", label: "Ink by day", sql: "SELECT substr(date, 1, 10) AS day, count(*) AS commits FROM commits GROUP BY day ORDER BY day DESC LIMIT 12" },
  { id: "sketches", label: "Sketchbook census", sql: "SELECT kind, count(*) AS sketches FROM sketches GROUP BY kind ORDER BY kind" },
] as const;

/** A convenience guard; DuckDB's disabled external access and locked settings are the boundary. */
export function boundedSql(input: string): string {
  if (!input.trim() || input.length > 8000) throw new Error("Use a SELECT query of at most 8,000 characters.");
  let code = "", i = 0, delimiter = -1;
  while (i < input.length) {
    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i++]; let closed = false;
      while (i < input.length) {
        if (input[i++] === quote) { if (input[i] === quote) { i++; continue; } closed = true; break; }
      }
      if (!closed) throw new Error("Close the quoted value before running.");
      code += " value ";
    } else if (input.slice(i, i + 2) === "--") {
      while (i < input.length && input[i] !== "\n") i++;
      code += " ";
    } else if (input.slice(i, i + 2) === "/*") {
      i += 2; let depth = 1;
      while (i < input.length && depth) {
        if (input.slice(i, i + 2) === "/*") { depth++; i += 2; }
        else if (input.slice(i, i + 2) === "*/") { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error("Close the SQL comment before running.");
      code += " ";
    } else { if (input[i] === ";") delimiter = i; code += input[i++]; }
  }
  const clean = code.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(clean) || clean.includes(";") || /\b(attach|detach|copy|export|import|pragma|set|reset|install|load|call|create|alter|drop|insert|update|delete|merge|query|query_table|glob|getenv|read_\w*|http\w*|sqlite\w*|postgres\w*|duckdb_secrets)\b/i.test(clean)) {
    throw new Error("This desk accepts one read-only SELECT over the public tables. Files, networks and extensions are closed.");
  }
  // Remove a trailing statement delimiter without disturbing semicolons in quoted strings or comments.
  const sql = delimiter < 0 ? input : input.slice(0, delimiter) + input.slice(delimiter + 1);
  return `SELECT * FROM (\n${sql}\n) AS ink_query LIMIT ${SQL_ROW_LIMIT + 1}`;
}

export function savedRows(dataset: SqlDataset, id: string): SqlRows {
  const group = (table: SqlRows, key: string, value: string, name: string) => {
    const counts = new Map<string, number>();
    table.forEach(row => { const s = String(row[key] ?? "").slice(0, value === "month" ? 7 : value === "day" ? 10 : undefined); counts.set(s, (counts.get(s) ?? 0) + 1); });
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => ({ [value]: label, [name]: count }));
  };
  if (id === "projects") return group(dataset.tables.projects, "status", "status", "projects");
  if (id === "sketches") return group(dataset.tables.sketches, "kind", "kind", "sketches");
  if (id === "commits") return group(dataset.tables.commits, "date", "day", "commits").reverse().slice(0, 12);
  return group(dataset.tables.notes, "date", "month", "notes");
}
