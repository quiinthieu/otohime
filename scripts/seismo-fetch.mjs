// Explicit refresh: npm run seismo:refresh. Offline/rate-limited builds keep the last valid archive.
import { readFile, writeFile, rename } from "node:fs/promises";
import { githubInkEvents } from "../lib/seismograph-source.ts";
import { parseInkEvents } from "../lib/seismograph.ts";
const root = new URL("../content/", import.meta.url);
try {
  const pipelines = JSON.parse(await readFile(new URL("seismo-pipelines.json", root), "utf8"));
  const events = parseInkEvents([...await githubInkEvents(process.env.GITHUB_TOKEN), ...parseInkEvents(pipelines.events)]);
  if (!events.length) throw Error("No valid activity");
  await writeFile(new URL("seismo.json.tmp", root), JSON.stringify({ generated:new Date().toISOString(), events }, null, 2) + "\n");
  await rename(new URL("seismo.json.tmp", root), new URL("seismo.json", root));
  console.log(`Ink archive refreshed: ${events.length} public events`);
} catch { console.error("Ink archive refresh unavailable; retaining the checked-in trace"); process.exitCode = 1; }
