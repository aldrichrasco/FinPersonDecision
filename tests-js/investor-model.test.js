const test = require('node:test');
const assert = require('node:assert/strict');
const {
  INVESTOR_AXIS_KEYS, INVESTOR_PROFILES, INVESTOR_SLUGS,
  clampInvestor01to100, distanceToInvestor, matchInvestorArchetype,
} = require('../investor-model.js');

test('clampInvestor01to100 clamps to [0, 100]', () => {
  assert.equal(clampInvestor01to100(-10), 0);
  assert.equal(clampInvestor01to100(150), 100);
  assert.equal(clampInvestor01to100(42), 42);
});

test('every profile equals its own archetype exactly (0 distance)', () => {
  for (const slug of INVESTOR_SLUGS) {
    assert.equal(distanceToInvestor(INVESTOR_PROFILES[slug], slug), 0);
  }
});

test('matchInvestorArchetype finds the exact archetype when the profile equals its target', () => {
  for (const slug of INVESTOR_SLUGS) {
    assert.equal(matchInvestorArchetype(INVESTOR_PROFILES[slug]), slug);
  }
});

test('every archetype has all six axes and no stray keys', () => {
  for (const slug of INVESTOR_SLUGS) {
    const profile = INVESTOR_PROFILES[slug];
    for (const key of INVESTOR_AXIS_KEYS) {
      assert.ok(typeof profile[key] === 'number', `${slug} missing numeric ${key}`);
      assert.ok(profile[key] >= 0 && profile[key] <= 100, `${slug}.${key} out of range`);
    }
  }
});

test('every archetype pair is separated by a non-trivial margin', () => {
  let minDist = Infinity;
  for (let i = 0; i < INVESTOR_SLUGS.length; i++) {
    for (let j = i + 1; j < INVESTOR_SLUGS.length; j++) {
      const d = distanceToInvestor(INVESTOR_PROFILES[INVESTOR_SLUGS[i]], INVESTOR_SLUGS[j]);
      minDist = Math.min(minDist, d);
    }
  }
  // Out of a max possible distance of sqrt(6 * 100^2) ≈ 244.9 — a quiz
  // that can't reliably tell two archetypes apart isn't a useful match.
  assert.ok(minDist > 30, `min pairwise distance too small: ${minDist}`);
});
