// Experiments as configuration.
//
// The alternative is a folder per room, each with its own storage shape, its
// own accuracy maths and its own idea of what a decision is. That is how the
// four subsystems currently reading decisions would end up reading eight
// incompatible things, and it is much cheaper to prevent than to unpick.
//
// An experiment declares four things and nothing else:
//
//   captures  what it collects. The analytics layer asks this before computing
//             a metric, so a room that never captures a self-prediction is
//             excluded from self-accuracy rather than contributing zeros.
//   conditions the arms a decision can be assigned to. One arm means the room
//             observes rather than manipulates, which is honest and common.
//   metrics   what the room is FOR. Declared up front so a room cannot quietly
//             acquire a finding it was not designed to support.
//   assign    how a decision lands in an arm. Deterministic, never a fresh
//             roll, so a re-render cannot move a decision between arms.
//
// Presentation is not here. How a room looks is a rendering concern and
// putting it in the config is how config files turn into frameworks.

const EXPERIMENTS = {
  // The existing sandbox, named as what it is. Its "manipulation" is the
  // held-out self-prediction arm, which exists to measure whether asking
  // someone to forecast themselves makes them more predictable.
  twin_arena: {
    id: "twin_arena",
    label: "Twin Arena",
    question: "Can your twin predict you better than you can?",
    responseTypes: ["choice"],
    captures: ["predicted", "twinPredicted", "actual", "flavor", "timed",
               "netWorthDelta", "predictedNetWorthDelta", "servesGoal"],
    conditions: ["primed", "unprimed"],
    metrics: ["selfAccuracy", "twinAccuracy", "twinAdvantage", "goalAlignment"],
    // 3 in 4 primed. Spread rather than clustered so an arm is not confounded
    // with position in the run.
    assign: n => (n % 4) === 2 ? "unprimed" : "primed",
  },

  // Parametric elicitation. Registered as ready because, unlike the pressure
  // room, it needs no authored scenarios: the information lives in the amounts
  // rather than in a story, so one template generates a whole run.
  trade_off_studio: {
    id: "trade_off_studio",
    label: "Trade-Off Studio",
    question: "What is waiting actually worth to you?",
    responseTypes: ["titration", "allocation", "threshold"],
    captures: ["response", "responseType", "latencyMs"],
    conditions: ["gain", "loss"],
    metrics: ["discountRate", "allocationConcentration"],
    // Gains and losses are discounted differently by most people, and running
    // both arms is what makes that visible rather than averaging it away.
    assign: n => (n % 2) === 0 ? "gain" : "loss",
  },

  // The room whose value is scientific rather than experiential: the only one
  // that manipulates a variable instead of observing whichever one the
  // scenario happened to contain.
  //
  // Registered without content on purpose. The engine is ready; the scenarios
  // are not. It needs PAIRED scenarios, the same decision under each
  // condition, and unpaired ones cannot measure a shift no matter how the room
  // is coded. Declaring it keeps the contract visible and makes obvious that
  // what is missing is authoring, not architecture.
  pressure_chamber: {
    id: "pressure_chamber",
    label: "Pressure Chamber",
    question: "Does pressure change what you choose?",
    responseTypes: ["choice"],
    captures: ["predicted", "twinPredicted", "actual", "flavor", "timed",
               "netWorthDelta", "servesGoal"],
    conditions: ["baseline", "time_pressure", "social_pressure"],
    metrics: ["twinAccuracy", "pressureSensitivity", "contextSensitivity"],
    // Rotates so each person meets every arm rather than being assigned to one
    // for life. Within-person comparison is the whole point: the question is
    // whether YOUR behaviour shifts, which a between-person design cannot
    // answer at this sample size.
    assign: n => ["baseline", "time_pressure", "social_pressure"][n % 3],
    ready: false,
    blockedOn: "paired scenarios: the same decision authored under each condition",
  },
};

function getExperiment(id) {
  return EXPERIMENTS[id] || null;
}

// Rooms that can actually run. Everything else is declared but withheld, which
// is better than a room that renders and collects nothing usable.
function readyExperiments() {
  return Object.keys(EXPERIMENTS)
    .map(k => EXPERIMENTS[k])
    .filter(x => x.ready !== false);
}

// Which arm this decision belongs to.
function assignCondition(experimentId, decisionIndex) {
  const x = getExperiment(experimentId);
  if (!x || !x.assign) return null;
  const n = typeof decisionIndex === "number" ? decisionIndex : 0;
  return x.assign(n);
}

// Whether an experiment is allowed to report a metric. Guards against a room
// growing a finding it was never designed to support: if pressure_chamber
// starts reporting self-accuracy, that is a bug, not a bonus, because it never
// declared that it captures a clean self-prediction under every arm.
function experimentSupports(experimentId, metric) {
  const x = getExperiment(experimentId);
  return !!(x && x.metrics.indexOf(metric) !== -1);
}

// Splits episodes by condition, for any metric that compares arms. Returns
// null unless at least two arms have enough to compare, because a "shift"
// computed against an empty arm is not a shift.
const MIN_PER_ARM = 3;

function byCondition(episodes, minPerArm) {
  const floor = minPerArm || MIN_PER_ARM;
  const arms = {};
  (episodes || []).forEach(e => {
    const c = e && e.condition;
    if (!c) return;
    (arms[c] = arms[c] || []).push(e);
  });
  const usable = Object.keys(arms).filter(k => arms[k].length >= floor);
  if (usable.length < 2) return null;
  const out = {};
  usable.forEach(k => { out[k] = arms[k]; });
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EXPERIMENTS, MIN_PER_ARM,
    getExperiment, readyExperiments, assignCondition,
    experimentSupports, byCondition,
  };
}
