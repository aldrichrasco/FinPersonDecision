const test = require('node:test');
const assert = require('node:assert/strict');
global.AXIS_KEYS = [
  "impulse_regulation", "risk_disposition", "temporal_orientation",
  "financial_attentiveness", "financial_self_efficacy", "prosocial_orientation",
];
const { ASSESSMENT_ITEMS, scoreAssessmentResponses, assessmentAnsweredCount } = require('../assessment-items.js');

test('every axis has exactly five items, matching AXIS_KEYS', () => {
  const byAxis = {};
  ASSESSMENT_ITEMS.forEach(i => { byAxis[i.axis] = (byAxis[i.axis] || 0) + 1; });
  assert.deepEqual(Object.keys(byAxis).sort(), global.AXIS_KEYS.slice().sort());
  Object.values(byAxis).forEach(count => assert.equal(count, 5));
});

test('answering every direct item 5 and every reverse item 1 gives a 100 on that axis', () => {
  const responses = {};
  ASSESSMENT_ITEMS.filter(i => i.axis === "risk_disposition").forEach(i => {
    responses[i.id] = i.reverse ? 1 : 5;
  });
  const profile = scoreAssessmentResponses(responses);
  assert.equal(profile.risk_disposition, 100);
});

test('answering every direct item 1 and every reverse item 5 gives a 0 on that axis', () => {
  const responses = {};
  ASSESSMENT_ITEMS.filter(i => i.axis === "impulse_regulation").forEach(i => {
    responses[i.id] = i.reverse ? 5 : 1;
  });
  const profile = scoreAssessmentResponses(responses);
  assert.equal(profile.impulse_regulation, 0);
});

test('a neutral (3) answer on every item gives 50 on every axis', () => {
  const responses = {};
  ASSESSMENT_ITEMS.forEach(i => { responses[i.id] = 3; });
  const profile = scoreAssessmentResponses(responses);
  Object.values(profile).forEach(v => assert.equal(v, 50));
});

test('an axis with no answered items defaults to 50, not 0', () => {
  const profile = scoreAssessmentResponses({});
  assert.equal(profile.prosocial_orientation, 50);
});

test('assessmentAnsweredCount only counts valid numeric ratings', () => {
  const responses = { impulse_1: 4, impulse_2: 2, risk_1: "not a number", risk_2: null };
  assert.equal(assessmentAnsweredCount(responses), 2);
});

test('an out-of-range rating is excluded from scoring, same as missing', () => {
  const responses = { impulse_1: 99 };
  const profile = scoreAssessmentResponses(responses);
  assert.equal(profile.impulse_regulation, 50);
});
