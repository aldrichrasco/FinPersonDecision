const test = require("node:test");
const assert = require("node:assert");
const {
  buildTwin, twinEvaluateRule, twinPredict, TWIN_RULES, TWIN_MIN_EVIDENCE,
} = require("../twin.js");
const { runTwinSimulation, SIM_SCENARIOS, simRng } = require("../twin-sim.js");

function d(o) {
  return Object.assign({
    predicted: 0, actual: 0, matched: true, timed: false,
    netWorthDelta: 0, surface: null, principle: null,
  }, o);
}
const rule = id => TWIN_RULES.find(r => r.id === id);

// --------------------------------------------------------------- evidence

test("a rule stays a hunch below the evidence minimum", () => {
  const decisions = [d({ timed: true, matched: false })];
  const r = twinEvaluateRule(rule("deadline_breaks_pause"), decisions);
  assert.ok(r.total < TWIN_MIN_EVIDENCE);
  assert.strictEqual(r.status, "proposed");
});

test("a rule confirms once support is strong enough", () => {
  const decisions = Array(4).fill(0).map(() => d({ timed: true, matched: false }));
  const r = twinEvaluateRule(rule("deadline_breaks_pause"), decisions);
  assert.strictEqual(r.support, 4);
  assert.strictEqual(r.status, "confirmed");
});

test("counter-evidence contests a rule rather than being ignored", () => {
  // Mostly matched under a deadline: the rule that says the pause breaks
  // is contradicted, and must show that instead of quietly holding.
  const decisions = Array(4).fill(0).map(() => d({ timed: true, matched: true }))
    .concat([d({ timed: true, matched: false })]);
  const r = twinEvaluateRule(rule("deadline_breaks_pause"), decisions);
  assert.strictEqual(r.status, "contested");
});

test("rules with no applicable decisions are dropped, not shown at zero", () => {
  const twin = buildTwin([d({ timed: false, matched: true, predicted: null })]);
  assert.ok(twin.rules.every(r => r.total > 0));
});

// --------------------------------------------------------------- maturity

test("maturity will not overstate a twin with almost no evidence", () => {
  assert.strictEqual(buildTwin([]).maturity.level, 0);
  assert.strictEqual(buildTwin([d(), d()]).maturity.level, 0);
});

test("maturity rises only as rules actually confirm", () => {
  const thin = buildTwin(Array(6).fill(0).map(() => d({ predicted: null })));
  const rich = buildTwin(
    Array(5).fill(0).map(() => d({ timed: true, matched: false }))
      .concat(Array(5).fill(0).map(() => d({ timed: false, matched: true })))
  );
  assert.ok(rich.maturity.level > thin.maturity.level);
});

// ------------------------------------------------------------- prediction

test("the twin refuses to predict without an applicable confirmed rule", () => {
  const twin = buildTwin([d(), d()]);
  assert.strictEqual(twinPredict(twin, { timed: true }), null);
});

test("the twin predicts from the rule whose conditions the scenario meets", () => {
  const twin = buildTwin(Array(5).fill(0).map(() => d({ timed: true, matched: false })));
  const p = twinPredict(twin, { timed: true });
  assert.ok(p, "a confirmed deadline rule should produce a call");
  assert.strictEqual(p.rule.id, "deadline_breaks_pause");
});

// ------------------------------------------------------------- simulation

test("simulation is deterministic for a given seed", () => {
  const twin = buildTwin(Array(5).fill(0).map(() => d({ timed: true, matched: false })));
  const a = runTwinSimulation(twin, "growth", { rounds: 16, seed: 42 });
  const b = runTwinSimulation(twin, "growth", { rounds: 16, seed: 42 });
  assert.deepStrictEqual(a.tracks.you, b.tracks.you);
  assert.deepStrictEqual(a.tracks.drift, b.tracks.drift);
});

test("simulation runs all three agents over the same number of rounds", () => {
  const twin = buildTwin(Array(5).fill(0).map(() => d({ timed: true, matched: false })));
  const sim = runTwinSimulation(twin, "conservative", { rounds: 12 });
  assert.strictEqual(sim.log.length, 12);
  ["you", "archetype", "drift"].forEach(k => {
    assert.strictEqual(sim.tracks[k].length, 13, `${k} needs a start point plus one per round`);
  });
});

test("a twin that follows a costly rule underperforms its own archetype", () => {
  // The deadline rule makes "you" take the impulsive option under time
  // pressure, which is exactly the behaviour the report is about. The
  // simulation has to reproduce that rather than quietly optimising.
  const twin = buildTwin(Array(5).fill(0).map(() => d({ timed: true, matched: false })));
  const sim = runTwinSimulation(twin, "conservative", { rounds: 16, seed: 7 });
  assert.ok(sim.gapToArchetype > 0, "playing by a costly rule should trail the textbook version");
  assert.ok(sim.divergences > 0);
});

test("beatsChance is false when the twin tracks the random baseline", () => {
  // No confirmed rules means policyYou falls through to chance, so "you"
  // and "drift" should not be presented as meaningfully different.
  const twin = buildTwin([d(), d()]);
  const sim = runTwinSimulation(twin, "conservative", { rounds: 16, seed: 3 });
  assert.strictEqual(sim.beatsChance, false);
});

test("the seeded rng is reproducible and stays in range", () => {
  const a = simRng(99), b = simRng(99);
  for (let i = 0; i < 50; i++) {
    const v = a();
    assert.strictEqual(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test("every simulation scenario is well formed", () => {
  SIM_SCENARIOS.forEach(s => {
    assert.ok(s.text && s.choices.length >= 2, "needs text and a real trade-off");
    s.choices.forEach(c => {
      assert.strictEqual(typeof c.delta, "number");
      assert.ok(c.flavor, "every choice needs a flavour for the archetype policy");
    });
  });
});
