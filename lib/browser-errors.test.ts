import assert from "node:assert/strict";
import { test } from "node:test";
import { collectBrowserErrors, type ConsoleError, type ResourceResponse } from "../e2e/console-errors.ts";

test("expected validation console errors require matching response evidence, one for one", () => {
  const origin = "https://test.example";
  const response: ResourceResponse = { url: `${origin}/api/inkblot/answers`, method: "POST", status: 400, resourceType: "fetch" };
  const message: ConsoleError = { url: response.url, args: 0, line: 0, column: 0, text: "Failed to load resource: the server responded with a status of 400 (Bad Request)" };
  for (const reverse of [false, true]) {
    const errors = collectBrowserErrors(origin, [response]);
    if (reverse) errors.response(response);
    errors.console(message);
    if (!reverse) {
      assert.deepEqual(errors.unexpected, [message.text], "no response cannot earn an exemption");
      errors.response(response);
    }
    assert.deepEqual(errors.unexpected, []);
    errors.console(message);
    assert.deepEqual(errors.unexpected, [message.text], "one response cannot exempt two console errors");
    assert.deepEqual(errors.unexpected, [message.text], "reading diagnostics does not consume evidence");
  }
  for (const change of [{ url: `${response.url}?other=1` }, { method: "GET" }, { status: 500 }, { resourceType: "document" }]) {
    const errors = collectBrowserErrors(origin, [response]);
    errors.response({ ...response, ...change }); errors.console(message);
    assert.deepEqual(errors.unexpected, [message.text]);
  }
  for (const change of [{ url: `${origin}/api/other` }, { args: 1 }, { line: 1 }, { column: 1 }, { text: "application exception" }]) {
    const errors = collectBrowserErrors(origin, [response]);
    errors.response(response); errors.console({ ...message, ...change });
    assert.equal(errors.unexpected.length, 1);
  }
  const ordinary = collectBrowserErrors(origin);
  ordinary.response(response); ordinary.console(message);
  assert.deepEqual(ordinary.unexpected, [message.text], "validation errors are unexpected unless explicitly declared");
  for (const reason of ["Not Found", ""]) {
    const ghosts = collectBrowserErrors(origin);
    const url = `${origin}/api/ghosts`;
    ghosts.console({ ...message, url, text: `Failed to load resource: the server responded with a status of 404 (${reason})` });
    ghosts.response({ url, status: 404, method: "GET", resourceType: "fetch" });
    assert.deepEqual(ghosts.unexpected, [], "the existing disabled-ghosts rule still works");
  }
  const exception = collectBrowserErrors(origin, [response]);
  exception.response(response); exception.pageError(message.text);
  assert.deepEqual(exception.unexpected, [message.text], "a page exception never earns an exemption");
});
