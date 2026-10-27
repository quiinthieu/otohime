import assert from "node:assert/strict";
import { test } from "node:test";
import { createHydrationRegistry } from "./paper-hydration.ts";

test("load, idle and clock advances cannot release overlays before every host commits", () => {
  const registry = createHydrationRegistry();
  const shell = {}, cartridge = {}, line = {};
  let mounts = 0;
  const cancel = registry.wait(() => [shell, cartridge, line], () => { mounts++; });
  registry.changed(); // load/idle alone is not a React acknowledgement
  assert.equal(mounts, 0);
  registry.mark(shell);
  registry.mark(line);
  assert.equal(mounts, 0, "a hydrated footer does not release an unhydrated Daruma subtree");
  registry.mark(cartridge);
  assert.equal(mounts, 1);
  registry.changed();
  assert.equal(mounts, 1, "one-shot activation");
  cancel();
});

test("empty, removed and replaced route hosts never inherit another mount's readiness", () => {
  const registry = createHydrationRegistry();
  const oldHost = {}, replacement = {};
  let hosts: object[] = [];
  let mounts = 0;
  registry.wait(() => hosts, () => { mounts++; });
  registry.changed();
  assert.equal(mounts, 0, "empty streaming content is not ready");
  const unmount = registry.mark(oldHost);
  unmount();
  hosts = [oldHost];
  registry.changed();
  assert.equal(mounts, 0, "cleanup revokes readiness");
  hosts = [replacement];
  registry.mark(oldHost);
  assert.equal(mounts, 0, "a stale route commit cannot release new hosts");
  registry.mark(replacement);
  assert.equal(mounts, 1);
});

test("navigation cancels pending hydration work and already-committed hosts activate immediately", () => {
  const registry = createHydrationRegistry();
  const host = {};
  let mounts = 0;
  const cancel = registry.wait(() => [host], () => { mounts++; });
  cancel();
  registry.mark(host);
  assert.equal(mounts, 0);
  registry.wait(() => [host], () => { mounts++; });
  assert.equal(mounts, 1);
  assert.equal(registry.has({}), false, "server attributes cannot grant readiness to another node");
});

test("cached hidden route hosts do not block the active route, and reactivation needs a new commit", () => {
  const registry = createHydrationRegistry();
  const notes = {}, projects = {};
  const hideNotes = registry.mark(notes);
  hideNotes(); // Next Activity retains DOM but disconnects effects.
  let rendered = [projects];
  let mounts = 0;
  registry.wait(() => rendered, () => { mounts++; });
  registry.mark(projects);
  assert.equal(mounts, 1, "disconnected cached Notes is outside the rendered host list");
  rendered = [notes];
  registry.wait(() => rendered, () => { mounts++; });
  assert.equal(mounts, 1);
  registry.mark(notes);
  assert.equal(mounts, 2, "revealed Notes acknowledges its own reactivation");
});
