// Internal Decision Model (IDM).
//
// The object the artefact regulates. Distinct from disposition (how a person
// tends to behave) and from behaviour (what they did): the IDM is what they
// BELIEVE about how money works — beliefs, heuristics, assumptions, priorities
// and causal reasoning.
//
// Deliberately not "misconception". Many capability decisions involve competing
// valid models rather than one wrong belief ("pay down the mortgage or invest?"
// has no single right answer). An IDM entry is a *stance* that may be
// well-calibrated or poorly calibrated against outcomes, not a fact to correct.
//
// THE CENTRAL CLAIM THIS SUPPORTS
// Capability develops as calibration relocates from post-hoc to anticipatory.
// Knowing you were wrong afterwards produces regret. Knowing before you act
// produces different action. The C-levels below measure that relocation.

// --- Decision models --------------------------------------------------------
// Each is probe-able by scenarios and expressible as a prediction the world
// can contradict. `counter` is the experience that would create disequilibrium.
const DECISION_MODELS = {
  catch_up_later: {
    label: "I can catch up later",
    stance: "Shortfalls now can be recovered later without compounding cost.",
    counter: "Deferred costs recur or accrue, and the gap widens rather than closes.",
    relatedAxes: ["temporal_orientation", "impulse_regulation"],
    blurb: "People don't just prefer rewards now over rewards later — they systematically prefer to bear a cost 'next period' rather than this one, no matter which period is actually current. That's why 'later' rarely arrives: once later becomes now, the same preference pushes the cost forward again.",
    citation: "O'Donoghue & Rabin (1999) on present-biased preferences and why 'later' keeps losing to 'now.'",
  },
  credit_is_free: {
    label: "Credit is free if I clear it",
    stance: "Borrowing is costless provided the balance is repaid.",
    counter: "Credit shifts fragility forward even when repaid, and repayment intentions frequently fail.",
    relatedAxes: ["impulse_regulation"],
    blurb: "Spending hurts less when the payment is decoupled from the purchase — the 'pain of paying' is a real, measurable psychological cost, and credit is specifically designed to defer and soften it. The bill still arrives; the discomfort that would normally make you hesitate just doesn't.",
    citation: "Prelec & Loewenstein (1998) on how payment method decouples the cost of spending from the pain of paying.",
  },
  more_saved_is_better: {
    label: "More saved is always better",
    stance: "Accumulation is monotonically good; spending is always a loss.",
    counter: "Beyond a point, accumulation costs present life without adding security.",
    relatedAxes: ["risk_disposition", "temporal_orientation"],
    blurb: "There's a documented mirror image of overspending regret: 'hyperopia,' where people who denied themselves too consistently come to regret the missed present just as much as impulsive spenders regret their splurges. Saving isn't the failure mode this belief assumes has no ceiling.",
    citation: "Kivetz & Keinan (2006) on 'hyperopia' — regretting excessive self-denial as much as excessive indulgence.",
  },
  id_notice: {
    label: "I'd notice if things got bad",
    stance: "Deterioration would be obvious enough to act on in time.",
    counter: "Decline is gradual and attention is what erodes first.",
    relatedAxes: ["financial_attentiveness", "financial_self_efficacy"],
    blurb: "Investors check their portfolios measurably less often specifically when markets are down — the exact moment 'I'd notice' is supposed to kick in. The belief fails precisely when it would matter most, because attention itself is what erodes under stress, not just resolve.",
    citation: "Karlsson, Loewenstein & Seppi (2009) on the 'ostrich effect' — selectively avoiding information when things may be bad.",
  },
  this_time_different: {
    label: "This time is different",
    stance: "The usual pattern doesn't apply to this particular case.",
    counter: "The pattern recurs across surfaces that look unrelated.",
    relatedAxes: ["risk_disposition", "financial_self_efficacy"],
    blurb: "A review of eight centuries of financial crises found the same belief — that this instance is structurally exempt from the usual pattern — showing up right before nearly all of them. The belief isn't a sign of unique circumstances; it's one of the most reliable warning signs there is.",
    citation: "Reinhart & Rogoff (2009), \"This Time Is Different\" — eight centuries of the same belief preceding the same kind of trouble.",
  },
  others_first: {
    label: "Others' needs come before my base",
    stance: "Giving should not be constrained by one's own provisioning.",
    counter: "A depleted base reduces the capacity to help at all.",
    relatedAxes: ["prosocial_orientation"],
    blurb: "Giving produces its own immediate, genuine good feeling — a 'warm glow' distinct from the actual outcome for the person you're helping. That feeling is real, but it isn't a signal about whether the giving is sustainable; it fires the same way whether or not your own base can absorb it.",
    citation: "Andreoni (1990) on warm-glow giving — the immediate good feeling of giving doesn't track whether it's sustainable.",
  },
  waiting_is_safe: {
    label: "Not deciding is the safe option",
    stance: "Inaction avoids risk.",
    counter: "Inaction is a decision with its own compounding cost.",
    relatedAxes: ["financial_attentiveness", "temporal_orientation"],
    blurb: "Across many kinds of decisions, people disproportionately stick with whatever the current default is — even when it's demonstrably worse than the alternative — and experience that persistence as caution rather than as a choice. Not deciding is still a decision; it just doesn't feel like one.",
    citation: "Samuelson & Zeckhauser (1988) on status quo bias — a strong, general preference for inaction regardless of its actual cost.",
  },
};

const MODEL_KEYS = Object.keys(DECISION_MODELS);

// --- Surfaces ---------------------------------------------------------------
// Transfer is demonstrated when reasoning holds across surfaces sharing a
// principle. Surface is the *presentation*; principle is the structure.
const SURFACES = [
  "credit_card", "bnpl", "overdraft", "family_loan", "business_loan",
  "subscription", "windfall", "shortfall", "opportunity", "obligation",
];

// --- Calibration stages -----------------------------------------------------
// Ordinal rather than timed. Seconds are noisy — a slow response may be
// deliberation or distraction. What matters is WHO detected the discrepancy
// and WHEN relative to the decision.
const C_LEVELS = {
  C0: { rank: 0, label: "System-identified", detail: "The system named the discrepancy unprompted." },
  C1: { rank: 1, label: "Prompted recognition", detail: "The learner named it when asked." },
  C2: { rank: 2, label: "Independent recognition", detail: "The learner named it unprompted, after acting." },
  C3: { rank: 3, label: "Anticipatory", detail: "The learner named it before acting." },
};

// User-facing wording for the same four levels. The research labels above
// ("System-identified", "discrepancy") are precise but not how a person would
// describe their own experience — this is the same progression in plain,
// first-person language, for model.html and progress.html.
const C_LEVELS_PLAIN = {
  C0: { title: "Showed up in your numbers first", detail: "The pattern was there before you said anything about it — nothing to feel bad about, that's the normal starting point." },
  C1: { title: "You saw it once it was pointed out", detail: "When asked directly, you recognized what was happening." },
  C2: { title: "You caught it yourself, afterward", detail: "You noticed the pattern on your own — after you'd already acted on it." },
  C3: { title: "You saw it coming", detail: "You recognized the pattern BEFORE you acted on it. This is the one that actually changes what you do next, not just how you feel about it after." },
};

// C3 is the theoretical target: calibration that arrives in time to change the
// decision rather than to explain it afterwards.
function classifyRecognition({ namedInPrediction, namedUnprompted, namedWhenAsked }) {
  if (namedInPrediction) return "C3";
  if (namedUnprompted) return "C2";
  if (namedWhenAsked) return "C1";
  return "C0";
}

// --- Titration --------------------------------------------------------------
// Disequilibrium in this domain has a safety ceiling. Cognitive conflict about
// a misconception is productive; cognitive conflict about someone's rent is
// threat, and past a threshold produces defensive avoidance rather than
// accommodation — which is literally one of the archetypes.
//
// Intensity is therefore gated by MODELLED regulatory capacity, not applied
// uniformly. This is the constraint that makes the theory domain-honest.
function disequilibriumBudget({ selfEfficacy = 50, zone = "homeostasis", distressSignal = false } = {}) {
  if (distressSignal) return { level: "none", reason: "distress_signal" };

  let budget = 2; // 0 none · 1 gentle · 2 standard · 3 full
  if (selfEfficacy <= 30) budget -= 1;     // low confidence: less capacity to absorb
  if (selfEfficacy >= 70) budget += 1;
  if (zone === "breakdown") budget -= 1;   // already under strain
  if (zone === "distortion") budget += 0;  // over-provisioned: capacity intact

  budget = Math.max(0, Math.min(3, budget));
  return {
    level: ["none", "gentle", "standard", "full"][budget],
    rank: budget,
    reason: "titrated",
  };
}

// What a given budget permits. Read by the experiential cycle so intensity is
// a parameter rather than a constant.
function permittedProbes(budget) {
  switch (budget.level) {
    case "none":     return { predict: false, confidence: false, surprise: false, reflect: false };
    case "gentle":   return { predict: true,  confidence: false, surprise: true,  reflect: false };
    case "standard": return { predict: true,  confidence: true,  surprise: true,  reflect: true };
    case "full":     return { predict: true,  confidence: true,  surprise: true,  reflect: true };
    default:         return { predict: false, confidence: false, surprise: false, reflect: false };
  }
}

// --- IDM state --------------------------------------------------------------
// Per-model calibration evidence, accumulated across decisions and surfaces.
const IDM_KEY = "finperson_idm";

function blankModelState() {
  return {
    encounters: 0,
    predictionsCorrect: 0,
    confidenceSum: 0,
    surpriseSum: 0,
    bestC: "C0",
    surfacesSeen: [],
    firstUnpromptedAt: null,   // decision index of first C2+ — the latency measure
  };
}

function loadIDM() {
  try {
    const raw = localStorage.getItem(IDM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveIDM(idm) {
  try { localStorage.setItem(IDM_KEY, JSON.stringify(idm)); } catch (e) {}
  // Write-through to the server for signed-in users, so calibration survives
  // a new device and is visible to admin analytics — previously this was
  // localStorage-only. No-ops harmlessly if api.js isn't loaded or the user
  // isn't signed in (saveIdmState itself no-ops for anonymous).
  if (typeof saveIdmState === "function") saveIdmState(idm);
}

// Pulls the server's copy (if any) and merges it into localStorage, per
// model, keeping whichever side has seen more encounters — a simple
// last-writer-doesn't-lose-progress merge, not a full CRDT. Call once on
// page load in any page that reads or writes IDM state (dashboard.js,
// progress-page.js). No-ops harmlessly if api.js isn't loaded.
async function syncIDMFromServer() {
  if (typeof fetchIdmState !== "function") return;
  const server = await fetchIdmState();
  if (!server || typeof server !== "object") return;
  const local = loadIDM();
  let changed = false;
  Object.keys(server).forEach(key => {
    const s = server[key];
    const l = local[key];
    if (!l || (s && s.encounters > l.encounters)) {
      local[key] = s;
      changed = true;
    }
  });
  if (changed) {
    try { localStorage.setItem(IDM_KEY, JSON.stringify(local)); } catch (e) {}
  }
}

// Records one resolved encounter with a decision model.
function updateIDM(modelKey, { correct, confidence, surprise, cLevel, surface, decisionIndex }) {
  if (!DECISION_MODELS[modelKey]) return null;
  const idm = loadIDM();
  const m = idm[modelKey] || blankModelState();

  m.encounters += 1;
  if (correct) m.predictionsCorrect += 1;
  if (typeof confidence === "number") m.confidenceSum += confidence;
  if (typeof surprise === "number") m.surpriseSum += surprise;
  if (surface && !m.surfacesSeen.includes(surface)) m.surfacesSeen.push(surface);

  if (cLevel && C_LEVELS[cLevel] && C_LEVELS[cLevel].rank > C_LEVELS[m.bestC].rank) {
    m.bestC = cLevel;
  }
  if (m.firstUnpromptedAt === null && cLevel && C_LEVELS[cLevel].rank >= 2) {
    m.firstUnpromptedAt = decisionIndex;
  }

  idm[modelKey] = m;
  saveIDM(idm);
  return m;
}

// --- Derived measures -------------------------------------------------------

// Confidence–accuracy gap. Reported instead of a full calibration curve
// because reliable curves need ~20+ resolved predictions per person, and
// realistic session lengths do not supply that. Stated as a limitation
// rather than dressed up as calibration.
function confidenceAccuracyGap(modelState) {
  if (!modelState || !modelState.encounters) return null;
  const meanConf = modelState.confidenceSum / modelState.encounters;   // 0-1
  const accuracy = modelState.predictionsCorrect / modelState.encounters;
  return { meanConfidence: meanConf, accuracy, gap: meanConf - accuracy };
}

// Transfer: has the learner reached independent recognition of the same
// principle across structurally different surfaces?
function transferEvidence(modelState) {
  if (!modelState) return { surfaces: 0, transferred: false };
  const surfaces = modelState.surfacesSeen.length;
  return {
    surfaces,
    transferred: surfaces >= 2 && C_LEVELS[modelState.bestC].rank >= 2,
  };
}

// Aggregate position across all engaged models — the headline trajectory point.
function calibrationSummary() {
  const idm = loadIDM();
  const keys = Object.keys(idm).filter(k => idm[k].encounters > 0);
  if (!keys.length) return null;

  let confSum = 0, accSum = 0, cRankSum = 0, surpriseSum = 0, n = 0, transferred = 0;
  keys.forEach(k => {
    const m = idm[k];
    const ca = confidenceAccuracyGap(m);
    if (ca) { confSum += ca.meanConfidence; accSum += ca.accuracy; n += 1; }
    cRankSum += C_LEVELS[m.bestC].rank;
    surpriseSum += m.encounters ? m.surpriseSum / m.encounters : 0;
    if (transferEvidence(m).transferred) transferred += 1;
  });

  return {
    modelsEngaged: keys.length,
    meanConfidence: n ? confSum / n : null,
    meanAccuracy: n ? accSum / n : null,
    confidenceAccuracyGap: n ? (confSum - accSum) / n : null,
    meanRecognitionRank: cRankSum / keys.length,
    meanSurprise: surpriseSum / keys.length,
    modelsTransferred: transferred,
  };
}

// Node-only export (no-op in the browser) — lets rag/build_index.py pull the
// real citation/blurb content straight from its one source of truth instead
// of a hand-copied, driftable duplicate. A quiz/model page never has
// `module`, so this never runs client-side.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { DECISION_MODELS };
}
