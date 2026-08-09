// What produced this data.
//
// Every stored decision is evidence for a claim about a person, and that claim
// only holds if you know which instrument produced it. Six months from now,
// two users with different reports could differ because they behaved
// differently, or because the scenario was reworded, the rule set grew, or the
// report thresholds moved between their sessions. Without a stamp on the row,
// those are indistinguishable, and every finding drawn across the boundary is
// quietly pooling two different measurements.
//
// Two stamps, because they fail differently:
//
//   The DECLARED version is a human statement of intent. It is the thing to
//   read, cite and filter on, and it is bumped deliberately when a change
//   means the old and new data should not be compared.
//
//   The DIGEST is computed from the content itself at load. Declared versions
//   go stale the moment someone fixes a scenario's wording and forgets to bump
//   one, and that is the single most likely way this whole scheme fails. When
//   the digest moves and the declared version did not, the data still records
//   that the two runs were not the same instrument, and the report can say so
//   rather than pooling them.
//
// The digest is not a security hash. It is FNV-1a, chosen because it is short,
// synchronous, dependency-free and stable across engines; collisions between
// two edits of the same scenario are not a threat worth defending against.

// Bump when a change means old and new data should not be compared.
const FP_VERSIONS = {
  // The formal assessment: item set, wording and scoring.
  instrument: "quiz-1",
  // The sandbox scenario set: which situations exist and what the options are.
  scenarios: "sandbox-1",
  // The twin's rule set and rivalries, plus their thresholds.
  twin: "twin-2",
  // How the free report derives findings from decisions.
  report: "mri-1",
};

function fpDigest(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? "" : str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// A stamp for one scenario. Deliberately covers the option labels and their
// deltas as well as the prompt, because predicted_index and actual_index are
// stored as positions: reordering the options, or changing what an option
// costs, silently changes what an identical stored row means.
function fpScenarioStamp(scenario) {
  if (!scenario) return null;
  const parts = [
    scenario.id || "",
    scenario.text || scenario.title || "",
    ((scenario.choices || []).map(c => {
      const delta = c && c.delta ? Object.keys(c.delta).sort()
        .map(k => `${k}:${c.delta[k]}`).join(",") : "";
      return `${(c && c.label) || ""}|${delta}`;
    })).join("~"),
  ];
  return `${FP_VERSIONS.scenarios}.${fpDigest(parts.join(""))}`;
}

// A stamp for the belief model. Covers rule and rivalry identity plus the
// thresholds, since moving TWIN_CONFIRM_RATE changes which beliefs exist
// without touching a single rule.
function fpTwinStamp() {
  const ruleIds = (typeof TWIN_RULES !== "undefined")
    ? TWIN_RULES.map(r => r.id).join(",") : "";
  const rivalIds = (typeof TWIN_RIVALS !== "undefined")
    ? TWIN_RIVALS.map(r => `${r.id}:${r.a.id}/${r.b.id}`).join(",") : "";
  const thresholds = [
    typeof TWIN_MIN_EVIDENCE !== "undefined" ? TWIN_MIN_EVIDENCE : "",
    typeof TWIN_CONFIRM_RATE !== "undefined" ? TWIN_CONFIRM_RATE : "",
    typeof TWIN_CONTEST_RATE !== "undefined" ? TWIN_CONTEST_RATE : "",
  ].join("/");
  return `${FP_VERSIONS.twin}.${fpDigest([ruleIds, rivalIds, thresholds].join(""))}`;
}

// Whether a set of decisions spans more than one version of the instrument.
// The report calls this before pooling: a finding drawn across a boundary is
// mixing two measurements, and the honest move is to say so.
function fpVersionSpan(decisions, field) {
  const key = field || "scenarioVersion";
  const snake = key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
  const seen = new Set();
  (decisions || []).forEach(d => {
    const v = d && (d[key] != null ? d[key] : d[snake]);
    if (v) seen.add(String(v).split(".")[0]);
  });
  const versions = Array.from(seen);
  return { versions, mixed: versions.length > 1 };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FP_VERSIONS, fpDigest, fpScenarioStamp, fpTwinStamp, fpVersionSpan };
}
