const test = require('node:test');
const assert = require('node:assert/strict');
const { AXIS_KEYS } = require('../fbm.js');
const { QUIZ_QUESTIONS } = require('../quiz.js');

// A question is "balanced" when its options' deltas for a given axis sum
// close to zero — otherwise every random or mixed answer pattern
// systematically drags that axis in one direction regardless of what the
// person actually meant, which is exactly what happened here: prosocial
// bias alone was +45.5 across the quiz, which sent random/mixed answers to
// Purposeful Giver ~4x more often than a fair 1-in-11 (see the "make the
// logic work" investigation this fixed). Bounds below are deliberately
// generous — the goal is to catch a severe regression like that one
// again, not to demand a mathematically perfect quiz.
const MAX_TOTAL_AXIS_BIAS = 20;

function totalBiasPerAxis() {
  const totals = {};
  AXIS_KEYS.forEach(k => totals[k] = 0);
  QUIZ_QUESTIONS.forEach(q => {
    AXIS_KEYS.forEach(axis => {
      const sum = q.options.reduce((s, o) => s + (o.d && o.d[axis] || 0), 0);
      totals[axis] += sum / q.options.length;
    });
  });
  return totals;
}

test('no axis carries a large systematic bias across the whole quiz', () => {
  const totals = totalBiasPerAxis();
  AXIS_KEYS.forEach(axis => {
    assert.ok(
      Math.abs(totals[axis]) <= MAX_TOTAL_AXIS_BIAS,
      `${axis} total bias is ${totals[axis].toFixed(1)}, exceeding the ${MAX_TOTAL_AXIS_BIAS} cap ` +
      `— a question was likely added with only one directional option and no counterweight.`
    );
  });
});

test('random-answer archetype distribution has no extreme outlier', () => {
  // Simulates picking a uniformly random option on every question many
  // times and checks the resulting archetype spread — a fair quiz should
  // not send more than roughly a quarter of random/mixed answers to any
  // single one of eleven archetypes (an even split would be ~9%).
  const fbm = require('../fbm.js');
  const N = 4000;
  const tally = {};
  Object.keys(fbm.ARCHETYPE_PROFILES).forEach(s => tally[s] = 0);
  for (let i = 0; i < N; i++) {
    const profile = fbm.neutralProfile();
    QUIZ_QUESTIONS.forEach(q => {
      const opt = q.options[Math.floor(Math.random() * q.options.length)];
      Object.entries(opt.d || {}).forEach(([axis, delta]) => {
        profile[axis] = fbm.clamp01to100((profile[axis] ?? 50) + delta);
      });
    });
    tally[fbm.matchArchetype(profile)]++;
  }
  const maxShare = Math.max(...Object.values(tally)) / N;
  assert.ok(
    maxShare <= 0.25,
    `one archetype captured ${(maxShare * 100).toFixed(1)}% of random-answer runs ` +
    `(expected roughly 9% if perfectly even) — the quiz has drifted toward a single archetype again.`
  );
});
