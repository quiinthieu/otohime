import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyDeploymentReady } from "../scripts/vercel-deployment-state.mjs";

test("deployment API configuration refuses credential egress before making a request", async () => {
  const env = { VERCEL_TOKEN: "fixture-token", VERCEL_ORG_ID: "team_fixture", VERCEL_PROJECT_ID: "prj_fixture" };
  const deployment = "https://fixture.vercel.app";
  for (const field of Object.keys(env)) {
    await assert.rejects(verifyDeploymentReady(deployment, { ...env, [field]: "" }), /is required/);
  }
  for (const url of ["http://fixture.vercel.app", "https://fixture.vercel.app.evil.test", "https://user@fixture.vercel.app", "https://fixture.vercel.app:8443", "https://fixture.vercel.app/private", "https://fixture.vercel.app?token=bad"]) {
    await assert.rejects(verifyDeploymentReady(url, env), /invalid uploaded deployment URL/);
  }
  for (const origin of ["https://evil.test", "http://api.vercel.com", "https://user@api.vercel.com", "https://api.vercel.com/private", "https://api.vercel.com?token=bad"]) {
    await assert.rejects(verifyDeploymentReady(deployment, { ...env, VERCEL_API_ORIGIN: origin }), /invalid deployment API origin/);
  }
  for (const timeout of ["0", "-1", "10001", "NaN", "1.5"]) {
    await assert.rejects(verifyDeploymentReady(deployment, { ...env, VERCEL_API_TIMEOUT_MS: timeout }), /invalid deployment API timeout/);
  }
});
