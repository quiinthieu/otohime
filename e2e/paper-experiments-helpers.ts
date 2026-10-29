import { after, before } from "node:test";
import { mkdirSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright-core";
import { collectBrowserErrors } from "./console-errors.ts";

export const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
before(async () => { browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }), args: ["--mute-audio"] }); });
after(async () => { await browser?.close(); });
export async function open(path: string, options: { reduced?: boolean; phone?: boolean; js?: boolean } = {}) {
  const context = await browser.newContext({ viewport: options.phone ? { width: 390, height: 844 } : { width: 1366, height: 900 }, reducedMotion: options.reduced ? "reduce" : "no-preference", javaScriptEnabled: options.js !== false });
  const page = await context.newPage();
  const errors = collectBrowserErrors(BASE);
  page.on("pageerror", e => errors.pageError(e.message));
  page.on("response", r => errors.response({ url: r.url(), status: r.status(), method: r.request().method(), resourceType: r.request().resourceType() }));
  page.on("console", m => { if (m.type() === "error") { const p = m.location(); errors.console({ text: m.text(), url: p.url, line: p.lineNumber, column: p.columnNumber, args: m.args().length }); } });
  await page.goto(BASE + path);
  return { page, context, errors };
}
export async function shot(page: Page, name: string) {
  if (!process.env.EXPERIMENT_SHOTS) return;
  mkdirSync(process.env.EXPERIMENT_SHOTS, { recursive: true });
  await page.screenshot({ path: `${process.env.EXPERIMENT_SHOTS}/${name}.png`, fullPage: true });
}
export const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
