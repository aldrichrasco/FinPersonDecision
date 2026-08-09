// Adaptive scenario selection.
//
// The sandbox chose scenarios by weighted chance. That is fine for variety
// and useless for learning: the system already knows which tendencies it has
// the least evidence about, and which of the Twin's rules are unresolved,
// and it was throwing all of that away on every roll.
//
// This picks the scenario that would tell us the most, and — just as
// importantly — says WHY it picked it. A system that quietly optimises what
// it asks feels manipulative. One that says "your answers so far sit between
// two patterns, and this separates them" feels like an investigation, which
// is what the product claims to be.
//
// Four things make a scenario informative, in priority order:
//
//   0. It SEPARATES TWO RIVAL EXPLANATIONS. Two rules fitting the same
//      behaviour is worse than one wrong belief, because the model cannot
//      tell which of its own claims to trust until the tie is broken.
//   1. It tests a CONTESTED rule. The Twin holds a belief that evidence is
//      currently arguing with. Resolving that is worth more than anything
//      else, because a contested rule is actively wrong in one direction.
//   2. It tests an axis with thin evidence. Confidence already names the two
//      tendencies it is least sure about; those are the gaps to fill.
//   3. It tests a PROPOSED rule that is close to confirming. A hunch one or
//      two observations from becoming a finding is cheap to resolve.
//
// Everything degrades to the existing weighted-random behaviour when there
// is nothing worth targeting, so a new user is never funnelled.

// Minimum decisions before targeting kicks in. Below this there is no
// evidence to be uneven about, and steering early would shape the profile
// rather than measure it.
const ADAPTIVE_MIN_DECISIONS = 5;

// How often a targeted pick is used even when one is available. Deliberately
// not 100%: a sandbox that only ever asks about your weak spots stops feeling
// like a range of situations and starts feeling like an interrogation, and
// the archetype match needs breadth to stay honest.
const ADAPTIVE_TARGET_RATE = 0.6;

// Which axis a scenario probes. Falls back to the surface map in fbm.js,
// which already exists for exactly this purpose.
function scenarioAxis(scenario) {
  if (!scenario) return null;
  if (typeof SURFACE_AXIS === "undefined") return null;
  return SURFACE_AXIS[scenario.surface] || null;
}

// What the system would most like to learn next, with the reason attached.
// Returns null when nothing is worth targeting.
function adaptiveTarget(decisions, twin, profile) {
  decisions = decisions || [];
  if (decisions.length < ADAPTIVE_MIN_DECISIONS) return null;

  // 0. An unresolved rivalry outranks everything. Two explanations fitting
  //    the same behaviour is worse than one wrong belief, because the model
  //    cannot tell which of its own claims to trust until it is settled.
  if (typeof twinMostUnresolved === "function") {
    const rivalry = twinMostUnresolved(decisions);
    if (rivalry) {
      return {
        axis: rivalry.discriminator.axis,
        reason: `Two explanations still fit your behaviour. This one needs ${rivalry.discriminator.needs}, which is what separates them.`,
        kind: "rivalry",
        rivalryId: rivalry.id,
      };
    }
  }

  // 1. A contested rule is the most valuable thing to resolve: the Twin
  //    currently believes something the evidence is arguing with.
  if (twin && twin.contested && twin.contested.length) {
    const rule = twin.contested[0];
    return {
      axis: rule.axis,
      reason: `Your twin holds a belief that your recent decisions are arguing with. This one tests it.`,
      kind: "contested",
      ruleId: rule.id,
    };
  }

  // 2. The axis with the least evidence behind it. Counted from decisions
  //    actually tagged to that axis, not from the profile score, since a
  //    confident-looking score built on two observations is the exact thing
  //    worth correcting.
  const counts = {};
  if (typeof AXIS_KEYS !== "undefined") AXIS_KEYS.forEach(k => { counts[k] = 0; });
  decisions.forEach(d => {
    const axis = (typeof SURFACE_AXIS !== "undefined") ? SURFACE_AXIS[d.surface] : null;
    if (axis && counts[axis] !== undefined) counts[axis] += 1;
  });
  const thinnest = Object.keys(counts).sort((a, b) => counts[a] - counts[b])[0];
  // Only worth targeting if it is genuinely behind the others, otherwise the
  // evidence is already even and steering adds nothing.
  const busiest = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  if (thinnest && counts[busiest] - counts[thinnest] >= 3) {
    const name = (typeof mriAxisName === "function") ? mriAxisName(thinnest) : thinnest;
    return {
      axis: thinnest,
      reason: `We have seen the least of how you handle ${name.toLowerCase()}. This one is about that.`,
      kind: "thin",
    };
  }

  // 3. A hunch close to becoming a finding.
  if (twin && twin.proposed && twin.proposed.length) {
    const nearly = twin.proposed
      .filter(r => r.total >= 1)
      .sort((a, b) => b.total - a.total)[0];
    if (nearly) {
      return {
        axis: nearly.axis,
        reason: `Your twin has a hunch it cannot confirm yet. A couple more like this would settle it.`,
        kind: "proposed",
        ruleId: nearly.id,
      };
    }
  }
  return null;
}

// Narrows a candidate pool to scenarios probing the target axis. Returns the
// original pool untouched when nothing matches, so targeting can never empty
// the sandbox or force a repeat.
function adaptiveFilter(pool, target) {
  if (!target || !pool || !pool.length) return { pool, targeted: false };
  const matching = pool.filter(s => scenarioAxis(s) === target.axis);
  if (!matching.length) return { pool, targeted: false };
  return { pool: matching, targeted: true };
}

// Whether to use the target on this particular roll. Kept as a coin flip
// rather than always-on so the run still feels like a spread of situations.
function adaptiveShouldTarget(rng) {
  const r = typeof rng === "function" ? rng() : Math.random();
  return r < ADAPTIVE_TARGET_RATE;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    adaptiveTarget, adaptiveFilter, adaptiveShouldTarget,
    scenarioAxis, ADAPTIVE_MIN_DECISIONS, ADAPTIVE_TARGET_RATE,
  };
}
