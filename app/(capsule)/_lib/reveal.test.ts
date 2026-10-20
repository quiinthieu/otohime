// The tier comes last: played frame by frame for every tier, nothing a
// component can read shows an edge or a face before the edge stage.
import assert from "node:assert/strict";
import { test } from "node:test";
import { turn } from "./actions.ts";
import { TIERS, type Tier } from "./cards.ts";
import { type Ledger, freshLedger } from "./ledger.ts";
import { type Machine, TURN_MAX, TURN_MIN, newMachine, openFrames, step } from "./machine.ts";
import { type RevealView, albumView, isNewCard, revealView } from "./reveal.ts";

const NOW = new Date(2026, 9, 19, 12).getTime();

// Every view of one round, in order, from Insert to the reveal.
function playRound(tier: Tier, frames: number, drop = 2): { m: Machine; v: RevealView }[] {
  const seen: { m: Machine; v: RevealView }[] = [];
  const see = (m: Machine) => seen.push({ m, v: revealView(m) });
  let m = step(newMachine(), "insert");
  see(m);
  m = step(m, { type: "turn", frames, drop, tier });
  while (m.phase === "turning") {
    see(m);
    m = step(m, "tick");
  }
  see(m);
  m = step(m, "open");
  while (m.phase === "opening") {
    see(m);
    m = step(m, "tick");
  }
  see(m);
  return seen;
}

const BEFORE_EDGE = new Set(["idle", "loaded", "turning", "dropping", "ready", "shake", "part", "rise"]);

test("no frame before the edge stage exposes the tier or the face", () => {
  for (const tier of TIERS) {
    for (const frames of [TURN_MIN, 21, TURN_MAX]) {
      const round = playRound(tier, frames);
      let early = 0;
      for (const { m, v } of round) {
        if (!BEFORE_EDGE.has(v.stage)) continue;
        early++;
        assert.equal(v.edge, null, `${tier} ${m.phase} ${m.frame} (${v.stage})`);
        assert.notEqual(v.card, "face", `${tier} ${m.phase} ${m.frame} (${v.stage})`);
        assert.equal(v.flip, 0);
      }
      // 1 loaded + the whole turn + ready + shake, part and rise
      assert.equal(early, 1 + frames + 1 + 16, `${tier} ${frames}`);
    }
  }
});

test("everything before the edge stage looks the same whatever the tier", () => {
  const strip = (round: { v: RevealView }[]) => round.map(({ v }) => v).filter((v) => BEFORE_EDGE.has(v.stage));
  const common = strip(playRound("common", 22));
  assert.deepEqual(strip(playRound("rare", 22)), common);
  assert.deepEqual(strip(playRound("legend", 22)), common);
});

test("the stages run in order: turn, drop, ready, then shake, part, rise, edge, (hold), flip, revealed", () => {
  for (const tier of TIERS) {
    const stages = playRound(tier, 20).map(({ v }) => v.stage);
    const order = stages.filter((s, i) => s !== stages[i - 1]);
    const open = tier === "legend" ? ["edge", "hold", "flip"] : ["edge", "flip"];
    assert.deepEqual(order, ["loaded", "turning", "dropping", "ready", "shake", "part", "rise", ...open, "revealed"]);
    assert.equal(stages.filter((s) => s === "dropping").length, 6);
    assert.equal(stages.filter((s) => s === "turning").length, 14);
  }
});

test("the shell drops, sits closed, shakes, then opens; the card is a back from rise", () => {
  const round = playRound("rare", 18);
  for (const { v } of round) {
    const shell = { idle: "none", loaded: "none", turning: "none", dropping: "dropping", ready: "closed", shake: "shake" }[
      v.stage as string
    ];
    assert.equal(v.shell, shell ?? "open", v.stage);
    if (v.stage === "rise" || v.stage === "edge" || v.stage === "hold") assert.equal(v.card, "back", v.stage);
    if (v.stage === "shake" || v.stage === "part") assert.equal(v.card, "none", v.stage);
  }
});

test("the edge shows from the edge stage; the face only from the second half of the flip", () => {
  for (const tier of TIERS) {
    const open = playRound(tier, 16).filter(({ m }) => m.phase === "opening");
    assert.equal(open.length, openFrames(tier));
    for (const { v } of open) if (v.stage === "edge" || v.stage === "hold" || v.stage === "flip") assert.equal(v.edge, tier);
    const flip = open.filter(({ v }) => v.stage === "flip").map(({ v }) => [v.card, v.flip]);
    assert.deepEqual(
      flip.map(([card]) => card),
      ["back", "back", "back", "face", "face", "face"],
    );
    flip.forEach(([, f], i) => assert.equal(f, (i + 1) / 6));
  }
});

test("revealed shows the face and the tier", () => {
  for (const tier of TIERS) {
    const { v } = playRound(tier, 24).at(-1)!;
    assert.deepEqual(v, { stage: "revealed", shell: "open", card: "face", edge: tier, flip: 1, progress: 1 });
  }
  assert.equal(revealView(newMachine()).stage, "idle");
  assert.equal(revealView(newMachine()).card, "none");
});

const ledgerWith = (owned: Ledger["owned"], draws: number): Ledger => ({ ...freshLedger(42, NOW), owned, draws });

test("albumView hides a first copy until the reveal", () => {
  const l = ledgerWith({ totoro: 1, jiji: 2 }, 3);
  const hidden = albumView(l, "totoro");
  assert.deepEqual(hidden.owned, { jiji: 2 });
  assert.equal("totoro" in hidden.owned, false);
  assert.equal(hidden.draws, 2);
  assert.equal(hidden.coins, l.coins);
  assert.equal(hidden.seed, l.seed);
  // the committed ledger is untouched
  assert.deepEqual(l.owned, { totoro: 1, jiji: 2 });
});

test("albumView hides an extra copy (×n-1)", () => {
  const hidden = albumView(ledgerWith({ jiji: 3 }, 5), "jiji");
  assert.deepEqual(hidden.owned, { jiji: 2 });
  assert.equal(hidden.draws, 4);
});

test("albumView with nothing pending is the ledger itself", () => {
  const l = ledgerWith({ jiji: 3 }, 5);
  assert.equal(albumView(l, null), l);
  // nothing of it left to hide (an album reset mid-round) also leaves it alone
  const reset = ledgerWith({}, 0);
  assert.equal(albumView(reset, "jiji"), reset);
});

test("through turn: the album holds the drawn card back until revealed, and isNewCard knows a first copy", () => {
  let ledger = freshLedger(42, NOW);
  for (let i = 0; i < 4; i++) {
    const before = ledger;
    const r = turn(ledger, NOW)!;
    ledger = r.ledger;
    const pending = albumView(ledger, r.card.id);
    assert.deepEqual(pending.owned, before.owned);
    assert.equal(pending.draws, before.draws);
    assert.equal(isNewCard(ledger, r.card.id), (before.owned[r.card.id] ?? 0) === 0);
  }
});
