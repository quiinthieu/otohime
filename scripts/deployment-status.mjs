// DeploymentStatus port: authenticate a team-scoped deployment and wait for READY.
// Node's built-in fetch is the real adapter; the only alternate origin is loopback for HTTP fixtures.
import { setTimeout as delay } from "node:timers/promises";
import { existsSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * @param {{hostname: string, token: string, teamId: string, projectId: string,
 * apiOrigin?: string, timeoutMs?: number, requestMs?: number, pollMs?: number,
 * onState?: (receipt: {id: string, url: string, ownerId: string, projectId: string, readyState: string}) => void}} options
 */
export async function waitForDeployment({ hostname, token, teamId, projectId, apiOrigin = "https://api.vercel.com", timeoutMs = 420_000, requestMs = 60_000, pollMs = 2000, onState = () => {} }) {
  const validId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  if (!token || !validId(teamId) || !validId(projectId)) throw new Error("deployment_status: token, team and project are required");
  if (!/^[A-Za-z0-9-]+\.vercel\.app$/.test(hostname)) throw new Error("deployment_status: invalid deployment hostname");
  for (const value of [timeoutMs, requestMs, pollMs]) if (!Number.isFinite(value) || value <= 0) throw new Error("deployment_status: invalid time bound");
  const origin = new URL(apiOrigin);
  if ((origin.origin !== "https://api.vercel.com" && !(origin.protocol === "http:" && origin.hostname === "127.0.0.1")) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("deployment_status: invalid API origin");
  const endpoint = new URL(`/v13/deployments/${hostname}`, origin.origin);
  endpoint.searchParams.set("teamId", teamId);
  const deadline = performance.now() + timeoutMs;
  let lastState = "unknown";
  while (performance.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(requestMs, deadline - performance.now())));
    let body;
    try {
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: controller.signal });
      if (response.status !== 200) { await response.body?.cancel(); throw new Error(`deployment_status: HTTP ${response.status}`); }
      let text = "";
      const decoder = new TextDecoder();
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 1_048_576) { controller.abort(); throw new Error("deployment_status: oversized response"); }
        text += decoder.decode(chunk, { stream: true });
      }
      try { body = JSON.parse(text + decoder.decode()); }
      catch { throw new Error("deployment_status: malformed JSON"); }
    } catch (error) {
      // Preserve our bounded failure class even when its cleanup aborted the response.
      // Never echo fetch errors, vendor response bodies, headers or bearer values.
      if (/^deployment_status: /.test(error.message)) throw error;
      if (controller.signal.aborted) throw new Error(`deployment_status: timeout; last state ${lastState}`);
      throw new Error("deployment_status: request failed");
    } finally { clearTimeout(timer); }
    if (!body || body.url !== hostname || body.ownerId !== teamId || body.projectId !== projectId || body.target !== "production" || !validId(body.id) || !body.id.startsWith("dpl_")) throw new Error("deployment_status: deployment association mismatch");
    if (!["READY", "ERROR", "CANCELED", "QUEUED", "INITIALIZING", "BUILDING"].includes(body.readyState)) throw new Error("deployment_status: unknown state");
    lastState = body.readyState;
    const receipt = { id: body.id, url: hostname, ownerId: teamId, projectId, target: "production", readyState: lastState };
    onState(receipt);
    if (lastState === "READY") return receipt;
    if (["ERROR", "CANCELED"].includes(lastState)) throw new Error(`deployment_status: terminal ${lastState}`);
    await delay(Math.min(pollMs, Math.max(1, deadline - performance.now())));
  }
  throw new Error(`deployment_status: timeout; last state ${lastState}`);
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const deployment = new URL(process.argv[2]);
    if (deployment.protocol !== "https:" || deployment.username || deployment.password || deployment.port || deployment.pathname !== "/" || deployment.search || deployment.hash) throw new Error("deployment_status: invalid deployment URL");
    const hostname = deployment.hostname;
    await waitForDeployment({ hostname, token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_ORG_ID, projectId: process.env.VERCEL_PROJECT_ID,
      apiOrigin: process.env.VERCEL_API_URL, timeoutMs: Number(process.env.READY_TIMEOUT || 420) * 1000,
      requestMs: Number(process.env.INSPECT_TIMEOUT || 60) * 1000, pollMs: Number(process.env.STATUS_POLL_DELAY || 2) * 1000,
      onState: (receipt) => console.log(JSON.stringify(receipt)),
    });
  } catch (error) {
    console.error(error.message.startsWith("deployment_status:") ? error.message : "deployment_status: invalid configuration");
    process.exitCode = 1;
  }
}
