const test = require('node:test');
const assert = require('node:assert/strict');
const { projectGoalCompletion } = require('../goal-projection.js');

const NOW = new Date(2026, 0, 15).getTime(); // Jan 15, 2026

test('divides remaining amount by monthly pace, rounding up', () => {
  const goal = { targetAmount: 1000, savedAmount: 200 };
  const result = projectGoalCompletion(goal, 100, NOW);
  assert.equal(result.remaining, 800);
  assert.equal(result.monthsToGoal, 8);
});

test('rounds a partial month up rather than down', () => {
  const goal = { targetAmount: 1000, savedAmount: 0 };
  const result = projectGoalCompletion(goal, 300, NOW); // 3.33 months
  assert.equal(result.monthsToGoal, 4);
});

test('a goal already at or past its target needs zero months', () => {
  const goal = { targetAmount: 500, savedAmount: 500 };
  const result = projectGoalCompletion(goal, 50, NOW);
  assert.equal(result.monthsToGoal, 0);
  assert.equal(result.remaining, 0);
});

test('projected date advances by the right number of months', () => {
  const goal = { targetAmount: 600, savedAmount: 0 };
  const result = projectGoalCompletion(goal, 200, NOW); // 3 months
  assert.equal(result.projectedDate.getFullYear(), 2026);
  assert.equal(result.projectedDate.getMonth(), 3); // April (0-indexed)
});

test('a goal with no target amount cannot be projected', () => {
  assert.equal(projectGoalCompletion({ targetAmount: null, savedAmount: 0 }, 100, NOW), null);
  assert.equal(projectGoalCompletion({ targetAmount: 0, savedAmount: 0 }, 100, NOW), null);
});

test('a zero or negative monthly amount cannot be projected', () => {
  const goal = { targetAmount: 1000, savedAmount: 0 };
  assert.equal(projectGoalCompletion(goal, 0, NOW), null);
  assert.equal(projectGoalCompletion(goal, -50, NOW), null);
});

test('a missing goal returns null rather than throwing', () => {
  assert.equal(projectGoalCompletion(null, 100, NOW), null);
});
