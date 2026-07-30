const test = require('node:test');
const assert = require('node:assert/strict');
const { nudgeDeltaFromFraction, nudgeDeltaUltimatumResponder } = require('../nudge-formulas.js');

test('nudgeDeltaFromFraction: exactly at baseline gives 0', () => {
  assert.equal(nudgeDeltaFromFraction(0.3), 0);
});

test('nudgeDeltaFromFraction: above baseline gives a positive delta', () => {
  assert.equal(nudgeDeltaFromFraction(0.5), 2); // (0.5 - 0.3) * 10 = 2
});

test('nudgeDeltaFromFraction: below baseline gives a negative delta', () => {
  assert.equal(nudgeDeltaFromFraction(0.1), -2); // (0.1 - 0.3) * 10 = -2
});

test('nudgeDeltaFromFraction: clamps at the cap in both directions', () => {
  assert.equal(nudgeDeltaFromFraction(1), 4); // (1 - 0.3) * 10 = 7, capped to 4
  assert.equal(nudgeDeltaFromFraction(0), -3); // (0 - 0.3) * 10 = -3, within cap
  assert.equal(nudgeDeltaFromFraction(-1), -4); // (-1 - 0.3) * 10 = -13, capped to -4
});

test('nudgeDeltaFromFraction: custom baseline/scale/cap are honored', () => {
  assert.equal(nudgeDeltaFromFraction(0.6, { baseline: 0.5, scale: 20, cap: 2 }), 2);
});

test('nudgeDeltaUltimatumResponder: accepting a fair-ish offer reads confident (+1)', () => {
  assert.equal(nudgeDeltaUltimatumResponder(0.4, true), 1);
});

test('nudgeDeltaUltimatumResponder: accepting a lowball offer reads less confident (-2)', () => {
  assert.equal(nudgeDeltaUltimatumResponder(0.1, true), -2);
});

test('nudgeDeltaUltimatumResponder: rejecting a lowball offer reads confident (+2)', () => {
  assert.equal(nudgeDeltaUltimatumResponder(0.1, false), 2);
});

test('nudgeDeltaUltimatumResponder: rejecting a fair-ish offer is ambiguous, no nudge (0)', () => {
  assert.equal(nudgeDeltaUltimatumResponder(0.4, false), 0);
});
