// Session structure.
//
// Previously decisions accumulated forever with no payoff — you could make
// three or thirty and nothing marked the difference. That's the biggest UX
// gap in the sandbox: effort with no closure.
//
// A round is a short set of decisions ending in a recap. It gives the person
// somewhere to stop, something to read, and a reason to come back — without
// gamifying money, which would be the wrong register for this product.

const ROUND_LENGTH = 6;

function roundProgress(decisionCount) {
  const inRound = decisionCount % ROUND_LENGTH;
  return {
    round: Math.floor(decisionCount / ROUND_LENGTH) + 1,
    done: inRound === 0 && decisionCount > 0 ? ROUND_LENGTH : inRound,
    total: ROUND_LENGTH,
    complete: decisionCount > 0 && decisionCount % ROUND_LENGTH === 0,
  };
}

// Stitches this round's authored per-choice outcome lines (dashboard.js's
// SCENARIOS outcome text, carried into decisionLog) into one short flowing
// paragraph — no new content, just the sentences already shown one at a
// time, read back as a single story. Scenarios without an authored outcome
// (adaptive/generated ones) are silently skipped rather than leaving a gap.
const NARRATIVE_TRANSITIONS = ["Then", "After that", "Next", "A little later", "From there", "Not long after"];
// Outcome lines that open with a recurring character's name (Priya, Devon,
// Jordan — see SCENARIOS in dashboard.js) must keep their capital when
// spliced after a transition; lowercasing "Priya's thrilled..." into
// "priya's thrilled..." reads as a typo, not a sentence continuation.
const PROPER_NOUN_STARTS = ["Priya", "Devon", "Jordan"];
function buildRoundNarrative(slice) {
  const sentences = slice.map(d => d.outcome).filter(Boolean);
  if (!sentences.length) return null;
  return sentences.map((sentence, i) => {
    if (i === 0) return sentence;
    const transition = NARRATIVE_TRANSITIONS[(i - 1) % NARRATIVE_TRANSITIONS.length];
    const properNoun = PROPER_NOUN_STARTS.some(name => sentence.startsWith(name));
    const clause = properNoun ? sentence : sentence.charAt(0).toLowerCase() + sentence.slice(1);
    return `${transition}, ${clause}`;
  }).join(" ");
}

// Builds the recap shown when a round completes. Reads from the same
// observation layer the person already sees, so nothing new is invented.
function buildRoundRecap(decisionLog, zoneHistory, roundNumber) {
  const slice = decisionLog.slice(-ROUND_LENGTH);
  const zones = zoneHistory.slice(-ROUND_LENGTH);

  const usedCredit = slice.filter(d => (d.delta.debt || 0) > 0).length;
  const clearedDebt = slice.filter(d => (d.delta.debt || 0) < 0).length;
  const built = slice.filter(d => (d.delta.savings || 0) > 0).length;
  const drew = slice.filter(d => (d.delta.savings || 0) < 0).length;
  const waited = slice.filter(d => Object.keys(d.delta || {}).length === 0).length;
  const steady = zones.filter(z => z === "homeostasis").length;

  const pattern = observePattern(decisionLog, zoneHistory);

  // Which money beliefs this round's scenarios probed, in first-touched
  // order — a batch retrospective, not a per-choice callout. The per-choice
  // scaffold (scaffoldedResponse in scaffold.js) already names beliefs live
  // and deliberately fades that out over time as calibration improves; this
  // is a different, always-on summary that doesn't fight that withdrawal.
  const beliefsTouched = [];
  slice.forEach(d => {
    const key = d.principle;
    if (!key || beliefsTouched.some(b => b.key === key)) return;
    const model = (typeof DECISION_MODELS !== "undefined") ? DECISION_MODELS[key] : null;
    if (model) beliefsTouched.push({ key, label: model.label });
  });

  // Facts about their own actions — never scores.
  const times = n => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
  const facts = [];
  if (built) facts.push(`built your buffer ${times(built)}`);
  if (clearedDebt) facts.push(`put money toward debt ${times(clearedDebt)}`);
  if (usedCredit) facts.push(`reached for credit ${times(usedCredit)}`);
  if (drew) facts.push(`dipped into savings ${times(drew)}`);
  if (waited) facts.push(`chose to wait ${times(waited)}`);

  const factLine = facts.length
    ? `You ${facts.slice(0, -1).join(", ")}${facts.length > 1 ? ", and " : ""}${facts[facts.length - 1]}.`
    : "A quiet round — nothing moved much.";

  // One thing to carry forward. Specific beats motivational.
  let takeaway;
  if (usedCredit >= 3) {
    takeaway = "Credit was your default this round. Next time, try sitting with the discomfort of one 'no' before reaching for it.";
  } else if (waited >= 3) {
    takeaway = "You waited a lot. Waiting is a decision too — worth asking what you're waiting for.";
  } else if (steady >= ROUND_LENGTH - 1) {
    takeaway = "You held steady the whole way through. That's harder than it looks.";
  } else if (clearedDebt >= 2) {
    takeaway = "You chose the unglamorous option more than once. That compounds.";
  } else if (drew >= 3) {
    takeaway = "Your buffer did a lot of work this round. Worth noticing what kept pulling at it.";
  } else {
    takeaway = "Mixed round. The patterns get clearer the more decisions you make.";
  }

  return {
    roundNumber,
    headline: pattern.headline,
    factLine,
    takeaway,
    tone: pattern.tone,
    narrative: buildRoundNarrative(slice),
    stats: { built, clearedDebt, usedCredit, drew, waited, steady, of: slice.length },
    beliefsTouched,
  };
}
