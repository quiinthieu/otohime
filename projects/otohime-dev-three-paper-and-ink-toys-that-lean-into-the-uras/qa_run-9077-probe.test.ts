import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright-core";

test("independent consent and denied-permission user path", async () => {
  const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const requests: string[] = [];
    context.on("request", request => requests.push(request.url()));
    await context.addInitScript(() => {
      (window as unknown as { cameraRequests: MediaStreamConstraints[] }).cameraRequests = [];
      navigator.mediaDevices.getUserMedia = async constraints => {
        (window as unknown as { cameraRequests: MediaStreamConstraints[] }).cameraRequests.push(constraints!);
        throw new DOMException("denied for QA", "NotAllowedError");
      };
    });
    const page = await context.newPage();
    const response = await page.goto(`${process.env.BASE_URL}/play`);
    assert.ok(response?.ok());
    const policy = response?.headers()["permissions-policy"] ?? "";
    assert.match(policy, /camera=\(self\)/);
    assert.match(policy, /microphone=\(\)/);
    const box = page.locator("[data-peep]");
    await box.getByRole("button", { name: "Look inside", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("[data-peep]")?.getAttribute("data-running") === "true");
    assert.equal(await page.evaluate(() => (window as unknown as { cameraRequests: unknown[] }).cameraRequests.length), 0);
    assert.equal(requests.filter(url => /vendor\/peep-box|mediapipe|\.wasm/.test(url)).length, 0);
    await box.getByRole("button", { name: "Use my camera", exact: true }).click();
    await box.getByRole("status").filter({ hasText: /not allowed/i }).waitFor();
    assert.deepEqual(await page.evaluate(() => (window as unknown as { cameraRequests: MediaStreamConstraints[] }).cameraRequests), [{ audio: false, video: { width: { ideal: 640, max: 640 }, height: { ideal: 480, max: 480 }, facingMode: "user" } }]);
    assert.equal(requests.filter(url => /vendor\/peep-box|mediapipe|\.wasm/.test(url)).length, 0);
    await box.getByRole("button", { name: "Look right", exact: true }).click();
    assert.equal(await box.getAttribute("data-source"), "pointer");
    await context.close();
  } finally {
    await browser.close();
  }
});
