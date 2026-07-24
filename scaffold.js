// Scaffolding fade.
//
// The mechanism behind the theory's central claim: capability develops as
// regulation relocates from the system to the learner. Without deliberate
// withdrawal of support, a learner can appear to improve while remaining
// wholly dependent on the artefact — which is success at financial outcomes
// and failure at capability development.
//
// Support is faded PER PRINCIPLE, not globally. Someone may be anticipatory
// about credit and still need the pattern named for over-saving. Fading
// globally would misattribute competence across decision models.
//
// THE LADDER
//   NAME    — the system states the pattern outright               (learner at C0)
//   ASK     — the system asks whether they notice anything          (learner at C1)
//   WAIT    — the system says nothing, leaving room for C2/C3       (learner at C2+)
//
// FALSIFIABILITY
// A successful artefact reduces the support it provides over time WITHOUT a
// corresponding drop in decision quality. Reduced support alongside degraded
// decisions is disengagement, not learning. Both are recorded so the two can
// be distinguished — see scaffoldingLedger().

const SCAFFOLD_LEVELS = { NAME: "name", ASK: "ask", WAIT: "wait" };

// How much evidence before withdrawing a level of support. Deliberately
// conservative: withdrawing too early leaves a learner unsupported, which is
// worse than withdrawing late.
const FADE_THRESHOLDS = {
  toAsk: 2,    // encounters at C1+ before the system stops naming
  toWait: 2,   // encounters at C2+ before the system stops asking
};

function scaffoldLevelFor(principleKey) {
  if (!principleKey || typeof loadIDM !== "function") return SCAFFOLD_LEVELS.NAME;
  const m = loadIDM()[principleKey];
  if (!m || !m.encounters) return SCAFFOLD_LEVELS.NAME;

  const bestRank = (typeof C_LEVELS !== "undefined" && C_LEVELS[m.bestC])
    ? C_LEVELS[m.bestC].rank : 0;

  // Reached anticipatory recognition at least once: stop intervening and see
  // whether it holds unaided.
  if (bestRank >= 3) return SCAFFOLD_LEVELS.WAIT;
  if (bestRank >= 2 && m.encounters >= FADE_THRESHOLDS.toWait) return SCAFFOLD_LEVELS.WAIT;
  if (bestRank >= 1 && m.encounters >= FADE_THRESHOLDS.toAsk) return SCAFFOLD_LEVELS.ASK;
  return SCAFFOLD_LEVELS.NAME;
}

// Regression: if a learner who had faded starts getting it wrong again, support
// returns. Fading must be reversible or it becomes abandonment.
function shouldRestoreScaffold(principleKey) {
  if (!principleKey || typeof loadIDM !== "function") return false;
  const m = loadIDM()[principleKey];
  if (!m || m.encounters < 3) return false;
  const recentAccuracy = m.predictionsCorrect / m.encounters;
  const ca = typeof confidenceAccuracyGap === "function" ? confidenceAccuracyGap(m) : null;
  // Confidently wrong is the signal that most warrants support returning.
  return recentAccuracy < 0.4 || (ca && ca.gap > 0.45);
}

// The system's post-outcome response, given how much support this principle
// still warrants. Returns null where the system should stay silent.
function scaffoldedResponse(principleKey, { observation, drift, personaName } = {}) {
  const level = shouldRestoreScaffold(principleKey)
    ? SCAFFOLD_LEVELS.NAME
    : scaffoldLevelFor(principleKey);

  const model = (typeof DECISION_MODELS !== "undefined" && principleKey)
    ? DECISION_MODELS[principleKey] : null;

  if (level === SCAFFOLD_LEVELS.NAME) {
    return {
      level,
      mode: "told",
      text: model
        ? `${observation || "That moved your numbers."} What's underneath it: ${model.counter.toLowerCase()}`
        : (observation || null),
      invitesResponse: false,
    };
  }

  if (level === SCAFFOLD_LEVELS.ASK) {
    return {
      level,
      mode: "asked",
      text: observation || "That's done.",
      prompt: "Notice anything about how that went?",
      invitesResponse: true,
    };
  }

  // WAIT: deliberately silent. The gap is the point — it is where unprompted
  // recognition becomes observable.
  return {
    level,
    mode: "silent",
    text: observation || null,
    prompt: null,
    invitesResponse: false,
    openSlot: true,   // an optional, unlabelled place to comment
  };
}

// --- Ledger -----------------------------------------------------------------
// Records support given against decision quality, so falling support can be
// distinguished from falling engagement.
const SCAFFOLD_LEDGER_KEY = "finperson_scaffold_ledger";

function recordScaffold(principleKey, level, decisionQuality) {
  try {
    const raw = localStorage.getItem(SCAFFOLD_LEDGER_KEY);
    const ledger = raw ? JSON.parse(raw) : [];
    ledger.push({
      t: Date.now(),
      principle: principleKey || null,
      level,
      // Support cost: NAME=2, ASK=1, WAIT=0. Falling mean = regulation moving
      // to the learner.
      cost: level === SCAFFOLD_LEVELS.NAME ? 2 : level === SCAFFOLD_LEVELS.ASK ? 1 : 0,
      quality: typeof decisionQuality === "number" ? decisionQuality : null,
    });
    localStorage.setItem(SCAFFOLD_LEDGER_KEY, JSON.stringify(ledger.slice(-300)));
  } catch (e) {}
}

function scaffoldingLedger() {
  try {
    const raw = localStorage.getItem(SCAFFOLD_LEDGER_KEY);
    const ledger = raw ? JSON.parse(raw) : [];
    if (ledger.length < 4) return null;

    const half = Math.floor(ledger.length / 2);
    const mean = (arr, key) => {
      const vals = arr.map(x => x[key]).filter(v => typeof v === "number");
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const earlyCost = mean(ledger.slice(0, half), "cost");
    const lateCost = mean(ledger.slice(half), "cost");
    const earlyQual = mean(ledger.slice(0, half), "quality");
    const lateQual = mean(ledger.slice(half), "quality");

    const supportFell = earlyCost !== null && lateCost !== null && lateCost < earlyCost;
    const qualityHeld = earlyQual === null || lateQual === null || lateQual >= earlyQual - 0.1;

    return {
      n: ledger.length,
      earlyCost, lateCost, earlyQuality: earlyQual, lateQuality: lateQual,
      supportFell,
      qualityHeld,
      // The falsifiable claim: support down AND quality held = capability.
      // Support down WITH quality down = disengagement, not learning.
      interpretation: !supportFell ? "support_stable"
        : qualityHeld ? "capability_developing" : "possible_disengagement",
    };
  } catch (e) {
    return null;
  }
}
