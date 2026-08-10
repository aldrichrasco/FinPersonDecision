const test = require("node:test");
const assert = require("node:assert");
const {
  allocationShares, allocationDistance, allocationConcentration,
  nextTitrationStep, applyTitrationAnswer, estimateDiscountRate,
  titrationConsistent, thresholdReading,
} = require("../elicit.js");

// --------------------------------------------------------------- allocation

test("allocations compare as shares, so pot size does not distort them", () => {
  const small = { debt: 50, savings: 50 };
  const large = { debt: 5000, savings: 5000 };
  assert.strictEqual(allocationDistance(small, large), 0,
    "the same split of a different pot is the same preference");
});

test("allocation distance registers magnitude a choice format cannot see", () => {
  // Both "chose debt" under a forced choice. They are not the same person.
  const mild = { debt: 55, savings: 45 };
  const strong = { debt: 90, savings: 10 };
  const d = allocationDistance(mild, strong);
  assert.ok(d > 0.3, "a 55/45 and a 90/10 must not read as identical");
  assert.ok(d <= 1);
});

test("concentration is 0 for an even spread and 1 for everything in one bucket", () => {
  assert.strictEqual(allocationConcentration({ a: 1, b: 1, c: 1 }), 0);
  assert.strictEqual(allocationConcentration({ a: 10, b: 0, c: 0 }), 1);
});

test("an empty allocation yields null rather than a fabricated even split", () => {
  assert.strictEqual(allocationShares({ a: 0, b: 0 }), null);
  assert.strictEqual(allocationDistance({ a: 0 }, { a: 1 }), null);
});

// --------------------------------------------------------------- titration

// A respondent with a known discount rate, answering honestly.
function simulate(trueK, later, days, steps) {
  let st = { laterAmount: later, delayDays: days, maxSteps: steps || 6 };
  const worth = later / (1 + trueK * days);
  for (let i = 0; i < (steps || 6); i++) {
    const s = nextTitrationStep(st);
    if (s.done) break;
    st = applyTitrationAnswer(st, s.offer >= worth);
  }
  const fin = nextTitrationStep(st);
  return { est: estimateDiscountRate(fin.indifference, later, days), state: st };
}

test("the staircase recovers a known discount rate", () => {
  // The whole claim of parametric elicitation: six binary answers from ONE
  // template produce a calibrated number, not a lean.
  [0.005, 0.02, 0.05, 0.12].forEach(k => {
    const { est } = simulate(k, 100, 30);
    assert.ok(est, `k=${k} should produce an estimate`);
    const err = Math.abs(est.k - k) / k;
    assert.ok(err < 0.15, `k=${k} recovered as ${est.k}, off by ${Math.round(err * 100)}%`);
  });
});

test("the staircase narrows rather than wandering", () => {
  const first = nextTitrationStep({ laterAmount: 100 });
  const later = nextTitrationStep(applyTitrationAnswer({ laterAmount: 100 }, true));
  assert.ok(later.step < first.step, "each answer must halve the search range");
});

test("someone who never prefers waiting yields no rate rather than a huge one", () => {
  // Refusing to trade at any offer is a refusal, not infinite impatience, and
  // reporting it as a number would invent a finding.
  assert.strictEqual(estimateDiscountRate(100, 100, 30), null);
  assert.strictEqual(estimateDiscountRate(140, 100, 30), null);
  assert.strictEqual(estimateDiscountRate(0, 100, 30), null);
});

test("the reading is stated as a band, never as a verdict", () => {
  const est = estimateDiscountRate(63, 100, 30);
  assert.strictEqual(est.presentShare, 63);
  assert.ok(["patient", "typical", "steep"].includes(est.band),
    "someone short of cash is not irrational for wanting money now");
});

test("a careless staircase is marked unusable rather than reported precisely", () => {
  const flipflop = Array(8).fill(0).map((_, i) => ({ offer: 50, tookSooner: i % 2 === 0 }));
  assert.strictEqual(titrationConsistent(flipflop).usable, false,
    "reversing on every step is not convergence");
  const converging = [
    { tookSooner: true }, { tookSooner: true }, { tookSooner: false }, { tookSooner: true },
  ];
  assert.strictEqual(titrationConsistent(converging).usable, true,
    "some reversal is how a staircase homes in");
});

test("consistency stays silent on a sample too short to judge", () => {
  assert.strictEqual(titrationConsistent([{ tookSooner: true }]), null);
});

// --------------------------------------------------------------- threshold

test("a threshold reads against its reference, not an invented population", () => {
  assert.strictEqual(thresholdReading(150, 100).reading, "above");
  assert.strictEqual(thresholdReading(100, 100).reading, "near");
  assert.strictEqual(thresholdReading(50, 100).reading, "below");
  assert.strictEqual(thresholdReading(-5, 100), null);
});
