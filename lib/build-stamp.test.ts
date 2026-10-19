import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("test scripts strip types so Node 22.12 can run the .ts tests", () => {
  const { scripts } = JSON.parse(read("package.json"));
  for (const name of ["test", "test:e2e"]) {
    const cmd: string = scripts[name];
    assert.ok(cmd.includes("--experimental-strip-types"), `${name} lacks --experimental-strip-types`);
    assert.ok(cmd.includes("--disable-warning=ExperimentalWarning"), `${name} lacks ExperimentalWarning`);
    assert.ok(cmd.includes("--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"), `${name} lost MODULE_TYPELESS_PACKAGE_JSON`);
    assert.ok(cmd.indexOf("--experimental-strip-types") < cmd.indexOf("--test "), `${name} flags must precede --test`);
  }
});

test("BUILD_SHA prefers GITHUB_SHA, then VERCEL_GIT_COMMIT_SHA, then dev", () => {
  const config = read("next.config.ts");
  assert.match(
    config,
    /BUILD_SHA:\s*process\.env\.GITHUB_SHA\s*\?\?\s*process\.env\.VERCEL_GIT_COMMIT_SHA\s*\?\?\s*"dev"/,
  );
});

test("the site root layout publishes BUILD_SHA as <meta name=build-sha>", () => {
  const layout = read("app/(site)/layout.tsx");
  assert.match(layout, /other:\s*\{\s*"build-sha":\s*process\.env\.BUILD_SHA\s*\?\?\s*"dev"\s*\}/);
});

test("Shore's root layout publishes BUILD_SHA as <meta name=build-sha> too", () => {
  const layout = read("app/(shore)/layout.tsx");
  assert.match(layout, /other:\s*\{\s*"build-sha":\s*process\.env\.BUILD_SHA\s*\?\?\s*"dev"\s*\}/);
});

test("Capsule's root layout publishes BUILD_SHA as <meta name=build-sha> too", () => {
  const layout = read("app/(capsule)/layout.tsx");
  assert.match(layout, /other:\s*\{\s*"build-sha":\s*process\.env\.BUILD_SHA\s*\?\?\s*"dev"\s*\}/);
});

test("Sun's root layout publishes BUILD_SHA as <meta name=build-sha> too", () => {
  const layout = read("app/(sun)/layout.tsx");
  assert.match(layout, /other:\s*\{\s*"build-sha":\s*process\.env\.BUILD_SHA\s*\?\?\s*"dev"\s*\}/);
});

test("Elements' root layout publishes BUILD_SHA as <meta name=build-sha> too", () => {
  const layout = read("app/(elements)/layout.tsx");
  assert.match(layout, /other:\s*\{\s*"build-sha":\s*process\.env\.BUILD_SHA\s*\?\?\s*"dev"\s*\}/);
});

test("the README documents the build stamp and the owner-author deploy rule", () => {
  const readme = read("README.md");
  assert.ok(readme.includes('<meta name="build-sha">'));
  assert.match(readme, /authored by the site owner's GitHub email/);
});
