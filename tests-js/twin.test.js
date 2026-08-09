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

// --------------------------------------------------------- learning rate
const { twinLearningRate, groupIntoSessions } = require("../twin.js");

function td(at, matched) {
  return { at, predicted: 0, actual: matched ? 0 : 1, matched };
}
const HOUR = 3600000;

test("sessions split on a long gap, not on every decision", () => {
  const decisions = [td(0, true), td(1000, true), td(5 * HOUR, true)];
  const sessions = groupIntoSessions(decisions);
  assert.strictEqual(sessions.length, 2);
  assert.strictEqual(sessions[0].length, 2);
});

test("learning rate refuses a sample too thin to mean anything", () => {
  assert.strictEqual(twinLearningRate([]), null);
  assert.strictEqual(twinLearningRate([td(0, true), td(1, true), td(2, true)]), null,
    "one session cannot show a trend");
});

test("sessions of one or two decisions are excluded as noise", () => {
  // Second sitting has two decisions: a 0% or 100% there is not a data point.
  const decisions = [
    td(0, true), td(1, true), td(2, false), td(3, true),
    td(5 * HOUR, false), td(5 * HOUR + 1, false),
  ];
  assert.strictEqual(twinLearningRate(decisions), null);
});

test("improvement is reported when self-prediction genuinely rises", () => {
  const decisions = [
    td(0, true), td(1, false), td(2, true), td(3, false),
    td(5 * HOUR, true), td(5 * HOUR + 1, true), td(5 * HOUR + 2, true),
    td(5 * HOUR + 3, false), td(5 * HOUR + 4, true),
  ];
  const lr = twinLearningRate(decisions);
  assert.strictEqual(lr.first, 50);
  assert.strictEqual(lr.last, 80);
  assert.strictEqual(lr.direction, "improving");
});

test("a small wobble is called flat rather than dressed as improvement", () => {
  const decisions = [
    td(0, true), td(1, true), td(2, false), td(3, false),
    td(5 * HOUR, true), td(5 * HOUR + 1, true), td(5 * HOUR + 2, false), td(5 * HOUR + 3, false),
  ];
  assert.strictEqual(twinLearningRate(decisions).direction, "flat");
});

test("decline is reported rather than hidden", () => {
  const decisions = [
    td(0, true), td(1, true), td(2, true), td(3, true),
    td(5 * HOUR, false), td(5 * HOUR + 1, false), td(5 * HOUR + 2, false), td(5 * HOUR + 3, true),
  ];
  const lr = twinLearningRate(decisions);
  assert.strictEqual(lr.direction, "declining",
    "a metric that only appears when it flatters the product is not a metric");
});

// -------------------------------------------------- competing explanations
const { twinCompetingExplanations, twinMostUnresolved, TWIN_RIVALS } = require("../twin.js");

function cd(o) {
  return Object.assign({
    predicted: 0, actual: 0, matched: true, timed: false,
    netWorthDelta: -100, surface: null,
  }, o);
}

test("rivalries stay silent until there is anything to compare", () => {
  assert.deepStrictEqual(twinCompetingExplanations([]), []);
  assert.deepStrictEqual(twinCompetingExplanations([cd(), cd(), cd()]), []);
});

test("every rivalry declares the case that would separate its two sides", () => {
  TWIN_RIVALS.forEach(r => {
    assert.ok(r.discriminator && typeof r.discriminator.matches === "function",
      `${r.id} needs a discriminating case, or it is two claims with no way to choose`);
    assert.ok(r.discriminator.needs && r.discriminator.explains);
    assert.notStrictEqual(r.a.claim, r.b.claim);
  });
});

test("the discriminating case decides it, not the raw tally", () => {
  // Pause fails on small amounts whether or not a clock is running, and holds
  // on the timed decisions that carried real money. Stakes, not the clock.
  const decisions = [
    cd({ matched: false, timed: false, netWorthDelta: -100 }),
    cd({ matched: false, timed: false, netWorthDelta: -200 }),
    cd({ matched: false, timed: true, netWorthDelta: -150 }),
    cd({ matched: true, timed: true, netWorthDelta: -2000 }),
    cd({ matched: true, timed: true, netWorthDelta: -1500 }),
    cd({ matched: true, timed: false, netWorthDelta: -2500 }),
  ];
  const r = twinCompetingExplanations(decisions).find(x => x.id === "why_the_pause_fails");
  assert.strictEqual(r.leading, "b", "the stakes explanation should lead");
  assert.ok(r.discriminating >= 2);
  assert.strictEqual(r.resolved, true);
});

test("a lopsided tally alone does not resolve a rivalry", () => {
  // One side never tested: a margin here means nothing.
  const decisions = [
    cd({ matched: false, timed: true, netWorthDelta: -2000 }),
    cd({ matched: false, timed: true, netWorthDelta: -1800 }),
    cd({ matched: true, timed: false, netWorthDelta: -5000 }),
    cd({ matched: true, timed: false, netWorthDelta: -4000 }),
  ];
  const r = twinCompetingExplanations(decisions).find(x => x.id === "why_the_pause_fails");
  assert.strictEqual(r.resolved, false,
    "without both sides tested, a margin is an artefact of what was never asked");
});

test("the least-tested live rivalry is the one to resolve next", () => {
  const decisions = Array(6).fill(0).map(() => cd({ matched: false, netWorthDelta: -100 }));
  const next = twinMostUnresolved(decisions);
  assert.ok(next, "an untested rivalry should be offered up");
  assert.strictEqual(next.resolved, false);
  assert.ok(next.discriminator.needs.length > 0);
});
