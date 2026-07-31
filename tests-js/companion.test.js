const test = require('node:test');
const assert = require('node:assert/strict');
const { computeCompanionState } = require('../companion.js');

test('computeCompanionState: fewer than two capability snapshots reads as "new"', () => {
  const state = computeCompanionState({ history: [{ capability: 50, at: 1 }] });
  assert.equal(state.trend, 'new');
  assert.equal(state.glow, 'slate');
});

test('computeCompanionState: no history at all also reads as "new"', () => {
  const state = computeCompanionState({});
  assert.equal(state.trend, 'new');
});

test('computeCompanionState: a rise of 3+ points reads as improving', () => {
  const state = computeCompanionState({
    history: [{ capability: 50, at: 1 }, { capability: 55, at: 2 }],
  });
  assert.equal(state.trend, 'improving');
  assert.equal(state.glow, 'teal');
  assert.match(state.headline, /up 5 points/);
});

test('computeCompanionState: a drop of 3+ points reads as drifting, not alarmist', () => {
  const state = computeCompanionState({
    history: [{ capability: 60, at: 1 }, { capability: 54, at: 2 }],
  });
  assert.equal(state.trend, 'drifting');
  assert.equal(state.glow, 'brick');
  assert.match(state.headline, /dipped 6 points/);
});

test('computeCompanionState: a change under the threshold reads as steady', () => {
  const state = computeCompanionState({
    history: [{ capability: 60, at: 1 }, { capability: 61, at: 2 }],
  });
  assert.equal(state.trend, 'steady');
  assert.equal(state.glow, 'slate');
});

test('computeCompanionState: with no axis data yet, detail says so rather than guessing', () => {
  const state = computeCompanionState({
    history: [{ capability: 50, at: 1 }, { capability: 55, at: 2 }],
  });
  assert.match(state.detail, /make a few more sandbox decisions/i);
});

test('computeCompanionState: axes with too few decisions are excluded from the pick', () => {
  const state = computeCompanionState({
    history: [{ capability: 50, at: 1 }, { capability: 55, at: 2 }],
    axisConsistency: { risk_disposition: { count: 1, variance: 900, avg_wellbeing: 50 } },
  });
  assert.match(state.detail, /make a few more sandbox decisions/i);
});

test('computeCompanionState: picks the highest-variance axis with enough decisions', () => {
  const state = computeCompanionState({
    history: [{ capability: 50, at: 1 }, { capability: 55, at: 2 }],
    axisConsistency: {
      risk_disposition: { count: 4, variance: 900, avg_wellbeing: 50 },
      impulse_regulation: { count: 5, variance: 40, avg_wellbeing: 60 },
    },
  });
  // AXES isn't loaded in this Node test, so it falls back to the raw key.
  assert.match(state.detail, /risk_disposition/);
});

test('computeCompanionState: a drifting trend phrases the axis detail as worth a look, not a failure', () => {
  const state = computeCompanionState({
    history: [{ capability: 60, at: 1 }, { capability: 54, at: 2 }],
    axisConsistency: { risk_disposition: { count: 4, variance: 900, avg_wellbeing: 50 } },
  });
  assert.match(state.detail, /first place a dip/);
});
