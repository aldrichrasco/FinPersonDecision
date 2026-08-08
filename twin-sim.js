// Twin simulation: watch a model of you make decisions without you.
//
// Three agents run the same scenarios in the same order:
//
//   you        decides using the rules your twin has actually learned
//   archetype  decides the way a textbook version of your archetype would
//   drift      decides at random, as a baseline
//
// The baseline is the part that keeps this honest. Any model looks impressive
// on its own; the only way to know whether "you" is a real pattern rather
// than noise is to run chance alongside it and see. If your line and the
// random line are tangled together, the twin has not found anything yet, and
// the readout says so rather than dressing it up.
//
// Everything is deterministic given a seed, so a result can be re-run and
// checked. No language model is involved in any outcome: the arithmetic is
// the same fixed arithmetic the sandbox uses.

// Compact scenario bank for simulation. Kept here rather than imported from
// dashboard.js because loading that file would boot the entire sandbox UI.
// Each carries the tags the twin's rules actually key on.
const SIM_SCENARIOS = [
  {
    text: "A flash sale ends in 10 minutes.", timed: true, surface: "bnpl", principle: "credit_is_free",
    choices: [
      { label: "Buy it now", delta: -400, flavor: "impulsive" },
      { label: "Close the tab", delta: 0, flavor: "conservative" },
      { label: "Save it for next month", delta: 50, flavor: "growth" },
    ],
  },
  {
    text: "Your employer matches contributions up to 6%.", timed: false, surface: "opportunity", principle: "catch_up_later",
    choices: [
      { label: "Contribute the full 6%", delta: 1500, flavor: "growth" },
      { label: "Contribute 3%", delta: 750, flavor: "conservative" },
      { label: "Skip it", delta: 0, flavor: "uncertain" },
    ],
  },
  {
    text: "A subscription you forgot about just renewed.", timed: false, surface: "subscription", principle: "id_notice",
    choices: [
      { label: "Cancel and check for others", delta: 180, flavor: "conservative" },
      { label: "Let it slide", delta: -90, flavor: "uncertain" },
      { label: "Cancel just this one", delta: 90, flavor: "conservative" },
    ],
  },
  {
    text: "Open enrollment closes tonight.", timed: true, surface: "subscription", principle: "id_notice",
    choices: [
      { label: "Compare two plans properly", delta: 240, flavor: "conservative" },
      { label: "Auto-renew last year's", delta: -120, flavor: "uncertain" },
      { label: "Take the cheapest without reading", delta: -40, flavor: "impulsive" },
    ],
  },
  {
    text: "A relative asks to borrow money.", timed: false, surface: "family_loan", principle: "others_first",
    choices: [
      { label: "Lend it, no questions", delta: -500, flavor: "generous" },
      { label: "Ask what it's for first", delta: -200, flavor: "generous" },
      { label: "Offer help that isn't cash", delta: 0, flavor: "conservative" },
    ],
  },
  {
    text: "Your car needs a repair to pass inspection today.", timed: true, surface: "obligation", principle: "catch_up_later",
    choices: [
      { label: "Pay from savings", delta: -900, flavor: "conservative" },
      { label: "Put it on a card", delta: -1200, flavor: "impulsive" },
      { label: "Delay it", delta: -300, flavor: "uncertain" },
    ],
  },
  {
    text: "You get an unexpected refund.", timed: false, surface: "windfall", principle: "more_saved_is_better",
    choices: [
      { label: "Pay down debt", delta: 900, flavor: "conservative" },
      { label: "Invest it", delta: 1100, flavor: "growth" },
      { label: "Treat yourself", delta: -200, flavor: "impulsive" },
    ],
  },
  {
    text: "A stock you watch drops sharply. The window feels short.", timed: true, surface: "opportunity", principle: "this_time_different",
    choices: [
      { label: "Buy more while it's down", delta: 700, flavor: "growth" },
      { label: "Hold and wait", delta: 200, flavor: "conservative" },
      { label: "Sell before it worsens", delta: -450, flavor: "uncertain" },
    ],
  },
];

// Small deterministic PRNG so a run can be reproduced and audited. Same
// mulberry32 the turtle simulator uses, for consistency.
function simRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------- policies
// Each returns a choice index. The point is that these are genuinely
// different decision procedures, not the same one with noise added.

// YOU: consult the twin's confirmed rules. Where a rule applies, behave the
// way the rule says you behave, including when that is the worse option. This
// agent is not trying to win; it is trying to be you.
function policyYou(twin, scenario, rng) {
  const applies = id => twin && twin.confirmed.some(r => r.id === id);

  if (scenario.timed && applies("deadline_breaks_pause")) {
    // The rule says the pause fails under a deadline: take the fastest,
    // least-deliberated option available.
    const impulsive = scenario.choices.findIndex(c => c.flavor === "impulsive");
    if (impulsive >= 0) return impulsive;
    const uncertain = scenario.choices.findIndex(c => c.flavor === "uncertain");
    if (uncertain >= 0) return uncertain;
  }
  if ((scenario.principle === "id_notice" || scenario.surface === "subscription") && applies("avoids_looking")) {
    const defer = scenario.choices.findIndex(c => c.flavor === "uncertain");
    if (defer >= 0) return defer;
  }
  if (["family_loan", "obligation"].includes(scenario.surface) && applies("gives_when_asked")) {
    const give = scenario.choices.findIndex(c => c.flavor === "generous");
    if (give >= 0) return give;
  }
  if (["catch_up_later", "more_saved_is_better"].includes(scenario.principle) && applies("future_over_present")) {
    let best = 0;
    scenario.choices.forEach((c, i) => { if (c.delta > scenario.choices[best].delta) best = i; });
    return best;
  }
  if (!scenario.timed && applies("calm_holds")) {
    const careful = scenario.choices.findIndex(c => c.flavor === "conservative");
    if (careful >= 0) return careful;
  }
  // No rule covers this. The twin does not pretend to know, so it falls back
  // to chance rather than inventing a preference it has no evidence for.
  return Math.floor(rng() * scenario.choices.length);
}

// ARCHETYPE: the textbook version. Decides by the flavour its group favours,
// consistently, without the exceptions a real person has.
const ARCHETYPE_FLAVOR = {
  conservative: ["conservative", "growth", "generous"],
  growth: ["growth", "conservative", "impulsive"],
  impulsive: ["impulsive", "growth", "uncertain"],
  uncertain: ["uncertain", "conservative", "growth"],
  generous: ["generous", "conservative", "growth"],
};
function policyArchetype(group, scenario) {
  const order = ARCHETYPE_FLAVOR[group] || ARCHETYPE_FLAVOR.conservative;
  for (const flavor of order) {
    const i = scenario.choices.findIndex(c => c.flavor === flavor);
    if (i >= 0) return i;
  }
  return 0;
}

// DRIFT: the baseline. Uniform random.
function policyDrift(scenario, rng) {
  return Math.floor(rng() * scenario.choices.length);
}

// ----------------------------------------------------------------- runner
function runTwinSimulation(twin, archetypeGroup, opts) {
  const o = opts || {};
  const rounds = o.rounds || 16;
  const seed = o.seed || 20260809;

  // Separate streams so one agent's draws cannot shift another's. Sharing a
  // stream would make the comparison depend on call order, which is a subtle
  // way to get a result that looks meaningful and is not.
  const rngYou = simRng(seed);
  const rngDrift = simRng(seed + 977);

  const tracks = { you: [0], archetype: [0], drift: [0] };
  const log = [];

  for (let i = 0; i < rounds; i++) {
    const scenario = SIM_SCENARIOS[i % SIM_SCENARIOS.length];
    const picks = {
      you: policyYou(twin, scenario, rngYou),
      archetype: policyArchetype(archetypeGroup, scenario),
      drift: policyDrift(scenario, rngDrift),
    };
    ["you", "archetype", "drift"].forEach(k => {
      const last = tracks[k][tracks[k].length - 1];
      tracks[k].push(last + scenario.choices[picks[k]].delta);
    });
    log.push({
      round: i + 1,
      scenario: scenario.text,
      timed: scenario.timed,
      you: scenario.choices[picks.you].label,
      archetype: scenario.choices[picks.archetype].label,
      drift: scenario.choices[picks.drift].label,
      diverged: picks.you !== picks.archetype,
    });
  }

  const final = k => tracks[k][tracks[k].length - 1];
  const youVsDrift = final("you") - final("drift");
  const spread = Math.max(...["you", "archetype", "drift"].map(final)) -
                 Math.min(...["you", "archetype", "drift"].map(final));

  return {
    rounds, seed, tracks, log,
    final: { you: final("you"), archetype: final("archetype"), drift: final("drift") },
    gapToArchetype: final("archetype") - final("you"),
    divergences: log.filter(l => l.diverged).length,
    // The honesty check. If "you" is not clearly distinguishable from chance,
    // say so instead of presenting the run as a finding.
    beatsChance: spread > 0 ? Math.abs(youVsDrift) / spread > 0.25 : false,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SIM_SCENARIOS, runTwinSimulation, simRng, policyArchetype };
}
