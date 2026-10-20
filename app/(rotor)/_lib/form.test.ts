import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULTS, encode, parseSettings, toQuery } from "./enigma.ts";
import { formQuery, plugText } from "./form.ts";

const submitted = (s: string) => {
  const q: Record<string, string | string[]> = {};
  for (const [k, v] of new URLSearchParams(s)) q[k] = k in q ? [q[k]].flat().concat(v) : v;
  return q;
};

test("a canonical query is not a form submission", () => {
  assert.equal(formQuery({}), null);
  assert.equal(formQuery(submitted("r=I-II-III&ring=AAA&pos=ADU&ref=B&m=AAAA")), null);
});

test("the no-JavaScript form joins into the canonical query: AAAAA prints BDZGO", () => {
  const q = formQuery(submitted("r=I&r=II&r=III&ring=A&ring=A&ring=A&pos=A&pos=A&pos=A&ref=B&plug=&m=AAAAA"));
  assert.ok(q);
  const p = parseSettings(q);
  assert.equal(toQuery(p, p.message), "r=I-II-III&ring=AAA&pos=AAA&ref=B&m=AAAAA");
  assert.equal(encode(p, p.message), "BDZGO");
});

test("the form's other settings and plug text come through", () => {
  const q = formQuery(submitted("r=II&r=IV&r=V&ring=B&ring=U&ring=L&pos=B&pos=L&pos=A&ref=C&plug=av bs,cg+dl&m=hi"));
  const p = parseSettings(q!);
  assert.deepEqual(
    { rotors: p.rotors, rings: p.rings, positions: p.positions, reflector: p.reflector, plugs: p.plugs },
    { rotors: ["II", "IV", "V"], rings: "BUL", positions: "BLA", reflector: "C", plugs: ["AV", "BS", "CG", "DL"] },
  );
  assert.equal(p.message, "hi");
});

test("a bad form field still falls back alone", () => {
  const p = parseSettings(formQuery(submitted("r=I&r=I&r=III&ring=A&ring=A&ring=A&pos=Q&pos=E&pos=V&ref=B&plug=AB-AC"))!);
  assert.deepEqual(p.rotors, DEFAULTS.rotors);
  assert.equal(p.positions, "QEV");
  assert.deepEqual(p.plugs, []);
});

test("plugText reads any separator", () => {
  assert.equal(plugText(""), "");
  assert.equal(plugText("  "), "");
  assert.equal(plugText("ab-cd"), "AB-CD");
  assert.equal(plugText(" ab, cd ;ef "), "AB-CD-EF");
});
