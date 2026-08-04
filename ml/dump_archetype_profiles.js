// Dumps fbm.js's hand-tuned AXIS_KEYS + ARCHETYPE_PROFILES (the 11 target
// vectors the current nearest-neighbor matcher compares a quiz result
// against) to JSON, so ml/archetype_synthetic.py can test empirical
// clustering against the SAME hand-designed structure this app already
// ships — the honest way to ask "would clustering recover these 11 groups"
// without real user data to cluster instead.
//
// Run manually and commit the result whenever fbm.js's archetypes change:
//   node ml/dump_archetype_profiles.js && git add ml/archetype_profiles.json
const fs = require("fs");
const path = require("path");
const { AXIS_KEYS, ARCHETYPE_PROFILES } = require(path.join(__dirname, "..", "fbm.js"));

const outPath = path.join(__dirname, "archetype_profiles.json");
fs.writeFileSync(outPath, JSON.stringify({ axis_keys: AXIS_KEYS, archetype_profiles: ARCHETYPE_PROFILES }, null, 2));
console.log(`Wrote ${Object.keys(ARCHETYPE_PROFILES).length} archetype profiles to ${outPath}`);
