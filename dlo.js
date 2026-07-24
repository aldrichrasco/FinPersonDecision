// Decision Learning Opportunity (DLO) and the experiential cycle.
//
// DLO answers *when* an adaptive system should intervene, not just how. Only
// high-DLO decisions warrant the full cycle; the rest get lightweight support.
// This exists because friction is the binding constraint: probing every
// decision destroys both the experience and the data through fatigue.
//
// BOOTSTRAPPING NOTE. Uncertainty is a DLO component, but asking about it is
// the intervention DLO is supposed to gate. The pre-decision estimate therefore
// uses behavioural proxies and the learner model, not self-report. Likewise
// Misalignment is only knowable after the outcome, so pre-decision DLO uses
// EXPECTED misalignment derived from IDM state.

// --- DLO --------------------------------------------------------------------

function estimateDLO(scenario, ctx = {}) {
  if (!scenario) return { score: 0, band: "low", components: {} };

  // Importance: magnitude of the largest consequence relative to a reference
  // month of income. A trivial decision teaches little regardless of anything else.
  const magnitudes = (scenario.choices || []).map(c => {
    const d = c.delta || {};
    return Math.abs(d.savings || 0) + Math.abs(d.debt || 0) +
           Math.abs(d.investments || 0) + Math.abs(d.income || 0) * 6 +
           Math.abs(d.expenses || 0) * 6;
  });
  const income = (ctx.state && ctx.state.income) || 5000;
  const importance = Math.min(1, (Math.max(0, ...magnitudes) / (income * 1.2)));

  // Uncertainty: behavioural proxies plus prior performance on this model.
  // Never self-report at this stage.
  const idm = typeof loadIDM === "function" ? loadIDM() : {};
  const m = scenario.principle ? idm[scenario.principle] : null;
  const priorAccuracy = m && m.encounters ? m.predictionsCorrect / m.encounters : null;
  const uncertainty = priorAccuracy === null
    ? 0.7                                    // unseen principle: assume uncertain
    : 1 - Math.abs(priorAccuracy - 0.5) * 2; // near-chance accuracy = most uncertain

  // Expected misalignment: how far this principle's stance sits from the
  // learner's demonstrated calibration.
  const ca = m && typeof confidenceAccuracyGap === "function" ? confidenceAccuracyGap(m) : null;
  const expectedMisalignment = ca ? Math.min(1, Math.abs(ca.gap) * 2) : 0.6;

  // Transfer potential: a principle already met on a different surface is
  // where transfer can actually be observed.
  let transferPotential = 0.3;
  if (m && scenario.surface && !m.surfacesSeen.includes(scenario.surface)) {
    transferPotential = m.surfacesSeen.length >= 1 ? 0.95 : 0.6;
  }

  const components = { importance, uncertainty, expectedMisalignment, transferPotential };
  const score =
    importance * 0.30 +
    uncertainty * 0.25 +
    expectedMisalignment * 0.25 +
    transferPotential * 0.20;

  return {
    score,
    band: score >= 0.62 ? "high" : score >= 0.42 ? "medium" : "low",
    components,
  };
}

// --- Experiential cycle -----------------------------------------------------

let cycleState = null;   // active cycle for the open scenario

function startCycle(scenario, ctx) {
  const dlo = estimateDLO(scenario, ctx);
  const budget = typeof disequilibriumBudget === "function"
    ? disequilibriumBudget({
        selfEfficacy: ctx.selfEfficacy,
        zone: ctx.zone,
        distressSignal: ctx.distressSignal,
      })
    : { level: "standard", rank: 2 };
  const probes = typeof permittedProbes === "function" ? permittedProbes(budget) : {};

  // Full cycle only where the decision is worth it AND the learner has capacity.
  const full = dlo.band === "high" && budget.rank >= 2;

  cycleState = {
    scenario, dlo, budget, probes, full,
    prediction: null, confidence: null,
    startedAt: Date.now(),
  };
  return cycleState;
}

function currentCycle() { return cycleState; }

function recordPrediction(choiceIndex, confidence, namedPrinciple) {
  if (!cycleState) return;
  cycleState.prediction = choiceIndex;
  cycleState.confidence = confidence;
  cycleState.namedInPrediction = !!namedPrinciple;
  cycleState.predictedAt = Date.now();
}

// Resolves the cycle once the outcome is known.
function resolveCycle(actualIndex, { surprise, reflection, namedUnprompted, namedWhenAsked, decisionIndex } = {}) {
  if (!cycleState) return null;
  const s = cycleState.scenario;

  // "Correct" here means the prediction matched the action taken — a measure of
  // self-knowledge, not of financial correctness. Predicting your own behaviour
  // accurately is the calibration being tested.
  const predicted = cycleState.prediction;
  const correct = predicted !== null && predicted === actualIndex;

  const cLevel = typeof classifyRecognition === "function"
    ? classifyRecognition({
        namedInPrediction: cycleState.namedInPrediction,
        namedUnprompted, namedWhenAsked,
      })
    : "C0";

  const result = {
    principle: s.principle || null,
    surface: s.surface || null,
    dlo: cycleState.dlo,
    budget: cycleState.budget,
    predicted, actual: actualIndex, correct,
    confidence: cycleState.confidence,
    surprise: typeof surprise === "number" ? surprise : null,
    reflection: reflection || null,
    cLevel,
    deliberationMs: cycleState.predictedAt
      ? cycleState.predictedAt - cycleState.startedAt : null,
  };

  if (s.principle && typeof updateIDM === "function") {
    updateIDM(s.principle, {
      correct,
      confidence: cycleState.confidence,
      surprise: result.surprise,
      cLevel,
      surface: s.surface,
      decisionIndex,
    });
  }

  cycleState = null;
  return result;
}

// --- Surprise interpretation ------------------------------------------------
// Surprise is observable evidence that a model failed. High surprise with high
// prior confidence is the strongest disequilibrium signal available.
function disequilibriumSignal(confidence, surprise) {
  if (typeof confidence !== "number" || typeof surprise !== "number") return null;
  const s = surprise / 7;
  const intensity = s * (0.4 + 0.6 * confidence);
  return {
    intensity,
    band: intensity >= 0.6 ? "strong" : intensity >= 0.35 ? "moderate" : "mild",
    // Confident and surprised: the model was held firmly and failed.
    confidentlyWrong: confidence >= 0.7 && surprise >= 5,
  };
}
