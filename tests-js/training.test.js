const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TRAINING_REVIEW_INTERVALS_DAYS, normalizeTrainingProgress, nextTrainingDueAt, isTrainingDue,
} = require('../training.js');
const { LEVEL_AXIS_TAGS, levelsForAxis, rankAxesByPriority } = require('../training-data.js');

test('normalizeTrainingProgress: a missing/malformed blob becomes an empty object', () => {
  assert.deepEqual(normalizeTrainingProgress(null), {});
  assert.deepEqual(normalizeTrainingProgress([1, 2]), {});
});

test('normalizeTrainingProgress: preserves a valid per-level blob', () => {
  const p = { payday: { repCount: 2, dueAt: 123 } };
  assert.deepEqual(normalizeTrainingProgress(p), p);
});

test('nextTrainingDueAt: first rep uses the shortest interval', () => {
  const now = 1_700_000_000_000;
  const due = nextTrainingDueAt(1, now);
  assert.equal(due, now + TRAINING_REVIEW_INTERVALS_DAYS[0] * 86400000);
});

test('nextTrainingDueAt: each successive rep uses a longer interval', () => {
  const now = 1_700_000_000_000;
  const due1 = nextTrainingDueAt(1, now);
  const due2 = nextTrainingDueAt(2, now);
  const due3 = nextTrainingDueAt(3, now);
  assert.ok(due2 - now > due1 - now);
  assert.ok(due3 - now > due2 - now);
});

test('nextTrainingDueAt: caps at the ladder\'s longest interval past its length', () => {
  const now = 1_700_000_000_000;
  const dueAtLadderEnd = nextTrainingDueAt(TRAINING_REVIEW_INTERVALS_DAYS.length, now);
  const dueBeyondLadder = nextTrainingDueAt(TRAINING_REVIEW_INTERVALS_DAYS.length + 5, now);
  assert.equal(dueAtLadderEnd, dueBeyondLadder);
});

test('isTrainingDue: no entry at all counts as due (never reviewed)', () => {
  assert.equal(isTrainingDue(undefined, Date.now()), true);
});

test('isTrainingDue: a future dueAt is not due yet', () => {
  const now = 1_700_000_000_000;
  assert.equal(isTrainingDue({ dueAt: now + 86400000 }, now), false);
});

test('isTrainingDue: a past dueAt is due', () => {
  const now = 1_700_000_000_000;
  assert.equal(isTrainingDue({ dueAt: now - 1 }, now), true);
});

test('LEVEL_AXIS_TAGS: every axis has at least one tagged level (no silent gaps)', () => {
  const AXIS_KEYS = ["impulse_regulation", "risk_disposition", "temporal_orientation",
    "financial_attentiveness", "financial_self_efficacy", "prosocial_orientation"];
  for (const axis of AXIS_KEYS) {
    assert.ok(levelsForAxis(axis).length > 0, `no level tagged for ${axis}`);
  }
});

test('levelsForAxis: returns exactly the levels tagged with that axis', () => {
  const impulseLevels = levelsForAxis("impulse_regulation");
  assert.ok(impulseLevels.includes("payday"));
  assert.ok(!impulseLevels.includes("fees"));
});

test('rankAxesByPriority: a "growth" axis ranks above a "strength" axis regardless of gap size', () => {
  const axisKeys = ["a", "b"];
  const gaps = { a: 5, b: 40 }; // b has a much bigger gap...
  const statuses = { a: "growth", b: "strength" }; // ...but a is the growth axis
  const ranked = rankAxesByPriority(axisKeys, gaps, statuses);
  assert.equal(ranked[0], "a");
});

test('rankAxesByPriority: within the same status, bigger gap ranks first', () => {
  const axisKeys = ["a", "b", "c"];
  const gaps = { a: 5, b: 40, c: 20 };
  const statuses = { a: "growth", b: "growth", c: "growth" };
  const ranked = rankAxesByPriority(axisKeys, gaps, statuses);
  assert.deepEqual(ranked, ["b", "c", "a"]);
});

test('rankAxesByPriority: with no growth axes at all, falls back to gap-ranked order', () => {
  const axisKeys = ["a", "b"];
  const gaps = { a: 10, b: 30 };
  const statuses = { a: "balanced", b: "strength" };
  const ranked = rankAxesByPriority(axisKeys, gaps, statuses);
  assert.deepEqual(ranked, ["b", "a"]);
});
