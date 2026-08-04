// Which roadmap levels (roadmap-data.js) train which behavioral axis
// (fbm.js's AXIS_KEYS). Deliberately partial: only levels that are
// genuinely a rep of a specific behavioral pattern are tagged — one-off
// orientation steps (the quiz itself, reading a Learn lesson, visiting
// Progress, talking to the coach, the international retirement-systems
// page) aren't "practice," so they're left out rather than force-fit.
//
// prosocial_orientation only maps to one level (decision-scenario) —
// that's honest, not a bug: no calculator here touches giving/generosity,
// and the sandbox's "generous" choice flavor is the one place that axis
// is actually exercised.
const LEVEL_AXIS_TAGS = {
  payday: ["impulse_regulation"],
  autotitle: ["impulse_regulation"],
  bnpl: ["impulse_regulation"],
  latte: ["impulse_regulation"],
  "crypto-impulse": ["impulse_regulation", "risk_disposition"],
  "full-crypto-session": ["impulse_regulation", "risk_disposition"],
  deferred: ["financial_attentiveness"],
  minpayment: ["financial_attentiveness"],
  fees: ["financial_attentiveness"],
  debt: ["financial_attentiveness", "financial_self_efficacy"],
  emergency: ["temporal_orientation", "risk_disposition"],
  goal: ["temporal_orientation", "financial_self_efficacy"],
  growth: ["temporal_orientation"],
  "decision-scenario": ["impulse_regulation", "risk_disposition", "temporal_orientation", "prosocial_orientation"],
};

function levelsForAxis(axis) {
  return Object.keys(LEVEL_AXIS_TAGS).filter(id => LEVEL_AXIS_TAGS[id].includes(axis));
}

// Ranks axes by training priority: axes already classified "growth" (see
// learn.js's learnStatusForAxis — raw score <= 33) come first, sorted by
// how far they sit from the person's own matched archetype (biggest gap
// first); any remaining axes follow, same gap-based ordering, so there's
// always a next axis to suggest even for someone with no axis below the
// growth threshold. Caller supplies gaps/statuses (from fbm.js/learn.js's
// existing functions) rather than this file depending on them directly,
// so the ranking itself stays pure and unit-testable.
function rankAxesByPriority(axisKeys, gaps, statuses) {
  const byGapDesc = (a, b) => Math.abs(gaps[b] ?? 0) - Math.abs(gaps[a] ?? 0);
  const growthAxes = axisKeys.filter(k => statuses[k] === "growth").sort(byGapDesc);
  const rest = axisKeys.filter(k => statuses[k] !== "growth").sort(byGapDesc);
  return [...growthAxes, ...rest];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LEVEL_AXIS_TAGS, levelsForAxis, rankAxesByPriority };
}
