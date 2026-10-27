// A scoped deployment read avoids the CLI's global user lookup for team-only tokens.
// https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url
import { pathToFileURL } from "node:url";
import { existsSync, realpathSync } from "node:fs";
import { waitForDeployment } from "./deployment-status.mjs";

/** @param {string} deploymentUrl @param {Record<string, string | undefined>} env */
export async function verifyDeploymentReady(deploymentUrl, env = process.env) {
  for (const name of ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]) {
    if (!env[name]) throw new Error(`${name} is required for deployment API verification`);
  }
  const deployment = new URL(deploymentUrl);
  if (deployment.protocol !== "https:" || !/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(deployment.hostname)
    || deployment.username || deployment.password || deployment.port || deployment.pathname !== "/" || deployment.search || deployment.hash) {
    throw new Error("invalid uploaded deployment URL");
  }
  const origin = new URL(env.VERCEL_API_ORIGIN || "https://api.vercel.com");
  // Only local HTTP fixtures may replace the vendor origin. Never redirect a bearer token.
  if (!(origin.origin === "https://api.vercel.com" || (origin.protocol === "http:" && origin.hostname === "127.0.0.1"))
    || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("invalid deployment API origin");
  }
  const timeout = Number(env.VERCEL_API_TIMEOUT_MS || 10_000);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 10_000) throw new Error("invalid deployment API timeout");
  const result = await waitForDeployment({ hostname: deployment.hostname, token: env.VERCEL_TOKEN,
    teamId: env.VERCEL_ORG_ID, projectId: env.VERCEL_PROJECT_ID, apiOrigin: origin.origin,
    timeoutMs: timeout, requestMs: timeout,
  });
  return `API deployment Ready ${result.id} ${deployment.hostname}`;
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { console.log(await verifyDeploymentReady(process.argv[2])); }
  catch (error) {
    // Network/vendor diagnostics can echo request data; print only our own bounded reasons.
    const message = error instanceof Error && /^(VERCEL_|invalid |deployment API )/.test(error.message)
      ? error.message : "deployment API request failed or timed out";
    console.error(message);
    process.exitCode = 1;
  }
}
