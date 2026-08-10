const test = require("node:test");
const assert = require("node:assert");
const {
  EPISODE_ALL_FIELDS, buildEpisode, episodeProblem, episodeSupports,
} = require("../episode.js");
const {
  EXPERIMENTS, getExperiment, readyExperiments, assignCondition,
  experimentSupports, byCondition,
} = require("../experiments.js");

test("every episode gets every field, so consumers never see undefined", () => {
  const ep = buildEpisode({ scenario: "s", actual: 1 });
  EPISODE_ALL_FIELDS.forEach(f => {
    assert.ok(f in ep, `${f} must exist even when nothing captured it`);
    assert.notStrictEqual(ep[f], undefined);
  });
});

test("a missing field is null, which is distinguishable from a captured zero", () => {
  const ep = buildEpisode({ scenario: "s", actual: 0, predicted: 0 });
  assert.strictEqual(ep.predicted, 0, "a real zero survives");
  assert.strictEqual(ep.twinPredicted, null, "an uncaptured field is null, not 0");
});

test("an episode missing what the lab needs is rejected with the reason", () => {
  assert.match(episodeProblem(buildEpisode({ scenario: "s" })), /option index/);
  assert.match(episodeProblem({ at: 1, actual: 0 }), /scenario/);
  assert.strictEqual(episodeProblem(buildEpisode({ scenario: "s", actual: 0 })), null);
});

test("each response format is validated on its own terms", () => {
  // An allocation has no option index and must not be rejected for lacking
  // one; a choice without an index is genuinely broken.
  const alloc = buildEpisode({ scenario: "s", responseType: "allocation", response: { debt: 1 } });
  assert.strictEqual(episodeProblem(alloc), null);
  const emptyAlloc = buildEpisode({ scenario: "s", responseType: "allocation" });
  assert.match(episodeProblem(emptyAlloc), /allocation/);
});

test("non-choice formats are kept out of hit-rate metrics", () => {
  const alloc = buildEpisode({
    scenario: "s", responseType: "allocation", response: { debt: 1 },
    predicted: 0, twinPredicted: 1,
  });
  const s = episodeSupports(alloc);
  assert.strictEqual(s.twinAccuracy, false,
    "an allocation is scored by distance; a hit rate would compare unlike things");
  assert.strictEqual(s.magnitude, true);
});

test("decisions from before rooms existed are named as an experiment anyway", () => {
  assert.strictEqual(buildEpisode({ scenario: "s", actual: 0 }).experimentType, "twin_arena",
    "the analytics layer should never special-case pre-room decisions");
});

test("support flags say what an episode can answer, not what is truthy", () => {
  const noSelf = buildEpisode({ scenario: "s", actual: 0, twinPredicted: 1 });
  assert.strictEqual(episodeSupports(noSelf).selfAccuracy, false);
  assert.strictEqual(episodeSupports(noSelf).twinAccuracy, true);
  assert.strictEqual(episodeSupports(noSelf).twinAdvantage, false,
    "comparing the two forecasts needs both of them");
});

test("the held-out arm is only claimed when we actively did not ask", () => {
  const unasked = buildEpisode({ scenario: "s", actual: 0, twinPredicted: 1, selfAsked: false });
  const unknown = buildEpisode({ scenario: "s", actual: 0, twinPredicted: 1 });
  assert.strictEqual(episodeSupports(unasked).unprimed, true);
  assert.strictEqual(episodeSupports(unknown).unprimed, false,
    "not knowing whether we asked is not the same as knowing we did not");
});

// ------------------------------------------------------------- experiments

test("arm assignment is deterministic, so a re-render cannot move a decision", () => {
  const a = [0,1,2,3,4,5,6,7].map(n => assignCondition("twin_arena", n));
  const b = [0,1,2,3,4,5,6,7].map(n => assignCondition("twin_arena", n));
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.filter(x => x === "unprimed").length, 2, "1 in 4 held out");
});

test("a room cannot report a metric it never declared", () => {
  assert.strictEqual(experimentSupports("twin_arena", "twinAccuracy"), true);
  assert.strictEqual(experimentSupports("pressure_chamber", "selfAccuracy"), false,
    "acquiring an undeclared finding is a bug, not a bonus");
});

test("a room with no content is declared but withheld", () => {
  assert.ok(getExperiment("pressure_chamber"), "declared, so the contract is visible");
  assert.ok(!readyExperiments().some(x => x.id === "pressure_chamber"),
    "but not runnable: what is missing is authoring, not architecture");
  assert.match(EXPERIMENTS.pressure_chamber.blockedOn, /paired scenarios/);
});

test("comparing arms needs at least two arms with enough in them", () => {
  const ep = c => ({ condition: c, flavor: "growth" });
  assert.strictEqual(byCondition([ep("a"), ep("a"), ep("a")]), null,
    "one arm is not a comparison");
  assert.strictEqual(byCondition([ep("a"), ep("a"), ep("a"), ep("b")]), null,
    "a shift measured against a near-empty arm is not a shift");
  assert.ok(byCondition(Array(3).fill(0).map(() => ep("a"))
    .concat(Array(3).fill(0).map(() => ep("b")))));
});
