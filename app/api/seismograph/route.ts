import { connection } from "next/server";
import snapshot from "@/content/seismo.json";
import pipelines from "@/content/seismo-pipelines.json";
import { parseInkEvents } from "@/lib/seismograph";
import { githubInkEvents } from "@/lib/seismograph-source";
let cached: { at:number; value:Promise<{events:ReturnType<typeof parseInkEvents>; source:string}> } | undefined;
export async function GET() {
  await connection();
  if (!cached || Date.now() - cached.at > 300_000) cached = { at:Date.now(), value:githubInkEvents().then(events => ({ events:parseInkEvents([...events,...pipelines.events]), source:"Public GitHub + exported CI jobs" })).catch(() => ({ events:parseInkEvents(snapshot.events), source:`Saved trace · ${snapshot.generated}` })) };
  return Response.json(await cached.value, { headers:{ "cache-control":"public, max-age=300" } });
}
