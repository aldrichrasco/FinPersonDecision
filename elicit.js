// Elicitation: response formats that produce numbers instead of categories.
//
// A multiple choice tells you which direction someone leaned. It cannot tell
// you how far, and it cannot be compared across two people or across the same
// person six months apart. Every finding built on it has to be phrased as a
// proportion of decisions, which is why the twin needs fifteen of them before
// it can say anything at all.
//
// These formats produce a parameter. One titration run yields a discount rate;
// one allocation yields a distribution with a distance you can measure. That
// changes two things:
//
//   Content stops being the ceiling. A staircase generates eight informative
//   responses from ONE template, because the information is in the amounts,
//   not in a new story each time. Sixteen scenarios was the binding constraint
//   on the whole laboratory and this is the way around it.
//
//   The twin gets a finer target. Predicting "conservative" is a coin flip
//   dressed up. Predicting that someone's indifference point sits near $63
//   and being out by four dollars is a real, gradable claim.
//
// Nothing here calls a model. These are standard elicitation procedures from
// the behavioural economics literature, implemented as arithmetic.

// --- allocation -------------------------------------------------------------
// Split a fixed pot across buckets. Reveals magnitude of preference, which a
// forced choice cannot: someone who puts 90% on debt and someone who puts 55%
// both register as "chose debt" under a choice format.

// Normalises to shares so two allocations of different pot sizes compare.
function allocationShares(alloc) {
  const keys = Object.keys(alloc || {});
  const total = keys.reduce((a, k) => a + (Number(alloc[k]) || 0), 0);
  if (!total) return null;
  const out = {};
  keys.forEach(k => { out[k] = (Number(alloc[k]) || 0) / total; });
  return out;
}

// Total variation distance between two allocations: half the sum of absolute
// differences in share, giving 0 for identical and 1 for disjoint. Used to
// score the twin against an allocation, where an exact match is not the point
// and near-misses carry most of the signal.
function allocationDistance(a, b) {
  const sa = allocationShares(a), sb = allocationShares(b);
  if (!sa || !sb) return null;
  const keys = new Set(Object.keys(sa).concat(Object.keys(sb)));
  let sum = 0;
  keys.forEach(k => { sum += Math.abs((sa[k] || 0) - (sb[k] || 0)); });
  return sum / 2;
}

// How lopsided an allocation is: 0 when spread evenly across buckets, 1 when
// everything sits in one. Concentration is itself a trait, and it is invisible
// to a choice format.
function allocationConcentration(alloc) {
  const s = allocationShares(alloc);
  if (!s) return null;
  const keys = Object.keys(s);
  if (keys.length < 2) return 1;
  const hhi = keys.reduce((a, k) => a + s[k] * s[k], 0);
  const floor = 1 / keys.length;
  return (hhi - floor) / (1 - floor);
}

// --- titration --------------------------------------------------------------
// A staircase. Repeatedly offer a smaller amount now against a fixed larger
// amount later, moving the near amount toward the point where the person stops
// preferring one. That crossing point is their indifference point, and it is a
// number rather than a lean.

const TITRATION_STEPS = 6;

// Next offer in the staircase, halving the step each time. Standard bisection:
// six steps localise the indifference point to under 2% of the range, which is
// finer than the person's own consistency, so more steps would be measuring
// noise and spending patience to do it.
function nextTitrationStep(state) {
  const s = state || {};
  const later = s.laterAmount || 100;
  const step = s.step === undefined ? later / 4 : s.step / 2;
  const current = s.current === undefined ? later / 2 : s.current;
  const n = (s.n || 0);
  if (n >= (s.maxSteps || TITRATION_STEPS)) {
    return { done: true, indifference: current, steps: n };
  }
  return { done: false, offer: Math.round(current), step, n };
}

// Applies an answer and returns the next state. tookSooner = they preferred
// the money now, which means the sooner amount was already generous enough, so
// the next offer moves DOWN to find where they stop.
function applyTitrationAnswer(state, tookSooner) {
  const s = state || {};
  const step = s.step === undefined ? (s.laterAmount || 100) / 4 : s.step;
  const current = s.current === undefined ? (s.laterAmount || 100) / 2 : s.current;
  return {
    laterAmount: s.laterAmount || 100,
    delayDays: s.delayDays || 30,
    current: tookSooner ? current - step : current + step,
    step: step / 2,
    n: (s.n || 0) + 1,
    maxSteps: s.maxSteps || TITRATION_STEPS,
    history: (s.history || []).concat([{ offer: Math.round(current), tookSooner }]),
  };
}

// Hyperbolic discount rate from an indifference point.
//
//   V = A / (1 + k*d)
//
// At indifference the sooner amount V equals the discounted later amount A,
// so k = (A/V - 1) / d. Hyperbolic rather than exponential because the
// steep-then-flat shape is what the literature actually observes in people,
// and an exponential fit would push the misfit into the parameter.
//
// Returns null rather than a number when the response pattern cannot support
// one: an indifference point at or above the later amount means they never
// preferred waiting at any offer, which is a refusal to trade rather than an
// infinitely impatient person.
function estimateDiscountRate(indifference, laterAmount, delayDays) {
  const v = Number(indifference), a = Number(laterAmount), d = Number(delayDays);
  if (!(v > 0) || !(a > 0) || !(d > 0)) return null;
  if (v >= a) return null;
  const k = (a / v - 1) / d;
  return {
    k: Number(k.toFixed(5)),
    indifference: Math.round(v),
    laterAmount: a,
    delayDays: d,
    // What the later amount is worth to them today, as a share. The readable
    // version: "$100 in a month is worth about $63 to you right now."
    presentShare: Math.round((v / a) * 100),
    // Bands, not a verdict. There is no correct discount rate: someone with an
    // urgent need is not irrational for wanting money now, and a product that
    // implied otherwise would be scolding people for being short of cash.
    band: k < 0.01 ? "patient" : k < 0.05 ? "typical" : "steep",
  };
}

// --- consistency ------------------------------------------------------------
// A staircase can be answered carelessly, and the result still produces a
// number. This checks whether the pattern was monotone: someone who flips
// back and forth was not converging on anything, and their estimate should be
// discarded rather than reported to three decimal places.
function titrationConsistent(history) {
  const h = (history || []);
  if (h.length < 3) return null;
  let reversals = 0;
  for (let i = 1; i < h.length; i++) {
    if (h[i].tookSooner !== h[i - 1].tookSooner) reversals++;
  }
  // A converging staircase reverses as it homes in, so some reversal is
  // expected and correct. Reversing on nearly every step is not convergence.
  const rate = reversals / (h.length - 1);
  return { reversals, rate: Math.round(rate * 100), usable: rate <= 0.75 };
}

// --- threshold --------------------------------------------------------------
// Name your own number: the least you would accept, or the most you would pay.
// One response, directly interpretable, and far harder to answer carelessly
// than a multiple choice because there is no option list to pick from.
function thresholdReading(value, reference) {
  const v = Number(value), r = Number(reference);
  if (!(v >= 0) || !(r > 0)) return null;
  const ratio = v / r;
  return {
    value: v, reference: r,
    ratio: Number(ratio.toFixed(3)),
    // Relative to the reference, not to other people. A cross-user percentile
    // would need a population this product does not have yet, and inventing
    // one is how a made-up number ends up printed next to a real one.
    reading: ratio > 1.25 ? "above" : ratio < 0.8 ? "below" : "near",
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TITRATION_STEPS,
    allocationShares, allocationDistance, allocationConcentration,
    nextTitrationStep, applyTitrationAnswer, estimateDiscountRate,
    titrationConsistent, thresholdReading,
  };
}
