// The Decision Episode: one shape, every experiment.
//
// Four subsystems already read decisions: the Financial MRI's report, the
// twin's rule engine, the adaptive scenario selector, and the laboratory's
// accuracy figures. Until now they read an object whose shape was defined
// implicitly by whatever dashboard.js happened to pass in, which meant adding
// a field was safe and REMOVING or renaming one was a silent breakage
// discovered by a report section quietly rendering an empty state.
//
// So the shape is declared here, once, and every room in the lab produces it.
//
// Deliberately grown rather than designed. Every field below has code that
// writes it today. It is tempting to declare the full schema a laboratory
// might eventually want, but a schema that is mostly null cannot distinguish
// "not applicable to this experiment" from "nobody wired this up", and after a
// few months nobody can tell which. Fields arrive when their producer does.
//
// Grouped for reading, stored flat. Flat because the store is a SQL table and
// the twin's rules index single keys; nesting would buy tidiness in this file
// and cost a translation layer in five others.

const EPISODE_VERSION = 1;

// group -> fields. The grouping is documentation, not structure.
const EPISODE_FIELDS = {
  // Where and when. session/experiment are null in the free sandbox, which
  // runs no assignment; they exist for rooms that do.
  identity: ["at", "experimentType", "condition"],

  // What was being decided. Everything the twin is allowed to see BEFORE the
  // choice, and nothing that could only be known after.
  context: ["scenario", "surface", "principle", "timed", "optionCount",
            "goal", "goalDirection"],

  // The forecasts. Two of them, made independently, neither revealed to the
  // other. selfAsked distinguishes "was not asked" from "declined to answer",
  // which matters because one is our design and the other is their behaviour.
  prediction: ["predicted", "selfAsked", "twinPredicted", "twinBasis"],

  // What actually happened.
  behaviour: ["choice", "actual", "flavor", "expired"],

  // What it cost, and what the road not taken would have cost. The
  // counterfactual is knowable only at decision time, while the other options
  // are still in hand, so it has to be captured rather than derived later.
  outcome: ["netWorthDelta", "predictedNetWorthDelta", "servesGoal"],

  // Derived comparisons, stored rather than recomputed so that a later change
  // to the scoring rules cannot silently rewrite history.
  scoring: ["matched", "twinCorrect", "twinFlavorCorrect"],

  // Which instrument produced this. See versions.js.
  provenance: ["scenarioVersion", "modelVersion", "episodeVersion"],
};

const EPISODE_ALL_FIELDS = Object.keys(EPISODE_FIELDS)
  .reduce((all, group) => all.concat(EPISODE_FIELDS[group]), []);

// Fields without which an episode cannot answer the questions the lab exists
// to ask. An episode missing these is not a thin episode, it is a broken one.
const EPISODE_REQUIRED = ["at", "scenario", "actual"];

// Normalises whatever a room passes in into the canonical shape.
//
// Missing fields become null rather than being left undefined, so that a
// consumer reading episode.confidence gets a value meaning "not captured"
// instead of a key that may or may not exist depending on which room wrote it.
function buildEpisode(raw) {
  const src = raw || {};
  const out = {};
  EPISODE_ALL_FIELDS.forEach(f => {
    out[f] = src[f] === undefined ? null : src[f];
  });
  out.episodeVersion = EPISODE_VERSION;
  if (out.at === null) out.at = Date.now();
  // The free sandbox is itself an experiment, and naming it as one means the
  // analytics layer never has to special-case "the decisions from before we
  // had rooms".
  if (out.experimentType === null) out.experimentType = "twin_arena";
  return out;
}

// Why an episode is unusable, or null when it is fine. Returns the reason
// rather than a boolean because the caller wants to log which field was
// missing, and a bare false has thrown that away.
function episodeProblem(ep) {
  if (!ep || typeof ep !== "object") return "not an object";
  for (const f of EPISODE_REQUIRED) {
    if (ep[f] === null || ep[f] === undefined) return `missing ${f}`;
  }
  if (typeof ep.actual !== "number") return "actual must be a choice index";
  return null;
}

// Which questions this episode can actually answer. The analytics layer asks
// before computing, so a metric is never derived from episodes that were
// never capable of supporting it. This is what stops a room that does not
// capture a self-prediction from contributing zeros to a self-accuracy figure
// and dragging it toward the floor.
function episodeSupports(ep) {
  if (!ep) return {};
  const has = f => ep[f] !== null && ep[f] !== undefined;
  return {
    selfAccuracy: has("predicted"),
    twinAccuracy: has("twinPredicted"),
    // Both forecasts present, which is the only case where a disagreement
    // between them means anything.
    twinAdvantage: has("predicted") && has("twinPredicted"),
    goalAlignment: has("goal") && has("servesGoal"),
    counterfactual: has("predictedNetWorthDelta"),
    // The held-out arm: a twin call with no self-prediction in front of it.
    unprimed: has("twinPredicted") && ep.selfAsked === false,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EPISODE_VERSION, EPISODE_FIELDS, EPISODE_ALL_FIELDS, EPISODE_REQUIRED,
    buildEpisode, episodeProblem, episodeSupports,
  };
}
