// t-1521 evidence probe. Run against `next start`; Playwright 1.64.0 was installed to /tmp/pw (npm i --prefix /tmp/pw playwright@1.64.0).
// Drive /postcard in Chromium: pick, write, stamp, download, share (clipboard granted and denied), open.
import { chromium } from "/tmp/pw/node_modules/playwright/index.mjs";
const BASE = process.argv[2];
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "ok" : "not ok"} - ${name}${detail ? ` (${detail})` : ""}`); };
const browser = await chromium.launch();
for (const clipboard of [true, false]) {
  const context = await browser.newContext({ acceptDownloads: true, permissions: clipboard ? ["clipboard-read", "clipboard-write"] : [] });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/postcard?s=key`);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.querySelectorAll('input[name="sketch"][value="key"]').length === 1);
  check(`?s=key preselects Key [clipboard=${clipboard}]`, await page.locator('input[name="sketch"][value="key"]').isChecked());
  await page.getByText("Glasses", { exact: true }).click();
  check("clicking a sheet picks it", await page.locator('input[name="sketch"][value="glasses"]').isChecked());
  await page.keyboard.press("ArrowRight");
  check("arrow keys move the pick", await page.locator('input[name="sketch"][value="flower"]').isChecked());
  const note = page.getByLabel("A short note");
  await note.fill("Line one\nline two " + "x".repeat(150));
  check("over-long note warns", /over; the postcard keeps the first 140/.test(await page.locator(".field-error").innerText()));
  await note.fill("Line one\nline two <i>hi</i>");
  await page.getByRole("button", { name: "Stamp it" }).click();
  const img = page.locator('img[alt="A postcard of the Jam jar sketch"]');
  await img.waitFor();
  await page.waitForFunction((el) => el.complete && el.naturalWidth > 0, await img.elementHandle());
  check("preview PNG loads at 1200 wide", (await img.evaluate((el) => el.naturalWidth)) === 1200);
  const link = page.getByRole("link", { name: "Download PNG" });
  check("download link names the file", /^postcard-flower-\d{4}-\d{2}-\d{2}\.png$/.test((await link.getAttribute("download")) ?? ""));
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path);
  check("download is a 1200x630 PNG", bytes.subarray(1, 4).toString() === "PNG" && bytes.readUInt32BE(16) === 1200 && bytes.readUInt32BE(20) === 630);
  check("navigator.share is absent in headless Chromium", !(await page.evaluate(() => typeof navigator.share === "function")));
  await page.getByRole("button", { name: "Share link" }).click();
  if (clipboard) {
    await page.getByRole("status").filter({ hasText: "Link copied." }).waitFor({ timeout: 5000 });
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    check("Share copies the view link", copied.startsWith(`${BASE}/postcard/view?c=`), copied.slice(0, 60));
  } else {
    await page.getByRole("status").filter({ hasText: "Copy the link below." }).waitFor({ timeout: 5000 });
    const value = await page.getByLabel("Postcard link").inputValue();
    check("no clipboard: the link is shown to copy", value.startsWith(`${BASE}/postcard/view?c=`));
  }
  await page.getByRole("link", { name: "Open it" }).click();
  await page.waitForURL(/\/postcard\/view\?c=/);
  await page.getByRole("heading", { name: "A postcard: Jam jar" }).waitFor();
  check("the view shows the note as text, line break flattened", (await page.locator("article").innerText()).includes("Line one line two <i>hi</i>"));
  check("no page errors", errors.length === 0, errors.join("; "));
  await context.close();
}
await browser.close();
console.log(`# pass ${results.filter(Boolean).length} fail ${results.filter((r) => !r).length}`);
process.exit(results.every(Boolean) ? 0 : 1);
