import { boundedSql, SQL_ROW_LIMIT, SQL_TABLES, SQL_TIMEOUT_MS, type SqlDataset, type SqlRows } from "./sql-desk.ts";

export async function openSqlDesk(signal: AbortSignal) {
  const duckdb = await import("@duckdb/duckdb-wasm");
  if (signal.aborted) throw new Error("Desk closed.");
  const base = "/vendor/duckdb/1.33.1-dev57.0/";
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: base + "duckdb-mvp.wasm", mainWorker: base + "duckdb-browser-mvp.worker.js" },
    eh: { mainModule: base + "duckdb-eh.wasm", mainWorker: base + "duckdb-browser-eh.worker.js" },
  });
  if (signal.aborted) throw new Error("Desk closed.");
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  let dead = false;
  const dispose = () => { if (dead) return; dead = true; signal.removeEventListener("abort", dispose); worker.terminate(); };
  signal.addEventListener("abort", dispose, { once: true });
  const deadline = async <T,>(work: Promise<T>, ms: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => { dispose(); reject(new Error("The desk's time limit was reached. Reopen it to run another query.")); }, ms); })]);
    } finally { clearTimeout(timer!); }
  };
  try {
    await deadline((async () => {
      await db.instantiate(bundle.mainModule);
      await db.open({ maximumThreads: 1, allowUnsignedExtensions: false, query: { castBigIntToDouble: true, castDecimalToDouble: true } });
      const response = await fetch("/ledger-sql.json", { signal });
      if (!response.ok) throw new Error("The public snapshot could not be loaded.");
      const data: SqlDataset = await response.json();
      const conn = await db.connect();
      await conn.query("SET memory_limit='128MB'; SET threads=1; SET max_expression_depth=100; SET autoinstall_known_extensions=false; SET autoload_known_extensions=false; SET enable_external_access=false; SET lock_configuration=true;");
      for (const [name, schema] of Object.entries(SQL_TABLES)) {
        await conn.query(`CREATE TABLE ${name} (${schema})`);
        const rows = data.tables[name as keyof typeof SQL_TABLES];
        if (rows.length) {
          // Prepared values import the public JSON without loading DuckDB's external JSON extension.
          const columns = schema.split(",").map(field => field.trim().split(" ")[0]);
          const insert = await conn.prepare(`INSERT INTO ${name} VALUES (${columns.map(() => "?").join(",")})`);
          try { for (const row of rows) await insert.query(...columns.map(c => row[c] ?? null)); }
          finally { await insert.close(); }
        }
      }
      await conn.close();
    })(), 30000);
  } catch (e) { dispose(); throw e; }
  return {
    dispose,
    get closed() { return dead; },
    async query(sql: string): Promise<{ rows: SqlRows; columns: string[]; truncated: boolean; ms: number }> {
      if (dead) throw new Error("Reopen the desk before running a query.");
      const query = boundedSql(sql), at = performance.now();
      return deadline((async () => {
        const conn = await db.connect();
        try {
          const result = await conn.query(query);
          const columns = result.schema.fields.slice(0, 20).map(f => f.name);
          const rows = result.toArray().slice(0, SQL_ROW_LIMIT).map(row => Object.fromEntries(columns.map(c => {
            const v = row[c];
            return [c, v == null ? null : typeof v === "number" || typeof v === "boolean" ? v : String(v).slice(0, 500)];
          })));
          return { rows, columns, truncated: result.numRows > SQL_ROW_LIMIT || result.numCols > 20, ms: performance.now() - at };
        } finally { if (!dead) await conn.close(); }
      })(), SQL_TIMEOUT_MS);
    },
  };
}
