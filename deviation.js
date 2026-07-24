// ============================================================================
// FINANCIAL HOMEOSTASIS — a theory of regulated financial wellbeing
// ============================================================================
//
// THEORY. Financial wellbeing is the state in which money sustainably serves
// life. It is a REGULATED variable, not a maximised one: like a physiological
// homeostatic system, it has a viable zone bounded on BOTH sides, and either
// boundary represents genuine dysregulation.
//
//   · LOWER boundary — BREAKDOWN. Under-provisioning: insufficient buffer,
//     unsustainable debt, fragility to shocks. Money fails to secure life.
//
//   · UPPER boundary — DISTORTION. Over-provisioning at the cost of living:
//     hoarding, fear-based overprotection, deferring life indefinitely for
//     accumulation. Life is sacrificed to money — the inverse failure.
//
// The two boundaries are NOT ends of one "more is better" scale. They are two
// distinct ways the money-life relationship breaks. We therefore model
// wellbeing as a function that PEAKS in the viable zone and DECLINES toward
// BOTH poles — not a monotonic score. This is the theory's central claim and
// what distinguishes it from wealth-maximisation framings.
//
// GROUNDING. Boundaries are defined in RATIOS, not absolute money, so the zone
// is personal: what is homeostatic scales with income and cost of living.
//   · security ratio   = months of essential expenses covered by liquid savings
//   · burden ratio     = debt-service share of income (fragility)
//   · engagement ratio = provisioning for the future relative to income
//
// REGULATION. When observed behaviour deviates past a boundary, PIPE acts as
// the restoring force (the recalibrated trajectory). Deviation, not level, is
// what the intervention responds to.
// ============================================================================

// --- Provisioning boundaries, expressed as ratios (the theory's anchors) ---
// These are the substantive, defensible numbers — months of cover, debt
// share — rather than opaque points on an index.
const PROVISIONING = {
  // Security: months of essential expenses held in liquid savings.
  security: { breakdown: 1, viableLow: 3, viableHigh: 9, distortion: 15 },
  // Burden: debt-service as % of income (only a lower/breakdown side matters).
  burden:   { safe: 10, strained: 30, breakdown: 45 },
  // Engagement: future provisioning (investments) in months of income;
  // too little = under-preparing, extreme = over-deferring present life.
  future:   { breakdown: 0.5, viableLow: 3, viableHigh: 24, distortion: 48 },
};

// The wellbeing zone on the 0-100 presentation scale. Because wellbeing is
// non-monotonic, the ZONE is a central band and BOTH thresholds are exits
// from it. Kept symmetric around the midpoint to express "both poles are
// equally dysregulation".
const HOMEOSTASIS = {
  lower: 35,   // exit into BREAKDOWN (under-provisioning)
  upper: 65,   // exit into DISTORTION (over-provisioning)
  mid: 50,     // centre of viable financial wellbeing
};

// --- Wellbeing score: NON-MONOTONIC, peaks in the zone -----------------------
// Each provisioning ratio contributes a 0-1 "viability" that is 1 in its
// healthy band and falls off toward BOTH under- and over-provisioning. The
// blended result is mapped so the viable zone sits at the centre of the 0-100
// axis and both poles read as deviation — matching the theory and the diagram.
function wellbeingViability(state) {
  const months = state.expenses > 0 ? state.savings / state.expenses : 0;
  const dtiPct = state.income > 0 ? (state.debt * 0.03) / state.income * 100 : 100;
  const futureMonths = state.income > 0 ? state.investments / state.income : 0;

  // Security: rises from breakdown->viableLow, flat across viable band,
  // falls viableHigh->distortion (hoarding). Returns -1..+1 signed deviation
  // (negative = under, positive = over) and a 0..1 viability.
  const sec = bandPosition(months, PROVISIONING.security);
  const fut = bandPosition(futureMonths, PROVISIONING.future);
  // Burden has only an under/breakdown side: high debt = negative deviation.
  const burdenViability = Math.max(0, Math.min(1, 1 - (dtiPct - PROVISIONING.burden.safe) /
    (PROVISIONING.burden.breakdown - PROVISIONING.burden.safe)));
  const burdenSigned = -(1 - burdenViability); // debt only pushes toward breakdown

  // Blend viabilities (how healthy) and signed deviations (which pole).
  const viability = sec.viability * 0.4 + burdenViability * 0.35 + fut.viability * 0.25;
  const signed = sec.signed * 0.45 + burdenSigned * 0.35 + fut.signed * 0.20;
  return { viability, signed };
}

// Position of a value within a four-point band {breakdown, viableLow,
// viableHigh, distortion}. Returns viability 0..1 (1 inside the viable band)
// and signed -1..+1 (which side of the band it deviates toward).
function bandPosition(v, band) {
  if (v >= band.viableLow && v <= band.viableHigh) return { viability: 1, signed: 0 };
  if (v < band.viableLow) {
    const t = Math.max(0, (v - band.breakdown) / (band.viableLow - band.breakdown));
    return { viability: t, signed: -(1 - t) };       // under-provisioned
  }
  const t = Math.max(0, (band.distortion - v) / (band.distortion - band.viableHigh));
  return { viability: t, signed: +(1 - t) };          // over-provisioned
}

// Maps wellbeing onto the 0-100 presentation axis such that the VIABLE ZONE is
// centred (around mid) and deviation toward EITHER pole moves the score toward
// the corresponding threshold. This is why a hoarder and a spendthrift can
// share a low viability yet sit at OPPOSITE ends of the chart.
function stabilityScore(state) {
  const { viability, signed } = wellbeingViability(state);
  // In-zone span is [lower, upper]; full deviation reaches 0 or 100.
  const halfZone = (HOMEOSTASIS.upper - HOMEOSTASIS.lower) / 2;
  const deviation = (1 - viability); // 0 = fully viable, 1 = fully dysregulated
  const direction = signed >= 0 ? +1 : -1;
  const raw = HOMEOSTASIS.mid + direction * deviation * (HOMEOSTASIS.mid + halfZone) * (signed === 0 ? 0 : 1);
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// Where does a score sit relative to the wellbeing zone?
function zoneStatus(score) {
  if (score > HOMEOSTASIS.upper) return "distortion";  // over-provisioning
  if (score < HOMEOSTASIS.lower) return "breakdown";   // under-provisioning
  return "homeostasis";
}

// Did observed cross a threshold on this step (a PIPE trigger)?
function detectTrigger(prevScore, score) {
  const prevStatus = zoneStatus(prevScore);
  const status = zoneStatus(score);
  if (status === "homeostasis") return null;
  if (status !== prevStatus) {
    return {
      kind: status, // "distortion" | "breakdown"
      note: status === "breakdown"
        ? "PIPE trigger: lower deviation from homeostasis — your provisioning is thinning."
        : "PIPE trigger: upper deviation from homeostasis — you may be over-extending or hoarding at the cost of living.",
    };
  }
  return null;
}

// Recalibration: pull an observed score gently back toward the zone, the way
// a nudge would. Purely for the visualised recalibrated trajectory.
function recalibrate(score) {
  const status = zoneStatus(score);
  if (status === "homeostasis") return score;
  // Move ~40% of the distance back to the nearest threshold each step.
  const target = status === "breakdown" ? HOMEOSTASIS.lower : HOMEOSTASIS.upper;
  return Math.round(score + (target - score) * 0.4);
}

// Archetype-expected position (the blue dashed reference line).
//
// Under the wellbeing theory the axis is non-monotonic, so "expected" is not
// "how capable" — it is WHERE this archetype characteristically sits. A
// well-regulated archetype sits inside the zone near the midpoint; a
// drift-prone archetype sits displaced toward ITS characteristic pole
// (distortion-drifters slightly high, breakdown-drifters slightly low),
// reflecting its standing tendency even before pressure is applied.
//
// `slug` lets us read the archetype's drift direction from ARCHETYPE_GAPS.
function archetypeExpectedScore(archetypeProfile, slug) {
  const cap = typeof capabilityIndex === "function" ? capabilityIndex(archetypeProfile) : 55;
  // Regulation strength: higher capability -> closer to the zone centre.
  const regulation = cap / 100;                 // 0..1
  const displacement = (1 - regulation) * 22;   // less-regulated -> further out
  const g = (typeof ARCHETYPE_GAPS !== "undefined" && ARCHETYPE_GAPS[slug]) || null;
  const dir = g ? (g.drift === "distortion" ? +1 : -1) : 0;
  return Math.round(Math.max(0, Math.min(100, HOMEOSTASIS.mid + dir * displacement)));
}

// --- Person-Archetype Gap (numeric) ---
// Signed distance between observed and archetype-expected behaviour.
function personArchetypeGap(observedScore, archetypeScore) {
  return observedScore - archetypeScore;
}

// --- Archetype gap profiles (from the study's Person-Archetype Gap table) ---
// Each archetype has a characteristic FAILURE MODE: a specific direction it
// drifts out of homeostasis under pressure, and a named gap. "drift" is the
// threshold it characteristically moves toward:
//   "breakdown"  — drifts DOWN (under-provisioning, fragility, avoidance)
//   "distortion" — drifts UP (over-extension, over-protection, over-reach)
// This is what makes a nudge diagnostic: we highlight when observed behaviour
// moves along THIS archetype's characteristic axis, not just any deviation.
const ARCHETYPE_GAPS = {
  conscious_spender: {
    baseline: "Moderate, values-aligned spending with planned boundaries",
    observed: "Spending rises when temptation is high, but restraint returns when goals or consequences are salient",
    gap: "Boundaries may weaken under temptation, emotional reward, or relaxed pressure",
    drift: "breakdown",
  },
  ambitious_builder: {
    baseline: "Calculated investment decisions, deferred gratification, future-oriented planning",
    observed: "Prioritises growth routes, but may over-invest or neglect short-term obligations",
    gap: "Future orientation may become distortive when growth is prioritised over present stability",
    drift: "distortion",
  },
  cautious_guardian: {
    baseline: "Protective, low-risk choices with strong adherence to security and certainty",
    observed: "Preserves resources and avoids risk, but may miss recovery opportunities",
    gap: "Prudence may shift into fear-based overprotection",
    drift: "distortion",
  },
  impulsive_spender: {
    baseline: "Short-term spending decisions driven by immediate relief or reward",
    observed: "Chooses immediate rewards, shortcuts, or relief-based actions despite visible debt signals",
    gap: "Immediate relief may override consequence awareness",
    drift: "breakdown",
  },
  steady_saver: {
    baseline: "Stable, incremental financial decisions with low volatility",
    observed: "Maintains accumulation and avoids volatility, but may under-respond to urgent threats",
    gap: "Stability preference may reduce adaptive responsiveness",
    drift: "distortion",
  },
  strategic_risk_taker: {
    baseline: "Informed, goal-oriented risk decisions with managed exposure",
    observed: "Uses risk strategically, but may become overexposed when reward signals are distorted",
    gap: "Managed risk may shift into overexposure under distorted reward conditions",
    drift: "distortion",
  },
  purposeful_giver: {
    baseline: "Allocates resources toward others in a value-driven, intentional way",
    observed: "Continues helping or giving under pressure, even when personal resources decline",
    gap: "Generosity may override self-preservation and minimum viable stability",
    drift: "breakdown",
  },
  anxious_avoider: {
    baseline: "Withdrawal from financial decisions, delayed responses, avoidance of pressure",
    observed: "Freezes, delays, avoids repayment routes, or disengages under pressure",
    gap: "Financial pressure may trigger avoidance rather than corrective action",
    drift: "breakdown",
  },
  overconfident_navigator: {
    baseline: "Confident, high-agency decisions that bypass caution or extended evaluation",
    observed: "Ignores warnings, selects high-risk shortcuts, or dismisses consequence feedback",
    gap: "Confidence may block feedback sensitivity and prudential recalibration",
    drift: "distortion",
  },
  status_seeker: {
    baseline: "Image-driven choices that prioritise appearance, prestige, or symbolic value",
    observed: "Pursues symbolic rewards, status routes, or visible upgrades despite financial cost",
    gap: "Validation-seeking may override financial homeostasis",
    drift: "breakdown",
  },
  passive_drifter: {
    baseline: "Minimal decision-making, low initiative, weak engagement with responsibility",
    observed: "Fails to act at critical points, ignores recovery cues, or drifts toward instability",
    gap: "Inaction may become a pathway into financial breakdown",
    drift: "breakdown",
  },
};

// Is observed behaviour drifting in this archetype's characteristic direction?
// Returns {characteristic:bool, ...gap} so the sandbox can emphasise it.
function characteristicDrift(slug, prevScore, score) {
  const g = ARCHETYPE_GAPS[slug];
  if (!g) return null;
  const movingDown = score < prevScore;
  const movingUp = score > prevScore;
  const outOfZone = zoneStatus(score) !== "homeostasis";
  const towardChar =
    (g.drift === "breakdown" && movingDown) ||
    (g.drift === "distortion" && movingUp);
  return {
    characteristic: towardChar,
    outOfZone,
    drift: g.drift,
    gap: g.gap,
    baseline: g.baseline,
    observed: g.observed,
  };
}
