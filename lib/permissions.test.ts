import assert from "node:assert/strict";
import { test } from "node:test";
import { can, mayAct, rankOf } from "./permissions.ts";

test("role permissions", () => {
  assert.ok(can("owner", { user: ["impersonate-admins", "set-role", "delete"] }));
  assert.ok(
    can("admin", {
      user: ["list", "get", "set-role", "ban", "impersonate", "delete"],
      session: ["list", "revoke"],
    }),
  );
  assert.ok(!can("admin", { user: ["impersonate-admins"] }));
  for (const role of ["user", null, undefined, "", "constructor", "__proto__", "superuser"]) {
    assert.ok(!can(role, { user: ["list"] }), String(role));
  }
  assert.ok(can("user,admin", { user: ["list"] }), "several roles: any one grants");
});

test("only owners may add or remove songs", () => {
  assert.ok(can("owner", { song: ["create", "delete"] }));
  assert.ok(can("owner", { song: ["create"] }));
  assert.ok(can("owner,user", { song: ["delete"] }));
  for (const role of ["admin", "user", null, undefined, "", "constructor", "__proto__"]) {
    assert.ok(!can(role, { song: ["create"] }), String(role));
    assert.ok(!can(role, { song: ["delete"] }), String(role));
    assert.ok(!can(role, { song: ["create", "delete"] }), String(role));
  }
});

test("ranks", () => {
  assert.deepEqual(
    ["owner", "admin", "user", null, "", "toString", "admin,owner"].map(rankOf),
    [3, 2, 1, 1, 1, 0, 3],
  );
});

test("role hierarchy", () => {
  const cases: [string | null, string | null | undefined, unknown[] | undefined, boolean][] = [
    ["owner", "admin", undefined, true],
    ["owner", "user", ["admin"], true],
    ["owner", "user", ["user"], true],
    ["owner", "owner", undefined, false], // no owner-on-owner (incl. self)
    ["owner", "user", ["owner"], false], // owners are made with SQL only
    ["admin", "user", undefined, true],
    ["admin", "user", ["user"], true],
    ["admin", "admin", undefined, false], // peers and self
    ["admin", "owner", undefined, false],
    ["admin", "user", ["admin"], false], // can't grant own rank
    ["admin", undefined, ["user"], true], // create-user: target defaults to user
    ["admin", undefined, ["admin"], false],
    ["admin", "user", [], false],
    ["admin", "user", ["user,admin"], false], // comma-joined role
    ["admin", "user", [undefined], false],
    ["admin", "user", ["toString"], false],
    ["user", null, undefined, false],
    [null, null, undefined, false],
    ["superuser", "user", undefined, false],
  ];
  for (const [actor, target, newRoles, ok] of cases) {
    assert.equal(
      mayAct(actor, target, newRoles),
      ok,
      `${actor} -> ${target} ${JSON.stringify(newRoles)}`,
    );
  }
});
