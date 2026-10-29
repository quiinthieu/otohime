import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../components/peep-box/peep-box.css", import.meta.url), "utf8");
const tools = css.split(".peep-tools {")[1]?.split("}")[0] ?? "";

function fits(content: number, reserved: number, mode: "fixed" | "min") {
  const client = mode === "fixed" ? reserved : Math.max(reserved, content);
  return content <= client;
}

test("peep tools reserve 460px and grow with their content", () => {
  assert.match(tools, /min-height:\s*460px/);
  assert.doesNotMatch(tools, /(?:^|\s)height:\s*460px/);
  assert.equal(fits(460, 460, "min"), true);
  assert.equal(fits(803, 460, "min"), true);
});

test("a fixed 460px tools box clips enlarged camera controls", () => {
  assert.equal(fits(803, 460, "fixed"), false);
});
