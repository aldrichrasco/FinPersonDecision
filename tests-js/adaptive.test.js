const test = require("node:test");
const assert = require("node:assert");
const {
  adaptiveTarget, adaptiveFilter, scenarioAxis, ADAPTIVE_MIN_DECISIONS,
} = require("../adaptive.js");

// The module reads these from the page's global scope in the browser.
global.SURFACE_AXIS = {
  credit_card: "impulse_regulation", bnpl: "impulse_regulation",
  subscription: "financial_attentiveness", family_loan: "prosocial_orientation",
  opportunity: "risk_disposition", windfall: "temporal_orientation",
  obligation: "temporal_orientation", shortfall: "financial_self_efficacy",
};
global.AXIS_KEYS = [
  "impulse_regulation", "risk_disposition", "temporal_orientation",
  "financial_attentiveness", "financial_self_efficacy", "prosocial_orientation",
];
global.mriAxisName = k => k;

const many = (surface, n) => Array(n).fill(0).map(() => ({ surface }));

test("no targeting before there is enough evidence to be uneven about", () => {
  assert.strictEqual(adaptiveTarget(many("bnpl", ADAPTIVE_MIN_DECISIONS - 1), null, null), null,
    "steering early would shape the profile rather than measure it");
});

test("no targeting when evidence is already spread evenly", () => {
  const even = ["bnpl", "opportunity", "windfall", "subscription", "family_loan", "shortfall"]
    .flatMap(s => many(s, 2));
  assert.strictEqual(adaptiveTarget(even, null, null), null);
});

test("targets the axis with the thinnest evidence", () => {
  const lopsided = many("bnpl", 9);
  const t = adaptiveTarget(lopsided, null, null);
  assert.ok(t, "a clearly uneven log should produce a target");
  assert.strictEqual(t.kind, "thin");
  assert.notStrictEqual(t.axis, "impulse_regulation", "should not target the axis already saturated");
});

test("a contested rule outranks a thin axis", () => {
  const twin = { contested: [{ axis: "prosocial_orientation", id: "gives_when_asked" }], proposed: [] };
  const t = adaptiveTarget(many("bnpl", 9), twin, null);
  assert.strictEqual(t.kind, "contested");
  assert.strictEqual(t.axis, "prosocial_orientation",
    "a belief the evidence is arguing with is the most valuable thing to resolve");
});

test("a near-confirmed hunch is targeted once nothing more urgent exists", () => {
  const even = ["bnpl", "opportunity", "windfall", "subscription", "family_loan", "shortfall"]
    .flatMap(s => many(s, 2));
  const twin = { contested: [], proposed: [{ axis: "risk_disposition", id: "spends_to_grow", total: 2 }] };
  const t = adaptiveTarget(even, twin, null);
  assert.strictEqual(t.kind, "proposed");
});

test("every target carries a reason the interface can show", () => {
  const t = adaptiveTarget(many("bnpl", 9), null, null);
  assert.ok(t.reason && t.reason.length > 20,
    "targeting without an explanation reads as manipulation");
});

test("filtering never empties the pool or forces a repeat", () => {
  const pool = [{ surface: "bnpl" }, { surface: "windfall" }];
  const noMatch = adaptiveFilter(pool, { axis: "prosocial_orientation" });
  assert.strictEqual(noMatch.targeted, false);
  assert.strictEqual(noMatch.pool.length, 2, "an unmatched target must leave the pool intact");
});

test("filtering narrows to the target axis when matches exist", () => {
  const pool = [{ surface: "bnpl" }, { surface: "windfall" }, { surface: "obligation" }];
  const narrowed = adaptiveFilter(pool, { axis: "temporal_orientation" });
  assert.strictEqual(narrowed.targeted, true);
  assert.strictEqual(narrowed.pool.length, 2);
});

test("scenarioAxis resolves through the shared surface map", () => {
  assert.strictEqual(scenarioAxis({ surface: "family_loan" }), "prosocial_orientation");
  assert.strictEqual(scenarioAxis({ surface: "nonexistent" }), null);
  assert.strictEqual(scenarioAxis(null), null);
});
