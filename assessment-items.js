// The Full Assessment — a longer, Likert-scale instrument that sits behind
// the quick quiz, not instead of it. The quick quiz (quiz.js) is the
// free MVP: fast, forced-choice, good enough for a first-pass archetype
// match. This is the "truly check" pass: five statements per axis, rated
// 1 (strongly disagree) to 5 (strongly agree), with roughly half of each
// axis's items reverse-worded — standard survey-design practice so someone
// straight-lining the scale (picking the same number every time) doesn't
// trivially land on a coherent-looking profile. Completing this overwrites
// the same profile the quick quiz writes (see saveProfile() in data.js) —
// it's a more precise pass at the same six numbers, not a separate result.
const ASSESSMENT_ITEMS = [
  { id: "impulse_1", axis: "impulse_regulation", reverse: false, text: "Before a non-essential purchase, I usually wait a day or two before deciding." },
  { id: "impulse_2", axis: "impulse_regulation", reverse: true, text: "I've bought things on the spot that I regretted soon after." },
  { id: "impulse_3", axis: "impulse_regulation", reverse: false, text: "I stick to a spending plan even when something tempting comes up." },
  { id: "impulse_4", axis: "impulse_regulation", reverse: true, text: "If something catches my eye, I tend to buy it before thinking it through." },
  { id: "impulse_5", axis: "impulse_regulation", reverse: false, text: "I rarely make purchases I haven't at least briefly thought about." },

  { id: "risk_1", axis: "risk_disposition", reverse: false, text: "I'm comfortable putting money into something that could lose value, if the upside is real." },
  { id: "risk_2", axis: "risk_disposition", reverse: true, text: "The idea of my savings losing value, even temporarily, makes me uneasy." },
  { id: "risk_3", axis: "risk_disposition", reverse: false, text: "I'd rather take a calculated chance than settle for a guaranteed smaller outcome." },
  { id: "risk_4", axis: "risk_disposition", reverse: true, text: "I avoid financial decisions that carry any real chance of loss." },
  { id: "risk_5", axis: "risk_disposition", reverse: false, text: "Uncertainty about money doesn't bother me much, as long as the odds are reasonable." },

  { id: "temporal_1", axis: "temporal_orientation", reverse: false, text: "I think about my finances in terms of years, not just weeks or months." },
  { id: "temporal_2", axis: "temporal_orientation", reverse: true, text: "It's hard for me to prioritize a future benefit over something I want now." },
  { id: "temporal_3", axis: "temporal_orientation", reverse: false, text: "I have specific financial goals set years out, not just for right now." },
  { id: "temporal_4", axis: "temporal_orientation", reverse: true, text: "Planning that far ahead feels pointless — too much can change." },
  { id: "temporal_5", axis: "temporal_orientation", reverse: false, text: "I regularly make trade-offs today for a better outcome later." },

  { id: "attentive_1", axis: "financial_attentiveness", reverse: false, text: "I know roughly where my money stands without having to check." },
  { id: "attentive_2", axis: "financial_attentiveness", reverse: true, text: "I tend to put off looking at my accounts because it feels uncomfortable." },
  { id: "attentive_3", axis: "financial_attentiveness", reverse: false, text: "I check in on my finances on a regular, predictable schedule." },
  { id: "attentive_4", axis: "financial_attentiveness", reverse: true, text: "There have been stretches where I genuinely didn't know my own balance." },
  { id: "attentive_5", axis: "financial_attentiveness", reverse: false, text: "I notice small changes in my financial situation before they become big ones." },

  { id: "efficacy_1", axis: "financial_self_efficacy", reverse: false, text: "I generally trust my own judgment when it comes to money decisions." },
  { id: "efficacy_2", axis: "financial_self_efficacy", reverse: true, text: "Money decisions make me anxious even when I've thought them through." },
  { id: "efficacy_3", axis: "financial_self_efficacy", reverse: false, text: "When something financial goes wrong, I feel capable of handling it." },
  { id: "efficacy_4", axis: "financial_self_efficacy", reverse: true, text: "I often second-guess financial choices after I've already made them." },
  { id: "efficacy_5", axis: "financial_self_efficacy", reverse: false, text: "I feel in control of my financial situation, even when it's not perfect." },

  { id: "prosocial_1", axis: "prosocial_orientation", reverse: false, text: "Helping others financially is a real priority in how I use my money." },
  { id: "prosocial_2", axis: "prosocial_orientation", reverse: true, text: "My spending decisions are almost entirely about what I want or need." },
  { id: "prosocial_3", axis: "prosocial_orientation", reverse: false, text: "I factor other people's needs into big financial decisions, not just my own." },
  { id: "prosocial_4", axis: "prosocial_orientation", reverse: true, text: "I rarely think about anyone else when deciding how to spend or save." },
  { id: "prosocial_5", axis: "prosocial_orientation", reverse: false, text: "Giving or supporting others financially is part of how I think about money." },
];

const ASSESSMENT_SCALE = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

// responses: { [itemId]: rating 1-5 }. Unanswered items are simply excluded
// from that axis's average rather than defaulted to neutral — a
// half-finished assessment shouldn't quietly drag every axis toward 50.
function scoreAssessmentResponses(responses) {
  const r = responses || {};
  const sums = {}, counts = {};
  ASSESSMENT_ITEMS.forEach(item => {
    const rating = r[item.id];
    if (typeof rating !== "number" || rating < 1 || rating > 5) return;
    const contribution = item.reverse ? ((5 - rating) / 4) * 100 : ((rating - 1) / 4) * 100;
    sums[item.axis] = (sums[item.axis] || 0) + contribution;
    counts[item.axis] = (counts[item.axis] || 0) + 1;
  });
  const profile = {};
  const AXES_LIST = typeof AXIS_KEYS !== "undefined" ? AXIS_KEYS
    : [...new Set(ASSESSMENT_ITEMS.map(i => i.axis))];
  AXES_LIST.forEach(axis => {
    profile[axis] = counts[axis] ? Math.round(sums[axis] / counts[axis]) : 50;
  });
  return profile;
}

function assessmentAnsweredCount(responses) {
  const r = responses || {};
  return ASSESSMENT_ITEMS.filter(item => typeof r[item.id] === "number").length;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ASSESSMENT_ITEMS, ASSESSMENT_SCALE, scoreAssessmentResponses, assessmentAnsweredCount,
  };
}
