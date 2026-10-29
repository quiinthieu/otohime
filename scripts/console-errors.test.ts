import assert from "node:assert/strict";
import { test } from "node:test";
import { collectBrowserErrors, type ConsoleError, type ResourceResponse } from "../e2e/console-errors.ts";

const origin = "http://localhost:4000";
const response: ResourceResponse = { url: `${origin}/api/ghosts`, status: 404, method: "GET", resourceType: "fetch" };
const resource: ConsoleError = { text: "Failed to load resource: the server responded with a status of 404 (Not Found)", url: response.url, line: 0, column: 0, args: 0 };
const h2Resource: ConsoleError = { ...resource, text: "Failed to load resource: the server responded with a status of 404 ()" };

test("asserted negative responses cover one native event each without hiding application or unrelated errors", () => {
  const errors = collectBrowserErrors(origin);
  const rejected = { ...response, url: `${origin}/api/inkblot/answers`, method: "POST", status: 400 };
  const native = { ...resource, url: rejected.url, text: "Failed to load resource: the server responded with a status of 400 (Bad Request)" };
  errors.response(rejected);
  errors.console(native);
  assert.deepEqual(errors.unexpected, [native.text], "400s are failures until explicitly asserted");
  errors.expectResourceError(rejected);
  assert.deepEqual(errors.unexpected, []);
  errors.console(native);
  errors.console({ ...native, url: `${origin}/other` });
  errors.console({ ...native, args: 1 });
  errors.pageError(native.text);
  assert.deepEqual(errors.unexpected, Array(4).fill(native.text));
});

test("only a matching disabled config response and native resource error reconcile, in either order", () => {
  for (const candidate of [resource, h2Resource]) {
    for (const responseFirst of [true, false]) {
      const errors = collectBrowserErrors(origin);
      if (responseFirst) errors.response(response);
      errors.console(candidate);
      if (!responseFirst) errors.response(response);
      assert.deepEqual(errors.unexpected, []);
      errors.console(candidate);
      assert.deepEqual(errors.unexpected, [candidate.text], "each response covers exactly one resource event");
    }
  }
});

test("unrelated resources, queries, cross-origin URLs, 500s and absent responses stay failures", () => {
  for (const candidate of [resource, h2Resource]) {
    for (const patch of [
      { url: `${origin}/missing.png` }, { url: `${origin}/api/ghosts?unexpected=1` },
      { url: "http://other.example/api/ghosts" }, { status: 500 }, { method: "POST" }, { resourceType: "document" },
    ]) {
      const errors = collectBrowserErrors(origin);
      const observed = { ...response, ...patch };
      errors.response(observed);
      errors.console({ ...candidate, url: observed.url });
      assert.equal(errors.unexpected.length, 1, JSON.stringify(patch));
    }
    const errors = collectBrowserErrors(origin);
    errors.console(candidate);
    assert.deepEqual(errors.unexpected, [candidate.text]);
  }
});

test("ordinary console.error, resource-like application errors and pageerror always fail", () => {
  for (const candidate of [resource, h2Resource]) {
    for (const patch of [{ text: "application exploded" }, { args: 1 }, { line: 12 }, { column: 4 },
      { text: "Failed to load resource: the server responded with a status of 500 (Internal Server Error)" }]) {
      const errors = collectBrowserErrors(origin);
      errors.response(response);
      errors.console({ ...candidate, ...patch });
      assert.equal(errors.unexpected.length, 1, JSON.stringify(patch));
    }
    const errors = collectBrowserErrors(origin);
    errors.response(response);
    errors.pageError(candidate.text);
    assert.deepEqual(errors.unexpected, [candidate.text]);
  }
});
