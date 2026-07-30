// Pure delta-computation math for classroom-page.js's nudgeAxis() feature —
// pulled out of the five inline call sites into one documented home so the
// constants (what counts as "neutral," how much one play can move an axis)
// are visible and easy to justify/tune in one place instead of five, and so
// they're unit-testable without a browser (see tests-js/nudge-formulas.test.js).
//
// baseline=0.3 is a rough "below this reads self-interested, above this
// reads generous/risk-tolerant" midpoint — not derived from a citation like
// the game mechanics themselves are, just a reasonable starting guess. cap=4
// keeps any single play from swinging an axis far on its own.

function nudgeDeltaFromFraction(fraction, opts) {
  const o = opts || {};
  const baseline = o.baseline ?? 0.3;
  const scale = o.scale ?? 10;
  const cap = o.cap ?? 4;
  return Math.max(-cap, Math.min(cap, Math.round((fraction - baseline) * scale)));
}

// Ultimatum-Responder is a special case, not a fraction-vs-baseline read:
// rejecting a lowball offer reads as confident enough to walk away from
// guaranteed money; accepting a lowball reads the other way. A merely fair
// offer accepted/rejected barely moves the needle either way.
function nudgeDeltaUltimatumResponder(offerFrac, accepted, threshold) {
  const t = threshold ?? 0.3;
  if (accepted) return offerFrac >= t ? 1 : -2;
  return offerFrac < t ? 2 : 0;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { nudgeDeltaFromFraction, nudgeDeltaUltimatumResponder };
}
