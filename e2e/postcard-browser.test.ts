// The mailroom as a visitor uses it, including PNG bytes and the browser sharing fallbacks.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { chromium, type Browser, type Page } from "playwright-core";
import sharp from "sharp";
import { decodePostcard, NOTE_MAX, POSTCARD_SKETCHES } from "../lib/postcard.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
let shortTmp = "";

before(async () => {
  const env = tmpdir().length > 60
    ? { ...process.env, TMPDIR: (shortTmp = mkdtempSync("/tmp/pc-e2e-")) }
    : process.env;
  if (process.env.CHROME_PATH) {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, env });
    return;
  }
  try {
    browser = await chromium.launch({ channel: "chrome", env });
  } catch {
    browser = await chromium.launch({ env });
  }
});

after(async () => {
  await browser?.close();
  if (shortTmp) rmSync(shortTmp, { recursive: true, force: true });
});

async function stamp(page: Page, note: string) {
  await page.getByRole("textbox", { name: "A short note" }).fill(note);
  await page.getByRole("button", { name: "Stamp it", exact: true }).click();
  const view = await page.getByRole("link", { name: "Open it", exact: true }).getAttribute("href");
  assert.ok(view);
  const code = new URL(view, BASE).searchParams.get("c");
  const postcard = decodePostcard(code);
  assert.ok(postcard, "the UI creates a valid postcard link");
  return { view, postcard };
}

for (const width of [1280, 390]) {
  test(`mailroom at ${width}px: sketch link, stamp, PNG download, shared view, edit invalidation`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 860 }, acceptDownloads: true });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${BASE}/sketches`, { waitUntil: "networkidle" });
      for (const sheet of POSTCARD_SKETCHES) {
        assert.equal(await page.getByRole("link", { name: `Send ${sheet.title} as a postcard`, exact: true }).getAttribute("href"), `/postcard?s=${sheet.id}`);
      }
      await page.getByRole("link", { name: "Send Cup as a postcard", exact: true }).click();
      await page.waitForURL(`${BASE}/postcard?s=cup`);
      assert.equal(await page.locator("input[name=sketch][value=cup]").isChecked(), true);
      const note = "Wish you were here. <script>ink</script> 🌊";
      const { view, postcard } = await stamp(page, note);
      assert.equal(postcard.sketch, "cup");
      assert.equal(postcard.note, note);
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("link", { name: "Download PNG", exact: true }).click(),
      ]);
      assert.equal(await download.failure(), null);
      assert.match(download.suggestedFilename(), /^postcard-cup-\d{4}-\d{2}-\d{2}\.png$/);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1200, 630]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

      await page.getByRole("textbox", { name: "A short note" }).fill("An edited note");
      assert.equal(await page.getByRole("link", { name: "Download PNG", exact: true }).count(), 0, "editing removes the stale stamped card");
      const long = await stamp(page, "🌊".repeat(NOTE_MAX + 1));
      assert.equal(Array.from(long.postcard.note).length, NOTE_MAX);
      const unbroken = "W".repeat(NOTE_MAX);
      const longWord = await stamp(page, unbroken);
      const imageUrl = await page.getByRole("link", { name: "Download PNG", exact: true }).getAttribute("href");
      const imageResponse = await page.request.get(new URL(imageUrl!, BASE).href);
      assert.equal(imageResponse.status(), 200);
      // The paper's right margin stays blank: an unwrapped note used to run through the frame and off the PNG.
      const margin = await sharp(await imageResponse.body()).extract({ left: 1182, top: 240, width: 18, height: 260 }).removeAlpha().raw().toBuffer();
      let escapedInk = 0;
      for (let i = 0; i < margin.length; i += 3) {
        if (margin[i] < 150 && margin[i + 1] < 150 && margin[i + 2] < 150) escapedInk++;
      }
      assert.equal(escapedInk, 0, "the note stays inside the exported postcard");
      for (const note of ["W".repeat(90), "🌊".repeat(60)]) {
        const { view: boundedView } = await stamp(page, note);
        const image = new URL(boundedView, BASE);
        image.pathname = "/postcard/image";
        const response = await page.request.get(image.href);
        assert.equal(response.status(), 200);
        // A gap above the sign-off rule: even wide glyphs must leave the footer clear.
        const gap = await sharp(await response.body()).extract({ left: 710, top: 501, width: 400, height: 8 }).removeAlpha().raw().toBuffer();
        let footerInk = 0;
        for (let i = 0; i < gap.length; i += 3) {
          if (Math.abs(gap[i] - 250) + Math.abs(gap[i + 1] - 248) + Math.abs(gap[i + 2] - 243) > 80) footerInk++;
        }
        assert.equal(footerInk, 0, "the note leaves room for the postcard sign-off");
      }
      await page.goto(new URL(longWord.view, BASE).href, { waitUntil: "networkidle" });
      assert.equal(await page.getByText(unbroken, { exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "an unbroken note fits the viewport");
      await page.goto(new URL(view, BASE).href, { waitUntil: "networkidle" });
      assert.equal(await page.getByRole("heading", { name: "A postcard: Cup", exact: true }).count(), 1);
      assert.equal(await page.getByText(note, { exact: true }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
}

test("native sharing, clipboard fallback, manual copy and cancellation keep the postcard usable", async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${BASE}/postcard`, { waitUntil: "networkidle" });
    const { view } = await stamp(page, "A note from the mailroom");
    const share = page.getByRole("button", { name: "Share link", exact: true });
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
        document.documentElement.dataset.shared = JSON.stringify(data);
      } });
    });
    await share.click();
    await page.getByRole("status").filter({ hasText: "Sent." }).waitFor();
    const native = JSON.parse((await page.getAttribute("html", "data-shared"))!);
    assert.equal(native.url, new URL(view, BASE).href);

    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: async () => {
        throw new DOMException("Not supported", "NotAllowedError");
      } });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (url: string) => {
        document.documentElement.dataset.copied = url;
      } } });
    });
    await share.click();
    await page.getByRole("status").filter({ hasText: "Link copied." }).waitFor();
    assert.equal(await page.getAttribute("html", "data-copied"), new URL(view, BASE).href);

    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await share.click();
    const manual = page.getByRole("textbox", { name: "Postcard link", exact: true });
    assert.equal(await manual.inputValue(), new URL(view, BASE).href);
    await stamp(page, "Cancel this share");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      } });
    });
    await share.click();
    assert.equal(await manual.count(), 0, "cancelling the native sheet does not open the fallback");
    await page.getByRole("status").filter({ hasText: "Stamped." }).waitFor();
  } finally {
    await context.close();
  }
});
