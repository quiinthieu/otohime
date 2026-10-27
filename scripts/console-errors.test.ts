import assert from "node:assert/strict";
import { test } from "node:test";
import { collectBrowserErrors, type ConsoleError, type ResourceResponse } from "../e2e/console-errors.ts";

const origin = "http://localhost:4000";
const response: ResourceResponse = { url: `${origin}/api/ghosts`, status: 404, method: "GET", resourceType: "fetch" };
const resource: ConsoleError = { text: "Failed to load resource: the server responded with a status of 404 (Not Found)", url: response.url, line: 0, column: 0, args: 0 };

test("only a matching disabled config response and native resource error reconcile, in either order", () => {
  for (const responseFirst of [true, false]) {
    const errors = collectBrowserErrors(origin);
    if (responseFirst) errors.response(response);
    errors.console(resource);
    if (!responseFirst) errors.response(response);
    assert.deepEqual(errors.unexpected, []);
    errors.console(resource);
    assert.deepEqual(errors.unexpected, [resource.text], "each response covers exactly one resource event");
  }
});

test("unrelated resources, queries, cross-origin URLs, 500s and absent responses stay failures", () => {
  for (const patch of [
    { url: `${origin}/missing.png` }, { url: `${origin}/api/ghosts?unexpected=1` },
    { url: "http://other.example/api/ghosts" }, { status: 500 }, { method: "POST" }, { resourceType: "document" },
  ]) {
    const errors = collectBrowserErrors(origin);
    const observed = { ...response, ...patch };
    errors.response(observed);
    errors.console({ ...resource, url: observed.url });
    assert.equal(errors.unexpected.length, 1, JSON.stringify(patch));
  }
  const errors = collectBrowserErrors(origin);
  errors.console(resource);
  assert.deepEqual(errors.unexpected, [resource.text]);
});

test("ordinary console.error, resource-like application errors and pageerror always fail", () => {
  for (const patch of [{ text: "application exploded" }, { args: 1 }, { line: 12 }, { column: 4 },
    { text: "Failed to load resource: the server responded with a status of 500 (Internal Server Error)" }]) {
    const errors = collectBrowserErrors(origin);
    errors.response(response);
    errors.console({ ...resource, ...patch });
    assert.equal(errors.unexpected.length, 1, JSON.stringify(patch));
  }
  const errors = collectBrowserErrors(origin);
  errors.response(response);
  errors.pageError(resource.text);
  assert.deepEqual(errors.unexpected, [resource.text]);
});
