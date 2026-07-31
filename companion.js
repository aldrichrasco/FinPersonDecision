// Adaptive Companion — a small, honest "living twin" read of where someone's
// real tracked behaviour has actually been moving, not a static avatar.
//
// Deliberately built from data the app already collects (capability-history
// snapshots, per-axis sandbox-decision consistency) rather than inventing a
// new tracking system. If there isn't enough history yet to say anything
// specific, it says that plainly instead of guessing — same "don't fabricate
// a trend from insufficient data" rule calibrationSummary() already follows
// in idm.js.
//
// Deliberately NOT a Tamagotchi-style guilt mechanic: the framing stays
// descriptive ("this is what moved") rather than evaluative ("you did
// well/badly"), and a dip is reported as "worth a look", never as a failure.

// Minimum |delta| between the two most recent capability snapshots before
// it's called a real direction rather than noise — small quiz re-takes
// naturally wobble a couple of points.
const COMPANION_TREND_THRESHOLD = 3;

// Below this many logged decisions on an axis, its variance is too noisy to
// call "the least consistent axis" — matches db.py get_axis_consistency
// returning a variance from as few as one data point otherwise.
const COMPANION_MIN_AXIS_COUNT = 2;

function computeCompanionState({ history, axisConsistency, currentArchetype } = {}) {
  const h = Array.isArray(history) ? history : [];

  if (h.length < 2) {
    return {
      trend: "new",
      glow: "slate",
      badge: "Getting to know you",
      headline: "Still getting to know you.",
      detail: "I need at least one more check-in before I can point at anything specific — retake the quiz after some sandbox practice, or just keep making decisions there.",
    };
  }

  const latest = h[h.length - 1].capability;
  const previous = h[h.length - 2].capability;
  const delta = latest - previous;

  let trend, glow, badge, headline;
  if (delta >= COMPANION_TREND_THRESHOLD) {
    trend = "improving"; glow = "teal"; badge = "Trending up";
    headline = `Your capability score moved up ${delta} point${delta === 1 ? "" : "s"} since your last check-in.`;
  } else if (delta <= -COMPANION_TREND_THRESHOLD) {
    trend = "drifting"; glow = "brick"; badge = "Worth a look";
    headline = `Your capability score dipped ${Math.abs(delta)} point${Math.abs(delta) === 1 ? "" : "s"} since your last check-in.`;
  } else {
    trend = "steady"; glow = "slate"; badge = "Holding steady";
    headline = "Holding steady since your last check-in.";
  }

  const detail = leastConsistentAxisDetail(axisConsistency, trend);

  return { trend, glow, badge, headline, detail, archetype: currentArchetype || null };
}

// Picks the axis with the highest sandbox-decision variance (least
// consistent), phrased for the trend direction already established above —
// this is the "which specific habit is behind that number" follow-through,
// not a second unrelated observation.
function leastConsistentAxisDetail(axisConsistency, trend) {
  const entries = Object.entries(axisConsistency || {})
    .filter(([, v]) => v && v.count >= COMPANION_MIN_AXIS_COUNT);
  if (!entries.length) {
    return "Make a few more sandbox decisions and I'll start pointing at exactly which habit is behind that number.";
  }
  entries.sort((a, b) => b[1].variance - a[1].variance);
  const [axisKey] = entries[0];
  const label = (typeof AXES !== "undefined" && AXES[axisKey]) ? AXES[axisKey].label : axisKey;
  return trend === "drifting"
    ? `${label} has been the least consistent lately — that's usually the first place a dip like this shows up.`
    : `${label} is still the least consistent of the six — same kind of decision, different results depending on the moment. That's the one place more consistency would show up fastest.`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    COMPANION_TREND_THRESHOLD, COMPANION_MIN_AXIS_COUNT,
    computeCompanionState, leastConsistentAxisDetail,
  };
}
