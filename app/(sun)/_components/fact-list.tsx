import { SOURCES, type Fact } from "../_lib/sun.ts";

// One fact list for the stage panel and the chapter sections, so both read the same.
export function FactList({ facts }: { facts: readonly Fact[] }) {
  return (
    <ul className="facts-list">
      {facts.map((f) => (
        <li key={f.label}>
          <span className="fact-label">{f.label}</span>
          <span className="fact-value">{f.value}</span>{" "}
          <a className="fact-source" href={SOURCES[f.source].url} rel="noreferrer">
            {SOURCES[f.source].name}
          </a>
        </li>
      ))}
    </ul>
  );
}
