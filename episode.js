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
  //
  // responseType says how to read `response`, because the lab collects more
  // than one shape of answer and a consumer that assumes an index will
  // silently misread an allocation. `actual` stays the choice index and is
  // null for every non-choice format, rather than being overloaded to mean
  // different things in different rooms.
  behaviour: ["choice", "actual", "flavor", "expired", "responseType", "response",
              "latencyMs"],

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
const EPISODE_REQUIRED = ["at", "scenario"];

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
  if (out.responseType === null) out.responseType = "choice";
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
  const type = ep.responseType || "choice";
  if (type === "choice") {
    if (typeof ep.actual !== "number") return "a choice episode needs an option index";
  } else if (ep.response === null || ep.response === undefined) {
    return `a ${type} episode needs a response`;
  }
  return null;
}

// The response formats the lab can collect. Each measures something the
// others cannot: a choice reveals direction, an allocation reveals magnitude,
// and a titration reveals a parameter you can put a number on.
const RESPONSE_TYPES = {
  CHOICE: "choice",           // one option from k. Direction only.
  ALLOCATION: "allocation",   // split a pot across buckets. Magnitude.
  RANKING: "ranking",         // order k items. Priority structure.
  TITRATION: "titration",     // repeated binary at varying amounts. A parameter.
  THRESHOLD: "threshold",     // name your own number. A reservation price.
  RECALL: "recall",           // what do you think you did last time. Self-model.
  RULE: "rule",               // a commitment about future behaviour.
  TEXT: "text",               // qualitative. Never scored, only read.
};

// Which questions this episode can actually answer. The analytics layer asks
// before computing, so a metric is never derived from episodes that were
// never capable of supporting it. This is what stops a room that does not
// capture a self-prediction from contributing zeros to a self-accuracy figure
// and dragging it toward the floor.
function episodeSupports(ep) {
  if (!ep) return {};
  const has = f => ep[f] !== null && ep[f] !== undefined;
  const type = ep.responseType || RESPONSE_TYPES.CHOICE;
  const isChoice = type === RESPONSE_TYPES.CHOICE;
  return {
    responseType: type,
    // Accuracy metrics assume a choice index. An allocation is scored by
    // distance and a titration by the parameter it estimates, so letting them
    // into a hit-rate calculation would be comparing unlike things.
    scorableAsChoice: isChoice,
    selfAccuracy: isChoice && has("predicted"),
    twinAccuracy: isChoice && has("twinPredicted"),
    // Both forecasts present, which is the only case where a disagreement
    // between them means anything.
    twinAdvantage: isChoice && has("predicted") && has("twinPredicted"),
    goalAlignment: has("goal") && has("servesGoal"),
    counterfactual: has("predictedNetWorthDelta"),
    // The held-out arm: a twin call with no self-prediction in front of it.
    unprimed: isChoice && has("twinPredicted") && ep.selfAsked === false,
    // Continuous formats carry more information per episode than a choice
    // does, which is what lets a single template produce a usable estimate.
    parametric: type === RESPONSE_TYPES.TITRATION || type === RESPONSE_TYPES.THRESHOLD,
    magnitude: type === RESPONSE_TYPES.ALLOCATION,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EPISODE_VERSION, EPISODE_FIELDS, EPISODE_ALL_FIELDS, EPISODE_REQUIRED,
    RESPONSE_TYPES,
    buildEpisode, episodeProblem, episodeSupports,
  };
}
