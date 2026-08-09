// The laboratory: the twin commits to a choice before you make it.
//
// Until now the sandbox measured YOUR self-knowledge. You predicted what you
// would pick, then picked, and "matched" meant you knew yourself. That is a
// real finding, but it is not a test of the model. The twin only ever offered
// a tendency — "expects you'll decide quickly" — which cannot be scored
// against an option someone actually clicked. A prediction you cannot be
// wrong about is not a prediction.
//
// So the twin names an option. Before the scenario is answered it commits to
// one, in the open, and afterwards it is right or wrong with no room to
// reinterpret. That single change turns the sandbox into an instrument
// pointed at the model rather than at the person, and it makes the twin's
// accuracy something measured rather than asserted.
//
// It always commits, because a model that only speaks when confident cannot
// be caught being wrong. But it says what the commitment RESTS on, and the
// accuracy is reported per basis: a guess that happens to land is not the
// model knowing something, and pooling the two would manufacture a
// competence curve out of luck.
//
// The second idea here is that behaviour has a path. A rule that reads each
// decision alone cannot see that someone turns cautious right after a loss,
// or that their fourth decision in a sitting is worse than their first. Those
// are not properties of a scenario, they are properties of a sequence, and
// they are where most of the interesting behaviour actually lives.

// How the twin's commitment was arrived at, worst to best. Reported alongside
// every prediction so accuracy can be split by it.
const LAB_BASIS = { GUESS: "guess", ARCHETYPE: "archetype", PATH: "path", RULE: "rule" };

// A decision counts as a loss when it cost this much or more. Small negative
// deltas are the ordinary cost of living rather than an event someone reacts
// to, and treating them as losses would make every path look reactive.
const LAB_LOSS_THRESHOLD = 400;

// Decisions within this gap belong to the same sitting. Shared with the twin's
// learning-rate grouping, because "later in the session" has to mean the same
// thing in both places or the two readings will quietly disagree.
const LAB_SESSION_GAP_MS = 45 * 60 * 1000;

// What the sequence looks like at the moment of the next decision. Computed
// from history only, never from the scenario being faced, so a path feature
// can never accidentally encode the answer.
function pathFeatures(history) {
  const log = (history || []).slice();
  if (!log.length) {
    return { depth: 0, lastFlavor: null, lastLoss: false, lossStreak: 0, gainStreak: 0, priorCount: 0 };
  }
  const delta = d => (d.netWorthDelta ?? d.net_worth_delta ?? 0);

  // How many decisions have already been made in the current sitting. The
  // decision about to be faced is therefore number depth + 1, and rule
  // conditions are written against that. Fatigue resets when someone comes
  // back tomorrow, so a long gap ends the count.
  let depth = 1;
  for (let i = log.length - 1; i > 0; i--) {
    const gap = (log[i].at || 0) - (log[i - 1].at || 0);
    if (gap > LAB_SESSION_GAP_MS) break;
    depth++;
  }

  let lossStreak = 0, gainStreak = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (delta(log[i]) <= -LAB_LOSS_THRESHOLD) lossStreak++; else break;
  }
  for (let i = log.length - 1; i >= 0; i--) {
    if (delta(log[i]) > 0) gainStreak++; else break;
  }
  const last = log[log.length - 1];
  return {
    depth,
    lastFlavor: last.flavor || null,
    lastLoss: delta(last) <= -LAB_LOSS_THRESHOLD,
    lossStreak,
    gainStreak,
    priorCount: log.length,
  };
}

// Rules about the SEQUENCE. Each says which flavour it expects next and under
// what path condition. Support is counted only over decisions where the
// condition actually held, so a rule about losses is never credited by a run
// of decisions that had no loss in front of them.
const TWIN_PATH_RULES = [
  {
    id: "retreats_after_loss",
    axis: "risk_disposition",
    statement: "After a decision that costs you, you pull in.",
    expects: "conservative",
    when: p => p.lastLoss,
  },
  {
    id: "chases_after_loss",
    axis: "risk_disposition",
    statement: "After a decision that costs you, you reach for the bigger move.",
    // The direct opposite of the rule above, on the same trigger, so the two
    // cannot both be right about the same person. They are currently settled
    // by hit rate in twinPathRules, NOT by the rivalry engine in twin.js —
    // TWIN_RIVALS carries different pairs and does not know about these. That
    // is a weaker test than it should be, because a hit-rate comparison has no
    // discriminating-case requirement, and it is the next thing to fix here.
    expects: "growth",
    when: p => p.lastLoss,
  },
  {
    id: "late_session_slips",
    axis: "impulse_regulation",
    statement: "The further into a sitting you get, the less you deliberate.",
    expects: "impulsive",
    when: p => p.depth >= 4,
  },
  {
    id: "rides_a_run",
    axis: "risk_disposition",
    statement: "A couple of decisions that go your way and you start reaching.",
    expects: "growth",
    when: p => p.gainStreak >= 2,
  },
  {
    id: "repeats_last_move",
    axis: "financial_attentiveness",
    statement: "You tend to make the same kind of call you just made.",
    expects: null, // resolved to whatever the previous flavour was
    when: p => !!p.lastFlavor,
    flavorFor: p => p.lastFlavor,
    // The null model of sequences. It applies to nearly every decision, so on
    // volume alone it would outrank every substantive rule and the twin would
    // spend its life predicting "the same as last time". Kept because it is a
    // genuine pattern and a useful floor, but ranked last on purpose: a rule
    // that only says "people repeat themselves" explains nothing, and a twin
    // beating chance on it is not a twin that understands anything.
    baseline: true,
  },
];

// Minimum applicable decisions before a path rule may drive a commitment.
// Below this the rule is a coincidence with a name.
const LAB_PATH_MIN = 4;
const LAB_PATH_RATE = 0.6;

// Scores a path rule against history by replaying it: at each decision, was
// the condition true, and if so did the flavour come out as the rule expects?
function evaluatePathRule(rule, decisions) {
  const log = (decisions || []).filter(d => d.flavor);
  let support = 0, total = 0;
  for (let i = 1; i < log.length; i++) {
    const p = pathFeatures(log.slice(0, i));
    if (!rule.when(p)) continue;
    const expected = rule.flavorFor ? rule.flavorFor(p) : rule.expects;
    if (!expected) continue;
    total++;
    if (log[i].flavor === expected) support++;
  }
  const rate = total ? support / total : 0;
  return {
    id: rule.id, axis: rule.axis, statement: rule.statement,
    support, total, rate: Math.round(rate * 100),
    holds: total >= LAB_PATH_MIN && rate >= LAB_PATH_RATE,
  };
}

function twinPathRules(decisions) {
  return TWIN_PATH_RULES.map(r => Object.assign(
      evaluatePathRule(r, decisions), { baseline: r.baseline === true }))
    .filter(r => r.total > 0)
    // Substantive rules first regardless of volume, then by strength. The
    // baseline sinks to the bottom even when it is the best-supported thing
    // in the log, because it is what a real explanation has to beat.
    .sort((a, b) => (a.baseline - b.baseline) || (b.rate - a.rate) || (b.total - a.total));
}

// FNV-1a, kept local so this file has no load-order dependency on versions.js.
// Used only to seed the guess, never for anything that must be secure.
function fpDigestLocal(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? "" : str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Which option index carries a flavour. Returns -1 when the scenario has no
// such option, which is normal: not every situation offers a generous move.
//
// NOTE: 11 of the 16 scenarios in the bank contain two options sharing a
// flavour, so this picks arbitrarily between them most of the time. That is
// why the scored claim is the FLAVOUR match, not the index match: the twin
// genuinely predicts the kind of move, and pretending it predicted the exact
// option would be counting a coin flip as skill. The index is what gets shown,
// because "it said you'd take this one" is what a person can check.
function indexOfFlavor(scenario, flavor) {
  if (!scenario || !flavor) return -1;
  return (scenario.choices || []).findIndex(c => c && c.flavor === flavor);
}

// What the confirmed single-decision rules imply about flavour here. Mirrors
// the conditions in twinPredict so the laboratory and the twin page cannot
// drift into telling the person two different things.
function ruleFlavor(twin, scenario) {
  if (!twin || !twin.confirmed || !twin.confirmed.length) return null;
  const s = scenario || {};
  const map = [
    { id: "deadline_breaks_pause", applies: () => s.timed === true, flavor: "impulsive" },
    { id: "avoids_looking", applies: () => s.principle === "id_notice" || s.surface === "subscription", flavor: "uncertain" },
    { id: "gives_when_asked", applies: () => ["family_loan", "obligation"].includes(s.surface), flavor: "generous" },
    { id: "future_over_present", applies: () => ["catch_up_later", "more_saved_is_better"].includes(s.principle), flavor: "conservative" },
    { id: "spends_to_grow", applies: () => s.surface === "opportunity", flavor: "growth" },
  ];
  for (const m of map) {
    const rule = twin.confirmed.find(r => r.id === m.id);
    if (rule && m.applies() && indexOfFlavor(s, m.flavor) >= 0) {
      return { flavor: m.flavor, rule };
    }
  }
  return null;
}

// The commitment. Always returns an option index so the twin can always be
// scored, and always says what the choice rested on so a lucky guess is never
// counted as knowledge.
function twinCommit(twin, scenario, history, archetypeFlavor) {
  if (!scenario || !(scenario.choices || []).length) return null;

  const path = pathFeatures(history);
  const scored = twinPathRules(history).filter(r => r.holds);

  // 1. A path rule that holds, and whose condition is true right now.
  for (const r of scored) {
    const def = TWIN_PATH_RULES.find(x => x.id === r.id);
    if (!def || !def.when(path)) continue;
    const flavor = def.flavorFor ? def.flavorFor(path) : def.expects;
    const idx = indexOfFlavor(scenario, flavor);
    if (idx >= 0) {
      return {
        index: idx, flavor, basis: LAB_BASIS.PATH, ruleId: r.id,
        because: r.statement,
        evidence: `held in ${r.support} of ${r.total} decisions where it applied`,
      };
    }
  }

  // 2. A confirmed rule about this kind of situation.
  const rf = ruleFlavor(twin, scenario);
  if (rf) {
    return {
      index: indexOfFlavor(scenario, rf.flavor), flavor: rf.flavor,
      basis: LAB_BASIS.RULE, ruleId: rf.rule.id,
      because: rf.rule.statement || rf.rule.refined,
      evidence: `${rf.rule.support} of ${rf.rule.total} decisions`,
    };
  }

  // 3. The archetype's default move, when the scenario offers it.
  if (archetypeFlavor) {
    const idx = indexOfFlavor(scenario, archetypeFlavor);
    if (idx >= 0) {
      return {
        index: idx, flavor: archetypeFlavor, basis: LAB_BASIS.ARCHETYPE,
        because: "Going on your archetype, not on anything you have done here yet.",
        evidence: "no confirmed rule covers this situation",
      };
    }
  }

  // 4. Nothing to go on. It still commits, and says so plainly, because a
  //    model that goes quiet whenever it is unsure can never be shown to be
  //    wrong and its accuracy stops meaning anything.
  //
  //    This used to default to the conservative option, which was a mistake
  //    that quietly wrecked the whole measurement: conservative is 43% of the
  //    options in the bank, so the arm labelled "guess" was really a tuned
  //    modal-response prior. It would have beaten a 1/k baseline while knowing
  //    nothing, and every per-basis comparison downstream would have inherited
  //    that. A guess has to actually be a guess.
  //
  //    Seeded off the scenario so a given person meets the same guess every
  //    time rather than a fresh roll on each render, which keeps the record
  //    reproducible for research without biasing it toward any flavour.
  const seed = fpDigestLocal(String(scenario.id || scenario.text || ""));
  const idx = seed % scenario.choices.length;
  return {
    index: idx, flavor: (scenario.choices[idx] || {}).flavor || null,
    basis: LAB_BASIS.GUESS, ruleId: null,
    because: "A guess. Your twin has nothing on this kind of decision yet.",
    evidence: "counted separately from the rest of its record",
  };
}

// The twin's record, split by what each call rested on. Guesses are reported
// apart from reasoned calls: pooling them would let luck early on look like
// competence, which is the exact claim this whole feature exists to test.
function twinLabAccuracy(decisions) {
  const scored = (decisions || []).filter(d =>
    typeof d.twinPredicted === "number" && typeof d.actual === "number");
  if (!scored.length) return null;

  // The scored claim is the FLAVOUR, not the option index. 11 of the 16
  // scenarios contain two options sharing a flavour, so an index match is
  // part skill and part coin flip, and counting it as skill would inflate
  // every figure below. Falls back to the index only for rows recorded
  // before flavour scoring existed.
  const hit = d => (typeof d.twinFlavorCorrect === "boolean" ? d.twinFlavorCorrect : d.twinCorrect === true);

  const bucket = key => {
    const rows = key ? scored.filter(d => d.twinBasis === key) : scored;
    if (!rows.length) return null;
    const hits = rows.filter(hit).length;
    return { n: rows.length, hits, rate: Math.round((hits / rows.length) * 100) };
  };

  const reasoned = scored.filter(d => d.twinBasis && d.twinBasis !== LAB_BASIS.GUESS);
  const reasonedHits = reasoned.filter(hit).length;

  // Two baselines, and the harder one is the one that counts.
  //
  // 1/k is what you beat by knowing nothing about the person but something
  // about the bank. Since 43% of the options in this bank are conservative,
  // a predictor that always said "conservative" would clear a 1/3 baseline
  // comfortably while having learned nothing at all. Quoting only 1/k would
  // therefore let base-rate luck be reported as skill, which is the exact
  // claim this whole feature exists to test.
  //
  // So the bar is the modal-response rate: how often the single most common
  // flavour in the bank turns out to be what the person chose. A twin worth
  // paying for has to beat the obvious guess, not the uniform one.
  const chance = scored.reduce((a, d) => a + (1 / Math.max(2, d.optionCount || 3)), 0) / scored.length;
  const flavorCounts = {};
  scored.forEach(d => { if (d.flavor) flavorCounts[d.flavor] = (flavorCounts[d.flavor] || 0) + 1; });
  const modalN = Object.values(flavorCounts).sort((a, b) => b - a)[0] || 0;
  const modal = scored.length ? modalN / scored.length : 0;
  const bar = Math.max(chance, modal);

  return {
    overall: bucket(null),
    byBasis: {
      rule: bucket(LAB_BASIS.RULE),
      path: bucket(LAB_BASIS.PATH),
      archetype: bucket(LAB_BASIS.ARCHETYPE),
      guess: bucket(LAB_BASIS.GUESS),
    },
    reasoned: reasoned.length
      ? { n: reasoned.length, hits: reasonedHits, rate: Math.round((reasonedHits / reasoned.length) * 100) }
      : null,
    chance: Math.round(chance * 100),
    modal: Math.round(modal * 100),
    bar: Math.round(bar * 100),
    // A one-sided binomial test against the harder baseline, rather than a
    // hand-picked margin. The old gate (n >= 8 and rate > chance + 0.12) fired
    // on pure luck 26% of the time against 1/3, and 48% against the modal
    // rate: a coin flip presented as a finding. This asks for a result that
    // would happen by chance less than 5% of the time, and still refuses to
    // speak below a sample where that test means anything.
    beatsChance: reasoned.length >= 12 &&
      binomTailP(reasonedHits, reasoned.length, bar) < 0.05,
    p: reasoned.length ? Number(binomTailP(reasonedHits, reasoned.length, bar).toFixed(4)) : null,
  };
}

// P(X >= k) for X ~ Binomial(n, p). Computed iteratively so the coefficients
// stay in range for the sample sizes involved here.
function binomTailP(k, n, p) {
  if (!n || p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  let sum = 0, term = Math.pow(1 - p, n);
  for (let i = 0; i <= n; i++) {
    if (i >= k) sum += term;
    term = term * ((n - i) / (i + 1)) * (p / (1 - p));
  }
  return Math.min(1, Math.max(0, sum));
}

// The twin's accuracy over time, in blocks, so the learning curve is visible
// rather than asserted. Returns null when there is not enough for two blocks,
// because a single block is a number, not a trajectory.
function twinLabTrajectory(decisions, blockSize) {
  const size = blockSize || 5;
  const scored = (decisions || []).filter(d => typeof d.twinPredicted === "number");
  if (scored.length < size * 2) return null;
  const hit = d => (typeof d.twinFlavorCorrect === "boolean" ? d.twinFlavorCorrect : d.twinCorrect === true);
  const blocks = [];
  for (let i = 0; i + size <= scored.length; i += size) {
    const chunk = scored.slice(i, i + size);
    const hits = chunk.filter(hit).length;
    blocks.push({ from: i + 1, to: i + size, rate: Math.round((hits / size) * 100) });
  }
  const first = blocks[0].rate, last = blocks[blocks.length - 1].rate;
  const move = last - first;
  return {
    blocks, first, last, move,
    direction: move >= 15 ? "learning" : move <= -15 ? "losing ground" : "flat",
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LAB_BASIS, LAB_LOSS_THRESHOLD, LAB_PATH_MIN, TWIN_PATH_RULES,
    pathFeatures, evaluatePathRule, twinPathRules, indexOfFlavor,
    twinCommit, twinLabAccuracy, twinLabTrajectory, binomTailP,
  };
}

// --- the goal leg -----------------------------------------------------------
// Whether decisions served the objective the person set for themselves.
//
// Reported as a pattern and never as a verdict on a single decision, which is
// the stance situations.js already takes: the objective is a focus, not a
// score. Only decisions that actually moved the goal metric count, because a
// scenario about a subscription has nothing to say about a debt goal and
// counting it as a failure would measure the scenario mix rather than the
// person.
const GOAL_MIN_DECISIONS = 4;

function goalAlignment(decisions) {
  const relevant = (decisions || []).filter(d =>
    d.goal && (d.servesGoal === true || d.servesGoal === false));
  if (relevant.length < GOAL_MIN_DECISIONS) return null;

  // Never pool across two different goals. Someone who switched from paying
  // down debt to building savings has two records, not one blended one.
  const byGoal = {};
  relevant.forEach(d => { (byGoal[d.goal] = byGoal[d.goal] || []).push(d); });
  const goals = Object.keys(byGoal)
    .map(metric => {
      const rows = byGoal[metric];
      const served = rows.filter(d => d.servesGoal === true).length;
      return { metric, n: rows.length, served, rate: Math.round((served / rows.length) * 100) };
    })
    .filter(g => g.n >= GOAL_MIN_DECISIONS)
    .sort((a, b) => b.n - a.n);
  if (!goals.length) return null;

  const main = goals[0];
  return {
    goals, main,
    // Stated without a target to hit. There is no correct alignment rate: a
    // person with a debt goal still has to eat, and a product that implied
    // 100% was the aim would be lying about how money works.
    mixed: goals.length > 1,
  };
}

// --- self versus twin -------------------------------------------------------
// Four outcomes, because S and T are two separate forecasts of the same thing
// and their agreement is itself informative. When they disagree, the choice
// settles which of you was wrong about you, and that is the most interesting
// two seconds in the product.
function selfVsTwin(selfIndex, twinIndex, actualIndex) {
  if (typeof actualIndex !== "number") return null;
  const hasSelf = typeof selfIndex === "number";
  const hasTwin = typeof twinIndex === "number";
  if (!hasSelf || !hasTwin) return null;
  const selfRight = selfIndex === actualIndex;
  const twinRight = twinIndex === actualIndex;
  const agreed = selfIndex === twinIndex;
  if (agreed) {
    return selfRight
      ? { state: "both_right", headline: "You and your twin agreed, and you were both right." }
      // The most informative case in the whole design: the model and the
      // person's own forecast lined up and reality went elsewhere. Nothing
      // in the current evidence anticipated this.
      : { state: "both_wrong", headline: "You and your twin agreed, and you both got it wrong." };
  }
  if (twinRight) return { state: "twin_right", headline: "Your twin knew you better this time." };
  if (selfRight) return { state: "self_right", headline: "You knew yourself better than the model did." };
  return { state: "both_wrong", headline: "You disagreed, and neither of you called it." };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports.goalAlignment = goalAlignment;
  module.exports.selfVsTwin = selfVsTwin;
  module.exports.GOAL_MIN_DECISIONS = GOAL_MIN_DECISIONS;
}
