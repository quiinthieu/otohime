import assert from "node:assert/strict";
import { test } from "node:test";
import { getSeal, getServerSeal, saveSeal, subscribeSeal } from "./hanko-client.ts";
import { SEAL_KEY } from "./hanko.ts";

test("seal persistence broadcasts same-tab changes, follows storage, and tolerates denial", () => {
  const data = new Map<string, string>(), events = new Map<string, (event: { key: string }) => void>();
  let blocked = false, notifications = 0;
  Object.assign(globalThis, {
    localStorage: {
      getItem(key: string) { if (blocked) throw Error("denied"); return data.get(key) ?? null; },
      setItem(key: string, value: string) { if (blocked) throw Error("denied"); data.set(key, value); },
    },
    addEventListener: (key: string, listener: (event: { key: string }) => void) => events.set(key, listener),
    removeEventListener: (key: string) => events.delete(key),
  });
  const unsub = subscribeSeal(() => notifications++);
  assert.equal(getServerSeal(), null); assert.equal(getSeal(), null);
  assert.equal(saveSeal({ name: "乙姫", shape: "round" }), true);
  assert.equal(notifications, 1);
  assert.equal(getSeal(), data.get(SEAL_KEY));
  data.delete(SEAL_KEY); events.get("storage")!({ key: SEAL_KEY });
  assert.equal(getSeal(), null);
  blocked = true;
  assert.equal(saveSeal({ name: "Billie", shape: "square" }), false);
  assert.match(getSeal()!, /Billie/);
  unsub(); assert.equal(events.size, 0);
  subscribeSeal(() => {})(); assert.match(getSeal()!, /Billie/, "new islands keep this tab's seal even when persistence is denied");
});
