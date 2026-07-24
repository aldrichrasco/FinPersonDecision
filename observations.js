// Observations — the translation layer between engine and interface.
//
// The engine reasons in scores, zones, thresholds and gaps. The person should
// never see any of that. They should see facts about their own behaviour that
// they can recognise and act on.
//
//   engine:  wellbeing 38, breakdown, gap -14, characteristic drift
//   person:  "That's the third time you've reached for credit when something
//             unexpected came up."
//
// Rule for anything added here: if a sentence contains a number that only
// makes sense inside the model, it belongs in the research view instead.
// Counts of the person's own actions are fine — those are observable facts.

// A decision record is:
//   { choice, delta, flavor, scenarioZone, zone, movedTo }
// built by the sandbox and passed in as an ordered array.

function _tally(log, predicate) {
  return log.filter(predicate).length;
}

const _usedCredit = d => (d.delta.debt || 0) > 0;
const _drewSavings = d => (d.delta.savings || 0) < 0;
const _builtSavings = d => (d.delta.savings || 0) > 0;
const _clearedDebt = d => (d.delta.debt || 0) < 0;
const _raisedIncome = d => (d.delta.income || 0) > 0;
const _didNothing = d => Object.keys(d.delta || {}).length === 0;
const _spentOnLife = d => d.scenarioZone === "living" && (d.delta.savings || 0) < 0;
const _declinedLife = d => d.scenarioZone === "living" && (d.delta.savings || 0) >= 0;
const _tookRecovery = d => d.scenarioZone === "recovery" &&
  ((d.delta.debt || 0) < 0 || (d.delta.income || 0) > 0 || (d.delta.savings || 0) > 0);

// Ordinal words read more naturally than digits in a sentence.
const ORDINALS = ["", "", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
function nth(n) {
  return ORDINALS[n] || `${n}th`;
}

// --- Immediate observation: what just happened, in their words ---------------
// Returned after every decision. Prefers a *pattern* over a one-off, because
// a pattern is what someone can actually recognise in themselves.
function observeDecision(log) {
  if (!log.length) return null;
  const last = log[log.length - 1];
  const n = log.length;

  // Repeated patterns first — these carry the most weight.
  const creditCount = _tally(log, _usedCredit);
  if (_usedCredit(last) && creditCount >= 2) {
    return `That's the ${nth(creditCount)} time you've reached for credit when something came up.`;
  }

  const drawCount = _tally(log, _drewSavings);
  if (_drewSavings(last) && drawCount >= 3 && last.scenarioZone !== "living") {
    return `You've now dipped into savings ${drawCount} times. Each one was defensible on its own — together they're a pattern.`;
  }

  const nothingCount = _tally(log, _didNothing);
  if (_didNothing(last) && nothingCount >= 2) {
    return `That's the ${nth(nothingCount)} time you've chosen to wait rather than act. Sometimes that's wisdom, sometimes it's avoidance — worth knowing which.`;
  }

  const declinedCount = _tally(log, _declinedLife);
  if (_declinedLife(last) && declinedCount >= 2) {
    return `You've had ${declinedCount} chances to spend on something that mattered to you, and passed both times.`;
  }

  // Single notable moves.
  if (_spentOnLife(last)) {
    return `You spent on something that actually matters to you. That's what the money was for.`;
  }
  if (_tookRecovery(last)) {
    return `You took the repair route rather than the easy one. That's the harder call.`;
  }
  if (_clearedDebt(last)) {
    return `You put money toward debt rather than anywhere more enjoyable.`;
  }
  if (_raisedIncome(last)) {
    return `You solved that by earning more rather than cutting deeper.`;
  }
  if (_builtSavings(last)) {
    return `You added to your buffer instead of spending it.`;
  }
  if (_usedCredit(last)) {
    return `You covered that with credit — it solves today and costs you later.`;
  }
  if (_drewSavings(last)) {
    return `You used your buffer. That's what a buffer is for, and it's now smaller.`;
  }
  if (n === 1) {
    return `First decision made. Patterns take a few more before they mean anything.`;
  }
  return null;
}

// --- Standing read: the shape of their behaviour so far ---------------------
// Shown in the summary panel. Deliberately qualitative.
function observePattern(log, zoneHistory) {
  if (log.length < 3) {
    return {
      headline: "Still early",
      body: "Make a few more decisions and I'll start showing you the patterns in how you handle money.",
      tone: "neutral",
    };
  }

  const credit = _tally(log, _usedCredit);
  const drew = _tally(log, _drewSavings);
  const built = _tally(log, _builtSavings);
  const waited = _tally(log, _didNothing);
  const declined = _tally(log, _declinedLife);
  const recovered = _tally(log, _tookRecovery);
  const n = log.length;

  // How much of the time have they been in a viable state?
  const steady = zoneHistory.filter(z => z === "homeostasis").length;
  const fragile = zoneHistory.filter(z => z === "breakdown").length;
  const withheld = zoneHistory.filter(z => z === "distortion").length;

  if (credit >= Math.max(2, n * 0.4)) {
    return {
      headline: "Credit is doing the heavy lifting",
      body: `You've used credit ${credit} times out of ${n} decisions. It works in the moment, which is exactly why it's easy to keep choosing.`,
      tone: "watch",
    };
  }
  if (waited >= Math.max(2, n * 0.4)) {
    return {
      headline: "You tend to wait things out",
      body: `${waited} of your ${n} decisions were to do nothing for now. Waiting is sometimes right — but it's worth noticing it's your default.`,
      tone: "watch",
    };
  }
  if (fragile > steady && fragile >= 2) {
    return {
      headline: "You've been running thin",
      body: "For most of this run there hasn't been much between you and a surprise. That's the thing worth changing first.",
      tone: "watch",
    };
  }
  if (withheld > steady && withheld >= 2) {
    return {
      headline: "You're holding more than you're using",
      body: `You've turned down ${declined || "several"} chances to spend on things that mattered. Security is worth having — but it's meant to buy you a life, not replace one.`,
      tone: "watch",
    };
  }
  if (recovered >= 2) {
    return {
      headline: "You take the repair route",
      body: `${recovered} times you had an easier option and chose the one that actually fixed something.`,
      tone: "good",
    };
  }
  if (built >= 2 && credit === 0) {
    return {
      headline: "You've kept your footing",
      body: `You've built your buffer ${built} times and haven't reached for credit once.`,
      tone: "good",
    };
  }
  if (steady >= n * 0.6) {
    return {
      headline: "Fairly steady",
      body: "Nothing dramatic either way — you've mostly kept things in a workable range.",
      tone: "good",
    };
  }
  return {
    headline: "Mixed so far",
    body: `Some solid calls, some that cost you. ${drew ? `You've leaned on savings ${drew} times.` : ""}`.trim(),
    tone: "neutral",
  };
}

// --- Characterisation from a profile (replaces the axis scorecard) ----------
// Prose, second person, no numbers. Used after the optional quiz.
function characterise(profile, archetypeSlug) {
  const bits = [];
  const p = k => profile[k] ?? 50;

  if (p("impulse_regulation") >= 65) bits.push("you think before you spend");
  else if (p("impulse_regulation") <= 35) bits.push("you tend to buy first and think after");

  if (p("temporal_orientation") >= 65) bits.push("you plan a long way ahead");
  else if (p("temporal_orientation") <= 35) bits.push("you mostly think in the near term");

  if (p("financial_attentiveness") <= 35) bits.push("you'd rather not look too closely at the numbers");
  else if (p("financial_attentiveness") >= 65) bits.push("you keep a close eye on where things stand");

  if (p("financial_self_efficacy") <= 35) bits.push("money tends to make you anxious");
  else if (p("financial_self_efficacy") >= 70) bits.push("you feel fairly in control");

  if (p("risk_disposition") >= 70) bits.push("you're comfortable with risk");
  else if (p("risk_disposition") <= 30) bits.push("you'd rather protect what you have than chase more");

  if (p("prosocial_orientation") >= 75) bits.push("you put other people's needs into the equation early");

  if (!bits.length) return "You sit fairly evenly across the board — no strong pull in any direction.";

  const first = bits[0].charAt(0).toUpperCase() + bits[0].slice(1);
  const rest = bits.slice(1);
  if (!rest.length) return first + ".";
  if (rest.length === 1) return `${first}, and ${rest[0]}.`;
  return `${first}, ${rest.slice(0, -1).join(", ")}, and ${rest[rest.length - 1]}.`;
}
