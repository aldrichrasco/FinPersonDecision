const test = require("node:test");
const assert = require("node:assert");
const {
  LAB_BASIS, TWIN_PATH_RULES, pathFeatures, evaluatePathRule, twinPathRules,
  twinCommit, twinLabAccuracy, twinLabTrajectory, indexOfFlavor,
} = require("../twin-lab.js");

const MIN = 60000;
function ld(o) {
  return Object.assign({ at: 0, flavor: "conservative", netWorthDelta: 0 }, o);
}
const scenario = () => ({
  text: "s",
  choices: [
    { label: "Safe", flavor: "conservative" },
    { label: "Reach", flavor: "growth" },
    { label: "Now", flavor: "impulsive" },
  ],
});

// ------------------------------------------------------------ path features

test("depth counts the current sitting, not the lifetime log", () => {
  // A long gap ends the sitting: fatigue does not carry over to tomorrow.
  const log = [
    ld({ at: 0 }), ld({ at: 1 * MIN }), ld({ at: 2 * MIN }),
    ld({ at: 300 * MIN }), ld({ at: 301 * MIN }),
  ];
  assert.strictEqual(pathFeatures(log).depth, 2);
});

test("a loss streak counts only decisions that actually cost something", () => {
  const p = pathFeatures([
    ld({ netWorthDelta: -900 }), ld({ netWorthDelta: -50 }), ld({ netWorthDelta: -800 }),
  ]);
  assert.strictEqual(p.lossStreak, 1, "a -50 is the cost of living, not a loss to react to");
  assert.strictEqual(p.lastLoss, true);
});

test("path features never see the decision being faced", () => {
  const p = pathFeatures([ld({ flavor: "growth", netWorthDelta: 500 })]);
  assert.deepStrictEqual(Object.keys(p).sort(), [
    "depth", "gainStreak", "lastFlavor", "lastLoss", "lossStreak", "priorCount",
  ]);
  assert.strictEqual(p.gainStreak, 1);
});

// -------------------------------------------------------------- path rules

test("a path rule is scored only over decisions where its condition held", () => {
  // Losses at index 0 and 2; the rule may only be judged on 1 and 3.
  const log = [
    ld({ netWorthDelta: -900, flavor: "growth" }),
    ld({ netWorthDelta: 0, flavor: "conservative" }),
    ld({ netWorthDelta: -900, flavor: "growth" }),
    ld({ netWorthDelta: 0, flavor: "conservative" }),
  ];
  const r = evaluatePathRule(TWIN_PATH_RULES.find(x => x.id === "retreats_after_loss"), log);
  assert.strictEqual(r.total, 2, "only the two decisions that followed a loss are eligible");
  assert.strictEqual(r.support, 2);
});

test("a path rule stays unheld until it has enough applicable cases", () => {
  const log = [ld({ netWorthDelta: -900 }), ld({ flavor: "conservative" })];
  const r = evaluatePathRule(TWIN_PATH_RULES.find(x => x.id === "retreats_after_loss"), log);
  assert.strictEqual(r.holds, false, "one case is a coincidence with a name");
});

test("retreat and chase are opposite rules on the same trigger", () => {
  const retreat = TWIN_PATH_RULES.find(x => x.id === "retreats_after_loss");
  const chase = TWIN_PATH_RULES.find(x => x.id === "chases_after_loss");
  assert.notStrictEqual(retreat.expects, chase.expects);
  const p = { lastLoss: true, depth: 1, gainStreak: 0, lastFlavor: null };
  assert.ok(retreat.when(p) && chase.when(p), "both must fire so the tie has to be settled by evidence");
});

test("rules with no applicable decisions are dropped, not shown at zero", () => {
  assert.ok(twinPathRules([ld({}), ld({})]).every(r => r.total > 0));
});

// ------------------------------------------------------------- commitment

test("the twin names an option index, not a tendency", () => {
  const c = twinCommit(null, scenario(), [], null);
  assert.strictEqual(typeof c.index, "number");
  assert.ok(c.index >= 0 && c.index < 3);
});

test("with nothing to go on it still commits, and calls it a guess", () => {
  const c = twinCommit(null, scenario(), [], null);
  assert.strictEqual(c.basis, LAB_BASIS.GUESS,
    "a model that goes quiet when unsure can never be shown to be wrong");
});

test("a held path rule drives the commitment over a bare archetype default", () => {
  const log = [];
  for (let i = 0; i < 12; i++) {
    log.push(ld({ at: i * MIN, netWorthDelta: -900, flavor: "growth" }));
    log.push(ld({ at: (i + 0.5) * MIN, netWorthDelta: 0, flavor: "conservative" }));
  }
  // Ends on a loss, so the retreat rule's condition is live right now. The
  // baseline rule also fires here and expects the same flavour, so this only
  // passes if substantive rules genuinely outrank it.
  log.push(ld({ at: 99 * MIN, netWorthDelta: -900, flavor: "conservative" }));
  const c = twinCommit(null, scenario(), log, "growth");
  assert.strictEqual(c.basis, LAB_BASIS.PATH);
  assert.strictEqual(c.flavor, "conservative");
  assert.match(c.because, /after a decision that costs you/i);
});

test("the archetype is used only when no rule covers the situation", () => {
  const c = twinCommit(null, scenario(), [ld({})], "growth");
  assert.strictEqual(c.basis, LAB_BASIS.ARCHETYPE);
  assert.strictEqual(c.index, indexOfFlavor(scenario(), "growth"));
});

test("a flavour the scenario does not offer is never committed to", () => {
  const noGrowth = { choices: [{ flavor: "conservative" }, { flavor: "impulsive" }] };
  const c = twinCommit(null, noGrowth, [ld({})], "growth");
  assert.notStrictEqual(c.basis, LAB_BASIS.ARCHETYPE);
  assert.ok(c.index < 2);
});

// --------------------------------------------------------------- accuracy

function sd(basis, correct, options) {
  return { twinPredicted: 0, actual: correct ? 0 : 1, twinCorrect: correct, twinBasis: basis, optionCount: options || 3 };
}

test("accuracy is null until the twin has actually been scored", () => {
  assert.strictEqual(twinLabAccuracy([]), null);
  assert.strictEqual(twinLabAccuracy([{ actual: 1 }]), null, "an unscored decision is not a test");
});

test("guesses are reported apart from reasoned calls", () => {
  const acc = twinLabAccuracy([
    sd(LAB_BASIS.GUESS, true), sd(LAB_BASIS.GUESS, true),
    sd(LAB_BASIS.RULE, false), sd(LAB_BASIS.RULE, true),
  ]);
  assert.strictEqual(acc.byBasis.guess.rate, 100);
  assert.strictEqual(acc.reasoned.rate, 50,
    "lucky guesses must not be poolable into a competence curve");
});

test("chance is one over the options, not a flat half", () => {
  const acc = twinLabAccuracy([sd(LAB_BASIS.RULE, true, 4), sd(LAB_BASIS.RULE, true, 4)]);
  assert.strictEqual(acc.chance, 25, "a flat 50% baseline would flatter the model");
});

test("beating chance is not claimed on a thin sample", () => {
  const acc = twinLabAccuracy([sd(LAB_BASIS.RULE, true), sd(LAB_BASIS.RULE, true), sd(LAB_BASIS.RULE, true)]);
  assert.strictEqual(acc.beatsChance, false, "three right in a row is not a result");
});

test("beating chance is claimed once the sample and the margin are both real", () => {
  const rows = Array(9).fill(0).map(() => sd(LAB_BASIS.RULE, true))
    .concat([sd(LAB_BASIS.RULE, false)]);
  assert.strictEqual(twinLabAccuracy(rows).beatsChance, true);
});

// ------------------------------------------------------------- trajectory

test("a trajectory needs two blocks before it is a trajectory", () => {
  const rows = Array(6).fill(0).map(() => sd(LAB_BASIS.RULE, true));
  assert.strictEqual(twinLabTrajectory(rows, 5), null, "one block is a number, not a curve");
});

test("improvement across blocks is reported as learning", () => {
  const rows = Array(5).fill(0).map(() => sd(LAB_BASIS.RULE, false))
    .concat(Array(5).fill(0).map(() => sd(LAB_BASIS.RULE, true)));
  const t = twinLabTrajectory(rows, 5);
  assert.strictEqual(t.first, 0);
  assert.strictEqual(t.last, 100);
  assert.strictEqual(t.direction, "learning");
});

test("a twin getting worse is reported as such", () => {
  const rows = Array(5).fill(0).map(() => sd(LAB_BASIS.RULE, true))
    .concat(Array(5).fill(0).map(() => sd(LAB_BASIS.RULE, false)));
  assert.strictEqual(twinLabTrajectory(rows, 5).direction, "losing ground",
    "a curve that only ever points up is decoration");
});
