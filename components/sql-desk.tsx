"use client";
import { useEffect, useRef, useState } from "react";
import { SAVED_SQL, savedRows, SQL_TABLES, type SqlDataset, type SqlRows } from "@/lib/sql-desk";
import type { openSqlDesk } from "@/lib/sql-browser";

type Engine = Awaited<ReturnType<typeof openSqlDesk>>;
function ResultSheet({ rows, columns }: { rows: SqlRows; columns: string[] }) {
  return <div className="sql-results" tabIndex={0} role="region" aria-label="Query results">
    <table><caption>Query receipt · {rows.length} rows</caption><thead><tr><th scope="col">№</th>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}><th scope="row">{String(i + 1).padStart(2, "0")}</th>{columns.map(c => <td key={c}>{r[c] === null ? <em>NULL</em> : String(r[c])}</td>)}</tr>)}</tbody></table>
    {rows.length === 0 && <p className="sql-empty">No rows in this receipt.</p>}
  </div>;
}
function InkChart({ rows, columns }: { rows: SqlRows; columns: string[] }) {
  const numeric = columns.find(c => rows.some(r => typeof r[c] === "number"));
  const label = columns.find(c => c !== numeric);
  if (!numeric || !label) return null;
  const data = rows.slice(0, 12), max = Math.max(1, ...data.map(r => Math.abs(Number(r[numeric]) || 0)));
  return <figure className="sql-chart"><figcaption>Ink totals · {numeric}</figcaption><svg viewBox={`0 0 520 ${data.length * 27 + 24}`} role="img" aria-label={`${numeric} by ${label}`}>
    <title>{data.map(r => `${r[label]}: ${r[numeric]}`).join(", ")}</title>
    <path d={`M140 8V${data.length * 27 + 8}`} fill="none" stroke="currentColor" />
    {data.map((r, i) => <g key={i}><text x="132" y={i * 27 + 24} textAnchor="end" fill="currentColor">{String(r[label]).slice(0, 18)}</text><path d={`M145 ${i * 27 + 18}h${Math.abs(Number(r[numeric]) || 0) / max * 290}`} fill="none" stroke="#b9563d" strokeWidth="8" strokeLinecap="round"/><text x="451" y={i * 27 + 24} fill="currentColor">{r[numeric]}</text></g>)}
  </svg></figure>;
}
export function SqlDesk({ dataset }: { dataset: SqlDataset }) {
  const [sql, setSql] = useState<string>(SAVED_SQL[0].sql);
  const [rows, setRows] = useState<SqlRows>(() => savedRows(dataset, "notes"));
  const [columns, setColumns] = useState(["month", "notes"]);
  const [state, setState] = useState<"closed" | "loading" | "ready" | "running">("closed");
  const [message, setMessage] = useState("Precomputed receipt · open DuckDB to write your own query.");
  const [error, setError] = useState("");
  const engine = useRef<Engine | null>(null), abort = useRef<AbortController | null>(null);
  useEffect(() => () => { abort.current?.abort(); engine.current?.dispose(); }, []);
  const open = async () => {
    abort.current?.abort(); engine.current?.dispose(); engine.current = null;
    const controller = new AbortController(); abort.current = controller;
    setState("loading"); setError(""); setMessage("Unpacking the local DuckDB worker…");
    try {
      const { openSqlDesk } = await import("@/lib/sql-browser");
      const session = await openSqlDesk(controller.signal);
      if (controller.signal.aborted) { session.dispose(); return; }
      engine.current = session; setState("ready"); setMessage("DuckDB ready · public tables loaded · Ctrl/⌘ + Enter to run.");
    } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : String(e)); setState("closed"); setMessage("The precomputed receipts are still available."); } }
  };
  const run = async (query = sql) => {
    if (!engine.current || state !== "ready") return;
    setState("running"); setError(""); setMessage("Writing the receipt…");
    try {
      const result = await engine.current.query(query);
      if (abort.current?.signal.aborted) return;
      setRows(result.rows); setColumns(result.columns); setMessage(`DuckDB receipt · ${result.rows.length} rows · ${Math.round(result.ms)} ms${result.truncated ? " · display capped at 200 rows / 20 columns" : ""}`);
    } catch (e) { if (!abort.current?.signal.aborted) { setError(e instanceof Error ? e.message : String(e)); setMessage(engine.current?.closed ? "Worker released. Reopen DuckDB to try another query." : "The query needs another look. Your last receipt is kept below."); } }
    finally { if (!abort.current?.signal.aborted) setState(engine.current?.closed ? "closed" : "ready"); }
  };
  return <section className="sql-desk" aria-label="SQL desk" data-sql-state={state}>
    <header className="sql-topline"><span>OT / PUBLIC ACCOUNTS</span><span>FOLIO 02d</span></header>
    <div className="sql-intro"><h2>The books are open.</h2><span className="sql-stamp">{rows.length} ROWS<br />ACCOUNTED FOR</span></div>
    <div className="sql-schema"><strong>Tables</strong>{Object.entries(SQL_TABLES).map(([name, fields]) => <details key={name}><summary>{name} <span>({dataset.tables[name as keyof typeof SQL_TABLES].length})</span></summary><code>{fields}</code></details>)}</div>
    <p className="sql-provenance">Public snapshot {dataset.revision.slice(0, 10)} · <a href="/ledger-sql.json" download>JSON</a>. Projects and songs are the curated public lists. Listening events have no public export, so <code>music_plays</code> is empty.</p>
    <div className="sql-saved" aria-label="Saved queries">{SAVED_SQL.map(q => <div key={q.id}><button type="button" disabled={state === "running" || state === "loading"} onClick={() => {
      setSql(q.sql); setError("");
      if (state === "ready") void run(q.sql);
      else { const next = savedRows(dataset, q.id); setRows(next); setColumns(Object.keys(next[0] ?? {})); setMessage("Precomputed receipt · open DuckDB to run this SQL yourself."); }
    }}>{q.label}</button><noscript><pre>{q.sql}</pre></noscript></div>)}</div>
    <form onSubmit={e => { e.preventDefault(); void run(); }}>
      <label htmlFor="ink-sql">Write a query</label>
      <textarea id="ink-sql" value={sql} onChange={e => setSql(e.target.value)} rows={4} spellCheck={false} maxLength={8000} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void run(); } }} />
      <div className="sql-commandline"><button className="btn" type="button" disabled={state === "loading" || state === "running"} onClick={() => void open()}>{state === "loading" ? "Opening DuckDB…" : state === "closed" ? "Open DuckDB" : "Reopen DuckDB"}</button><button className="btn" type="submit" disabled={state !== "ready"}>Run SQL ↵</button>{state === "running" && <button className="btn" type="button" onClick={() => { abort.current?.abort(); engine.current?.dispose(); setState("closed"); setMessage("Query cancelled. Reopen DuckDB when you're ready."); }}>Cancel query</button>}</div>
    </form>
    <p className="sql-status" role="status">{message}</p>{error && <p className="sql-error" role="alert">{error}</p>}
    <ResultSheet rows={rows} columns={columns} />
    <InkChart rows={rows} columns={columns} />
    <footer>Read-only · 6 second query limit · up to 200 rows · files and network access closed · WASM loads only when you open the desk.</footer>
  </section>;
}
