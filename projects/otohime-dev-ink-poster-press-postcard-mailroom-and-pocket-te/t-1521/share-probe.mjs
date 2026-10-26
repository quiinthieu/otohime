// t-1521 evidence probe. Run against `next start`; Playwright 1.64.0 was installed to /tmp/pw (npm i --prefix /tmp/pw playwright@1.64.0).
import { chromium } from "/tmp/pw/node_modules/playwright/index.mjs";
const BASE = process.argv[2];
const browser = await chromium.launch(); const context = await browser.newContext(); const page = await context.newPage();
await page.addInitScript(() => { navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
await page.goto(`${BASE}/postcard?s=cup`); await page.waitForLoadState("networkidle");
await page.waitForFunction(() => document.querySelectorAll('input[name="sketch"][value="cup"]').length === 1);
await page.getByLabel("A short note").fill("Tea?");
await page.getByRole("button", { name: "Stamp it" }).click();
await page.getByRole("button", { name: "Share link" }).click();
await page.getByRole("status").filter({ hasText: "Sent." }).waitFor({ timeout: 5000 });
const shared = await page.evaluate(() => window.__shared);
const ok = shared.url.startsWith(`${BASE}/postcard/view?c=`) && shared.text === "Tea?" && shared.title === "A postcard from otohime.dev";
console.log(`${ok ? "ok" : "not ok"} - navigator.share gets the view link, note and title`, JSON.stringify(shared).slice(0, 140));
await browser.close(); process.exit(ok ? 0 : 1);
