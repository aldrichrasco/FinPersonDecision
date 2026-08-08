// Data layer for the free Financial MRI report (report.html).
//
// Two jobs. First, persist the one thing the app was computing but throwing
// away: the prediction-versus-choice comparison. dlo.js already works out
// whether a decision matched what the person predicted, but that only went
// to telemetry, so nothing could ever read it back and the report's central
// finding had no source. recordMriDecision fixes that.
//
// Second, derive the report from whatever is actually stored. Every function
// here returns null rather than a plausible-looking default when the
// evidence isn't there, because a report whose whole claim is "this came
// from your real decisions" cannot afford a single invented number. The page
// renders an honest empty state instead.

// Consumer-facing axis names. fbm.js's AXES.short carries the research
// abbreviations ("Efficacy", "Attent."), which are correct for the theory page
// and wrong for a report someone reads about themselves: one is jargon and the
// other is a truncation that looks like a rendering fault.
const MRI_AXIS_NAME = {
  impulse_regulation: "Impulse",
  risk_disposition: "Risk",
  temporal_orientation: "Time",
  financial_attentiveness: "Attention",
  financial_self_efficacy: "Confidence",
  prosocial_orientation: "Giving",
};
function mriAxisName(key) {
  return MRI_AXIS_NAME[key] || (typeof AXES !== "undefined" && AXES[key] ? AXES[key].short : key);
}

const MRI_DECISIONS_KEY = "finperson_mri_decisions";
const MRI_DECISION_CAP = 200;

function getMriDecisions() {
  try {
    const raw = localStorage.getItem(MRI_DECISIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Called from dashboard.js the moment a decision resolves. `predicted` and
// `actual` are choice indices; predicted is null when the person was never
// asked to predict (the probe doesn't fire on every scenario by design).
function recordMriDecision(entry) {
  try {
    const log = getMriDecisions();
    log.push({
      at: Date.now(),
      scenario: String(entry.scenario || "").slice(0, 140),
      choice: String(entry.choice || "").slice(0, 120),
      predicted: typeof entry.predicted === "number" ? entry.predicted : null,
      actual: typeof entry.actual === "number" ? entry.actual : null,
      matched: entry.matched === true,
      timed: entry.timed === true,
      // Whether the countdown actually ran out before they chose. Stronger
      // evidence than the scenario tag, which only says pressure was present.
      expired: entry.expired === true,
      surface: entry.surface || null,
      principle: entry.principle || null,
      netWorthDelta: typeof entry.netWorthDelta === "number" ? entry.netWorthDelta : 0,
      // What the person's own predicted choice would have done to net worth.
      // Needed for the counterfactual and only knowable at decision time,
      // since the alternative choice's delta isn't stored anywhere else.
      predictedNetWorthDelta: typeof entry.predictedNetWorthDelta === "number"
        ? entry.predictedNetWorthDelta : null,
    });
    localStorage.setItem(MRI_DECISIONS_KEY, JSON.stringify(log.slice(-MRI_DECISION_CAP)));
  } catch (e) {}
}

// --- the counterfactual -----------------------------------------------------
// The report's headline. Only decisions where a prediction was actually made
// AND the alternative's effect is known can contribute; anything else is
// excluded rather than assumed to be zero.
function mriPredictionGap() {
  const usable = getMriDecisions().filter(d =>
    d.predicted !== null && d.predictedNetWorthDelta !== null);
  if (usable.length < 3) return null;

  let gap = 0;
  let biggest = null;
  usable.forEach(d => {
    const diff = d.predictedNetWorthDelta - d.netWorthDelta;
    gap += diff;
    if (!biggest || diff > biggest.diff) biggest = { diff, decision: d };
  });

  if (gap <= 0) return null; // nothing to show if their choices did better
  return {
    total: Math.round(gap),
    decisionCount: usable.length,
    biggest: biggest && biggest.diff > 0
      ? { amount: Math.round(biggest.diff), scenario: biggest.decision.scenario,
          choice: biggest.decision.choice }
      : null,
  };
}

// --- the pattern ------------------------------------------------------------
// Splits predicted-versus-actual by whether the scenario carried time
// pressure. This is the finding the whole report is built around, so it needs
// both groups populated before it will claim anything.
function mriTimePressureSplit() {
  const predicted = getMriDecisions().filter(d => d.predicted !== null);
  const timed = predicted.filter(d => d.timed);
  const untimed = predicted.filter(d => !d.timed);
  if (timed.length < 2 || untimed.length < 2) return null;

  const kept = arr => arr.filter(d => d.matched).length;
  const split = {
    timed: { total: timed.length, kept: kept(timed) },
    untimed: { total: untimed.length, kept: kept(untimed) },
  };
  split.timedRate = split.timed.kept / split.timed.total;
  split.untimedRate = split.untimed.kept / split.untimed.total;
  // Only worth calling a pattern if the two groups genuinely differ.
  split.isPattern = (split.untimedRate - split.timedRate) >= 0.25;
  return split;
}

// --- the twin ---------------------------------------------------------------
// Deliberately stated as "matches N of M recorded decisions" rather than an
// accuracy percentage: with a sample this small a percentage invites
// questions about baselines and out-of-sample testing that it cannot answer.
function mriTwinMatch() {
  const predicted = getMriDecisions().filter(d => d.predicted !== null);
  if (predicted.length < 4) return null;
  return { matched: predicted.filter(d => d.matched).length, total: predicted.length };
}

// --- archetype closeness ----------------------------------------------------
// The second-closest archetype becomes the sub-label, which is what stops two
// people with the same headline archetype getting the same report.
function mriArchetypeRanking(profile) {
  if (typeof ARCHETYPE_PROFILES === "undefined") return [];
  return Object.keys(ARCHETYPE_PROFILES)
    .map(slug => ({ slug, closeness: archetypeCloseness(profile, slug) }))
    .filter(r => r.closeness !== null)
    .sort((a, b) => b.closeness - a.closeness);
}

// Describes the profile by its two strongest axes rather than restating one
// score, so the sub-label reads as a configuration and not as "archetype plus
// risk number".
const MRI_CONFIG_WORD = {
  impulse_regulation: "Deliberate",
  risk_disposition: "Opportunity seeking",
  temporal_orientation: "Future-focused",
  financial_attentiveness: "Detail-tracking",
  financial_self_efficacy: "Self-directed",
  prosocial_orientation: "Other-centred",
};
function mriConfigLabel(profile) {
  const top = AXIS_KEYS
    .map(k => ({ k, v: profile[k] ?? 50 }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .map(x => MRI_CONFIG_WORD[x.k])
    .filter(Boolean);
  return top.join(" · ");
}

// --- plain-language tendency lines ------------------------------------------
// One short sentence per axis per band. The report shows these instead of a
// bare score because a number with no sentence attached reads as a grade.
const MRI_TENDENCY_LINES = {
  impulse_regulation: {
    high: "You rarely buy on impulse.",
    mid: "You pause, unless you're rushed.",
    low: "You decide fast and sort it out after.",
  },
  risk_disposition: {
    high: "Comfortable with uncertainty.",
    mid: "You take risk when the case is clear.",
    low: "You protect what you already have.",
  },
  temporal_orientation: {
    high: "You think in years, not weeks.",
    mid: "You plan a few months out.",
    low: "You decide for this week.",
  },
  financial_attentiveness: {
    high: "You watch the detail closely.",
    mid: "You check in, but not closely.",
    low: "You would rather not look.",
  },
  financial_self_efficacy: {
    high: "You back your own judgement.",
    mid: "Mostly confident, sometimes unsure.",
    low: "Money decisions unsettle you.",
  },
  prosocial_orientation: {
    high: "Others come first, often before you.",
    mid: "Generous, within limits you set.",
    low: "You decide for yourself first.",
  },
};
function mriTendencyLine(key, value) {
  const set = MRI_TENDENCY_LINES[key];
  if (!set) return "";
  if (value >= 66) return set.high;
  if (value <= 40) return set.low;
  return set.mid;
}

// --- one interaction --------------------------------------------------------
// Authored per pair, not generated, and only offered when both axes sit in the
// band the copy actually describes. A pair whose conditions aren't met is
// skipped rather than reworded to fit.
const MRI_INTERACTIONS = [
  {
    a: "temporal_orientation", b: "risk_disposition",
    when: p => p.temporal_orientation >= 60 && p.risk_disposition >= 55,
    head: "This pair is why you can hold a risky position without panicking.",
    body: "You are not gambling. You are waiting. A long horizon gives your risk somewhere to land, so uncertainty reads as a period to sit through rather than a threat to escape.",
    contrast: "Someone with your exact Risk score but a short horizon could behave very differently, taking the same position and exiting within a month. The combination is the explanation, not either number.",
  },
  {
    a: "financial_self_efficacy", b: "financial_attentiveness",
    when: p => p.financial_self_efficacy >= 60 && p.financial_attentiveness <= 55,
    head: "Your confidence runs ahead of your attention.",
    body: "You feel in control of numbers you have not actually checked recently. That is comfortable and usually fine, right up until something has moved while you were not looking.",
    contrast: "Confidence built on checking is durable. Confidence built on assuming is not, and from the inside the two feel identical. The gap between these two numbers is the thing to watch.",
  },
  {
    a: "prosocial_orientation", b: "financial_self_efficacy",
    when: p => p.prosocial_orientation >= 60 && p.financial_self_efficacy <= 50,
    head: "You give from obligation more than from strength.",
    body: "Generosity paired with low confidence tends to mean saying yes because no feels impossible, rather than because giving is the choice you wanted to make.",
    contrast: "The same generosity with high confidence looks completely different from the outside and feels completely different from the inside. The pair, not the Giving score, is what distinguishes them.",
  },
  {
    a: "impulse_regulation", b: "temporal_orientation",
    when: p => p.impulse_regulation >= 60 && p.temporal_orientation <= 45,
    head: "You are disciplined without a destination.",
    body: "Strong restraint and a short horizon is an unusual combination. You hold back reliably, but the money that restraint protects has nowhere in particular to go.",
    contrast: "Restraint with a long horizon compounds. Restraint without one tends to just accumulate, and often quietly costs you things worth having now.",
  },
];
function mriInteraction(profile) {
  return MRI_INTERACTIONS.find(i => {
    try { return i.when(profile); } catch (e) { return false; }
  }) || null;
}

// --- confidence -------------------------------------------------------------
// Two inputs: how cleanly the profile lands on one archetype, and how much
// behaviour has actually been observed. Both matter, and a confident-looking
// number from a handful of decisions would be the dishonest version.
function mriConfidence(profile) {
  const ranked = mriArchetypeRanking(profile);
  if (!ranked.length) return null;
  const separation = ranked.length > 1
    ? Math.min(1, (ranked[0].closeness - ranked[1].closeness) / 20) : 1;
  const decisions = getMriDecisions().length;
  const volume = Math.min(1, decisions / 15);
  const score = Math.round((0.45 + 0.30 * separation + 0.25 * volume) * 100);

  // The weakest axes are the ones the report should admit to being unsure
  // about: those closest to the neutral midpoint carry the least signal.
  const weakest = AXIS_KEYS
    .map(k => ({ k, distanceFromNeutral: Math.abs((profile[k] ?? 50) - 50) }))
    .sort((a, b) => a.distanceFromNeutral - b.distanceFromNeutral)
    .slice(0, 2)
    .map(x => AXES[x.k].short);

  return { score: Math.min(96, score), weakest, decisions };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MRI_TENDENCY_LINES, MRI_INTERACTIONS, MRI_CONFIG_WORD };
}
