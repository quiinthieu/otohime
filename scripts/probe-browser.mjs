// The browser for scripts/probe-motion-signed-in.mjs and scripts/probe-end.mjs.
//
// In CI the runner's Google Chrome is driven by the repo's locked playwright-core (channel "chrome", as e2e/
// does), so nothing is installed at run time: no npm registry, no Playwright CDN, no apt-get. A PW_PREFIX set by
// the .sh wrapper (local runs, or a runner without google-chrome) wins: require("playwright") from that prefix
// and its Chromium headless shell, the probes' original behaviour. With PW_PREFIX unset and Chrome absent there
// is no browser, and the error says why for both.
import { createRequire } from "node:module";
import path from "node:path";

const repoRequire = createRequire(import.meta.url);

// load(name, prefix): the module `name` from `prefix`'s node_modules, or from the repo's when prefix is "".
function defaultLoad(name, prefix) {
  return prefix ? createRequire(path.join(prefix, "package.json"))(name) : repoRequire(name);
}

const firstLine = (err) => String(err?.message ?? err).split("\n")[0];

async function fromPrefix(load, prefix, options) {
  try {
    const { chromium } = load("playwright", prefix);
    return { browser: await chromium.launch(options), via: `playwright from PW_PREFIX ${prefix}` };
  } catch (err) {
    throw new Error(`probe-browser: no browser. PW_PREFIX=${prefix} is set, but its playwright did not launch Chromium (${firstLine(err)}).`);
  }
}

export async function launchBrowser({ env = process.env, load = defaultLoad, log = console.log, options = {} } = {}) {
  const prefix = env.PW_PREFIX || "";
  let launched;
  if (prefix) {
    launched = await fromPrefix(load, prefix, options);
  } else {
    try {
      const { chromium } = load("playwright-core", "");
      launched = { browser: await chromium.launch({ ...options, channel: "chrome" }), via: "playwright-core, channel chrome" };
    } catch (chrome) {
      throw new Error(
        `probe-browser: no browser. The repo's playwright-core could not launch Chrome (${firstLine(chrome)}), ` +
          `and PW_PREFIX is not set, so there is no Playwright Chromium to fall back to. ` +
          `Install Google Chrome, or run through the probe's .sh script, which installs Playwright into PW_PREFIX.`,
      );
    }
  }
  log(`# browser: ${launched.browser.version()} via ${launched.via}`);
  return launched.browser;
}
