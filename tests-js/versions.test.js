const test = require("node:test");
const assert = require("node:assert");
const { FP_VERSIONS, fpDigest, fpScenarioStamp, fpVersionSpan } = require("../versions.js");

const scenario = () => ({
  id: "rent_rise",
  text: "Your landlord raises the rent by 12%.",
  choices: [
    { label: "Absorb it", delta: { cash: -400 } },
    { label: "Move", delta: { cash: -1200, savings: 200 } },
  ],
});

test("the digest is stable across calls and differs on different input", () => {
  assert.strictEqual(fpDigest("abc"), fpDigest("abc"));
  assert.notStrictEqual(fpDigest("abc"), fpDigest("abd"));
  assert.match(fpDigest("abc"), /^[0-9a-f]{8}$/);
});

test("a stamp carries the declared version so data can be filtered on it", () => {
  assert.ok(fpScenarioStamp(scenario()).startsWith(FP_VERSIONS.scenarios + "."));
});

test("rewording a scenario moves its digest", () => {
  const before = fpScenarioStamp(scenario());
  const after = fpScenarioStamp(Object.assign(scenario(), { text: "Your landlord raises the rent by 20%." }));
  assert.notStrictEqual(before, after);
});

test("reordering the options moves the digest", () => {
  // predicted_index and actual_index are stored as positions, so a reorder
  // silently changes what an identical stored row means. It has to register.
  const s = scenario();
  const flipped = Object.assign(scenario(), { choices: [s.choices[1], s.choices[0]] });
  assert.notStrictEqual(fpScenarioStamp(s), fpScenarioStamp(flipped));
});

test("changing what an option costs moves the digest", () => {
  const cheaper = scenario();
  cheaper.choices[0].delta = { cash: -50 };
  assert.notStrictEqual(fpScenarioStamp(scenario()), fpScenarioStamp(cheaper));
});

test("an unchanged scenario keeps the same stamp", () => {
  assert.strictEqual(fpScenarioStamp(scenario()), fpScenarioStamp(scenario()));
});

test("a span over one version is not reported as mixed", () => {
  const span = fpVersionSpan([
    { scenarioVersion: "sandbox-1.aaaaaaaa" },
    { scenarioVersion: "sandbox-1.bbbbbbbb" },
  ]);
  assert.deepStrictEqual(span.versions, ["sandbox-1"]);
  assert.strictEqual(span.mixed, false);
});

test("a span across two declared versions is reported as mixed", () => {
  const span = fpVersionSpan([
    { scenarioVersion: "sandbox-1.aaaaaaaa" },
    { scenario_version: "sandbox-2.cccccccc" },
  ]);
  assert.strictEqual(span.mixed, true, "server rows arrive snake_cased and must still count");
  assert.strictEqual(span.versions.length, 2);
});

test("unstamped rows are ignored rather than counted as the current version", () => {
  const span = fpVersionSpan([{}, { scenarioVersion: null }]);
  assert.deepStrictEqual(span.versions, []);
  assert.strictEqual(span.mixed, false);
});
