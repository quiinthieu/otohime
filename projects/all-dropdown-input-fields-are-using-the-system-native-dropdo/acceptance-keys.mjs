// pm-198 acceptance: keys pressed inside the open /vinyl Genre picker, with a record on the platter.
import { createRequire } from "node:module";
const require = createRequire((process.env.PW_PREFIX || "/tmp/acc198/pw") + "/");
const { chromium } = require("playwright");
const b = await chromium.launch(); console.log("chromium", b.version()); const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
await p.goto("https://otohime.dev/vinyl", { waitUntil: "networkidle" });
const s = p.locator(".crate-filters select");
const phase = () => p.locator(".deck").getAttribute("data-phase");
const st = async (l) => console.log(l, await s.evaluate((x) => ({ open: x.matches(":open"), v: x.value, focus: document.activeElement.tagName + ":" + document.activeElement.textContent.slice(0,12) })), "deck=", await phase());
console.log("deck at start", await phase());
// put a record on the platter with the sleeve's Place button
await p.locator("button.place").first().click(); await p.waitForTimeout(1500);
await st("after placing a record");
await s.click(); await st("open picker");
await p.keyboard.press("Escape"); await p.waitForTimeout(800); await st("Escape in picker");
await p.keyboard.press("Escape"); await p.waitForTimeout(800); await st("Escape again");
// Space selecting an option
await p.locator("button.place").first().click(); await p.waitForTimeout(1500);
await s.click(); await p.keyboard.press("ArrowDown"); await st("open + ArrowDown");
await p.keyboard.press(" "); await p.waitForTimeout(800); await st("Space on option");
await p.keyboard.press("ArrowRight"); await p.waitForTimeout(800); await st("ArrowRight on option");
await p.screenshot({ path: `${process.env.ARTIFACTS_DIR || "/tmp"}/escape-stuck-vinyl.png` });
// Tab out closes?
await p.keyboard.press("Enter"); await st("Enter on option");
await b.close();
