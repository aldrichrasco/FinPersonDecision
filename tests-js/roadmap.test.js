const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRoadmapProgress, roadmapXpForLevel, bumpRoadmapStreak, roadmapTierStatus, levelXpFromTiers,
} = require('../roadmap.js');

const TIERS = [
  { id: "t1", levels: [{ id: "a", xp: 10 }, { id: "b", xp: 10 }] },
  { id: "t2", levels: [{ id: "c", xp: 10 }, { id: "d", xp: 20 }] },
  { id: "t3", levels: [{ id: "e", xp: 10 }] },
];

test('normalizeRoadmapProgress: fills in defaults for a missing/malformed blob', () => {
  const p = normalizeRoadmapProgress(null);
  assert.deepEqual(p.completed, []);
  assert.equal(p.xp, 0);
  assert.equal(p.streak, 0);
  assert.equal(p.lastActivityDate, null);
});

test('normalizeRoadmapProgress: preserves valid fields', () => {
  const p = normalizeRoadmapProgress({ completed: ["a", "b"], xp: 40, streak: 3, lastActivityDate: "2026-01-01" });
  assert.deepEqual(p.completed, ["a", "b"]);
  assert.equal(p.xp, 40);
  assert.equal(p.streak, 3);
});

test('roadmapXpForLevel: 0 XP is level 1, 0% into the next level', () => {
  const r = roadmapXpForLevel(0);
  assert.equal(r.level, 1);
  assert.equal(r.into, 0);
  assert.equal(r.pct, 0);
});

test('roadmapXpForLevel: exactly 50 XP is level 2', () => {
  const r = roadmapXpForLevel(50);
  assert.equal(r.level, 2);
  assert.equal(r.into, 0);
});

test('roadmapXpForLevel: 75 XP is level 2, halfway to level 3', () => {
  const r = roadmapXpForLevel(75);
  assert.equal(r.level, 2);
  assert.equal(r.into, 25);
  assert.equal(r.pct, 50);
});

test('bumpRoadmapStreak: first activity ever starts the streak at 1', () => {
  const p = { streak: 0, lastActivityDate: null };
  bumpRoadmapStreak(p, "2026-01-05", "2026-01-04");
  assert.equal(p.streak, 1);
  assert.equal(p.lastActivityDate, "2026-01-05");
});

test('bumpRoadmapStreak: activity on the consecutive next day increments the streak', () => {
  const p = { streak: 4, lastActivityDate: "2026-01-04" };
  bumpRoadmapStreak(p, "2026-01-05", "2026-01-04");
  assert.equal(p.streak, 5);
});

test('bumpRoadmapStreak: a gap resets the streak to 1', () => {
  const p = { streak: 5, lastActivityDate: "2026-01-01" };
  bumpRoadmapStreak(p, "2026-01-05", "2026-01-04"); // 4-day gap
  assert.equal(p.streak, 1);
});

test('bumpRoadmapStreak: a second activity the same day does not double-count', () => {
  const p = { streak: 2, lastActivityDate: "2026-01-05" };
  bumpRoadmapStreak(p, "2026-01-05", "2026-01-04");
  assert.equal(p.streak, 2);
});

test('roadmapTierStatus: tier 1 is always unlocked', () => {
  const status = roadmapTierStatus(TIERS, []);
  assert.equal(status[0].unlocked, true);
});

test('roadmapTierStatus: a later tier stays locked until the previous tier is fully complete', () => {
  const status = roadmapTierStatus(TIERS, ["a"]); // t1 only half done
  assert.equal(status[1].unlocked, false);
});

test('roadmapTierStatus: completing every level in a tier unlocks the next one', () => {
  const status = roadmapTierStatus(TIERS, ["a", "b"]); // t1 fully done
  assert.equal(status[0].complete, true);
  assert.equal(status[1].unlocked, true);
  assert.equal(status[2].unlocked, false); // t2 still incomplete
});

test('roadmapTierStatus: counts done/total correctly per tier', () => {
  const status = roadmapTierStatus(TIERS, ["a", "b", "c"]);
  assert.equal(status[1].done, 1);
  assert.equal(status[1].total, 2);
});

test('levelXpFromTiers: finds the xp value for a known level id', () => {
  assert.equal(levelXpFromTiers(TIERS, "d"), 20);
  assert.equal(levelXpFromTiers(TIERS, "a"), 10);
});

test('levelXpFromTiers: falls back to 10 for an unknown level id', () => {
  assert.equal(levelXpFromTiers(TIERS, "nonexistent"), 10);
});
