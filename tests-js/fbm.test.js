const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AXIS_KEYS, ARCHETYPE_PROFILES,
  clamp01to100, distanceToArchetype, matchArchetype, capabilityIndex, axisGapsToArchetype,
} = require('../fbm.js');

test('clamp01to100 clamps to [0, 100]', () => {
  assert.equal(clamp01to100(-5), 0);
  assert.equal(clamp01to100(105), 100);
  assert.equal(clamp01to100(50), 50);
});

test('distanceToArchetype is 0 for a profile identical to the target', () => {
  const dist = distanceToArchetype(ARCHETYPE_PROFILES.steady_saver, 'steady_saver');
  assert.equal(dist, 0);
});

test('distanceToArchetype returns null for an unknown archetype', () => {
  assert.equal(distanceToArchetype(ARCHETYPE_PROFILES.steady_saver, 'not_a_real_slug'), null);
});

test('matchArchetype finds the exact archetype when the profile equals its target', () => {
  for (const slug of Object.keys(ARCHETYPE_PROFILES)) {
    assert.equal(matchArchetype(ARCHETYPE_PROFILES[slug]), slug);
  }
});

test('capabilityIndex of an all-50 profile is 50', () => {
  const neutral = {};
  AXIS_KEYS.forEach(k => (neutral[k] = 50));
  assert.equal(capabilityIndex(neutral), 50);
});

test('axisGapsToArchetype: positive gap means the profile sits above the target', () => {
  const above = { ...ARCHETYPE_PROFILES.steady_saver, risk_disposition: ARCHETYPE_PROFILES.steady_saver.risk_disposition + 10 };
  const gaps = axisGapsToArchetype(above, 'steady_saver');
  assert.equal(gaps.risk_disposition, 10);
});
