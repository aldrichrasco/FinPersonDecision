// Six-axis Financial Behavioural Model (FBM) — the personalisation core.
//
// Each axis is a bipolar dimension scored 0-100. The quiz scores all six;
// the resulting profile (a) matches the nearest of the eleven archetypes and
// (b) drives which scenarios and coaching the learner sees. This is the PIPE
// "Personalisation" tenet made concrete.
//
// The six axes are the study's own synthesized framework. Each carries a
// short plain-language subtitle for users; formal definitions and citations
// live in the paper, not here.
//
// EASILY EDITABLE: rename an axis or change its poles in AXES; adjust an
// archetype's target profile in ARCHETYPE_PROFILES. Scoring, matching, and
// the capability index all read from here.

const AXES = {
  impulse_regulation:   { label: "Impulse Regulation",         sub: "How deliberately you spend",        low: "Impulsive",    high: "Deliberate" },
  risk_disposition:     { label: "Risk Disposition",           sub: "Your comfort with financial risk",  low: "Risk-averse",  high: "Risk-tolerant" },
  temporal_orientation: { label: "Temporal Orientation",       sub: "How far ahead you plan",            low: "Short-term",   high: "Long-term" },
  financial_attentiveness:{ label: "Financial Attentiveness",  sub: "How closely you watch your money",  low: "Avoidant",     high: "Attentive" },
  financial_self_efficacy:{ label: "Financial Self-Efficacy",  sub: "How in-control you feel",           low: "Anxious",      high: "Confident" },
  prosocial_orientation:{ label: "Prosocial Orientation",      sub: "How much you allocate to others",   low: "Self-directed",high: "Other-directed" },
};

const AXIS_KEYS = Object.keys(AXES);

// Maps a scenario's `surface` (the ~10 presentation types already used by
// idm.js for cross-surface transfer tracking) to the FBM axis it primarily
// probes. Internal/analytics use only — never shown to the user mid-decision,
// it just tags logged choices so later analysis can ask "which decisions
// actually move which axis." One surface -> one axis keeps this a lookup,
// not a per-scenario tagging job across dozens of scenario objects.
const SURFACE_AXIS = {
  credit_card: "impulse_regulation",
  bnpl: "impulse_regulation",
  overdraft: "financial_attentiveness",
  subscription: "financial_attentiveness",
  family_loan: "prosocial_orientation",
  business_loan: "risk_disposition",
  opportunity: "risk_disposition",
  windfall: "temporal_orientation",
  shortfall: "financial_self_efficacy",
  obligation: "temporal_orientation",
};

// Target profile per archetype: where each archetype sits on each axis.
// Matching finds the archetype whose profile is nearest the learner's.
const ARCHETYPE_PROFILES = {
  steady_saver:            { impulse_regulation: 80, risk_disposition: 25, temporal_orientation: 75, financial_attentiveness: 70, financial_self_efficacy: 70, prosocial_orientation: 50 },
  cautious_guardian:       { impulse_regulation: 75, risk_disposition: 10, temporal_orientation: 70, financial_attentiveness: 75, financial_self_efficacy: 55, prosocial_orientation: 45 },
  conscious_spender:       { impulse_regulation: 70, risk_disposition: 40, temporal_orientation: 60, financial_attentiveness: 70, financial_self_efficacy: 65, prosocial_orientation: 55 },
  ambitious_builder:       { impulse_regulation: 60, risk_disposition: 70, temporal_orientation: 85, financial_attentiveness: 75, financial_self_efficacy: 75, prosocial_orientation: 45 },
  strategic_risk_taker:    { impulse_regulation: 60, risk_disposition: 80, temporal_orientation: 70, financial_attentiveness: 80, financial_self_efficacy: 75, prosocial_orientation: 45 },
  overconfident_navigator: { impulse_regulation: 45, risk_disposition: 75, temporal_orientation: 50, financial_attentiveness: 45, financial_self_efficacy: 85, prosocial_orientation: 45 },
  status_seeker:           { impulse_regulation: 30, risk_disposition: 60, temporal_orientation: 40, financial_attentiveness: 50, financial_self_efficacy: 70, prosocial_orientation: 40 },
  impulsive_spender:       { impulse_regulation: 15, risk_disposition: 55, temporal_orientation: 25, financial_attentiveness: 45, financial_self_efficacy: 55, prosocial_orientation: 50 },
  anxious_avoider:         { impulse_regulation: 50, risk_disposition: 25, temporal_orientation: 45, financial_attentiveness: 15, financial_self_efficacy: 20, prosocial_orientation: 45 },
  passive_drifter:         { impulse_regulation: 45, risk_disposition: 40, temporal_orientation: 25, financial_attentiveness: 25, financial_self_efficacy: 40, prosocial_orientation: 45 },
  purposeful_giver:        { impulse_regulation: 65, risk_disposition: 40, temporal_orientation: 60, financial_attentiveness: 65, financial_self_efficacy: 60, prosocial_orientation: 90 },
};

// A neutral starting profile (all midpoints).
function neutralProfile() {
  const p = {};
  AXIS_KEYS.forEach(k => (p[k] = 50));
  return p;
}

// Clamp helper.
function clamp01to100(n) {
  return Math.max(0, Math.min(100, n));
}

// Euclidean distance between a profile and a named archetype's target
// profile, across the six axes. This is the core "how far from the
// archetype" measurement — used both to pick the nearest archetype (below)
// and, post-match, to see how far the person still sits from their own
// archetype's typical pattern (per-axis gaps drive which Learn modules
// surface as weaknesses; see axisGapsToArchetype).
function distanceToArchetype(profile, slug) {
  const target = ARCHETYPE_PROFILES[slug];
  if (!target) return null;
  let sum = 0;
  for (const k of AXIS_KEYS) {
    const d = (profile[k] ?? 50) - target[k];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

// Per-axis signed gap to a named archetype's target profile. Positive means
// the person's raw score on that axis sits ABOVE the archetype's typical
// value; negative means below. Magnitude (not sign) is what ranks "weakness"
// for Learn module ordering — the direction just explains which way.
function axisGapsToArchetype(profile, slug) {
  const target = ARCHETYPE_PROFILES[slug];
  const gaps = {};
  if (!target) return gaps;
  for (const k of AXIS_KEYS) {
    gaps[k] = (profile[k] ?? 50) - target[k];
  }
  return gaps;
}

// Largest possible distance across six 0-100 axes — used to normalize
// distanceToArchetype into a 0-100 "closeness" reading for display.
const MAX_ARCHETYPE_DISTANCE = Math.sqrt(AXIS_KEYS.length * 100 * 100);

function archetypeCloseness(profile, slug) {
  const dist = distanceToArchetype(profile, slug);
  if (dist === null) return null;
  return Math.round(Math.max(0, 100 - (dist / MAX_ARCHETYPE_DISTANCE) * 100));
}

// Nearest-archetype match by Euclidean distance across the six axes.
function matchArchetype(profile) {
  let best = null;
  let bestDist = Infinity;
  for (const slug of Object.keys(ARCHETYPE_PROFILES)) {
    const dist = distanceToArchetype(profile, slug);
    if (dist < bestDist) {
      bestDist = dist;
      best = slug;
    }
  }
  return best;
}

// Financial Capability Index (0-100): the trackable headline number for the
// Evolution tenet. It's the mean of the four axes that represent developable
// capability; risk disposition and prosocial orientation are treated as
// dispositional (neutral) rather than capability, so they're excluded and
// can't inflate or deflate the score. This is what we re-measure over time.
const CAPABILITY_AXES = ["impulse_regulation", "temporal_orientation", "financial_attentiveness", "financial_self_efficacy"];

function capabilityIndex(profile) {
  const vals = CAPABILITY_AXES.map(k => profile[k] ?? 50);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Human-readable read of where each axis sits.
function describeAxis(key, value) {
  const a = AXES[key];
  if (value >= 66) return `${a.high.toLowerCase()}`;
  if (value <= 33) return `${a.low.toLowerCase()}`;
  return "balanced";
}
