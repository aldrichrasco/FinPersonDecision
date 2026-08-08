const test = require("node:test");
const assert = require("node:assert");
const { evidenceStrength, traitBand, TRAIT_BASE, EVIDENCE_BANDS } = require("../fingerprint.js");

test("evidence bands never overstate a thin sample", () => {
  assert.strictEqual(evidenceStrength(0).id, "limited");
  assert.strictEqual(evidenceStrength(2).id, "limited");
  assert.strictEqual(evidenceStrength(3).id, "emerging");
  assert.strictEqual(evidenceStrength(6).id, "strong");
});

test("evidence bands are ordered strongest first so lookup is correct", () => {
  for (let i = 1; i < EVIDENCE_BANDS.length; i++) {
    assert.ok(EVIDENCE_BANDS[i - 1].min > EVIDENCE_BANDS[i].min);
  }
});

test("trait bands split high, mid and low without gaps", () => {
  assert.strictEqual(traitBand(80), "high");
  assert.strictEqual(traitBand(66), "high");
  assert.strictEqual(traitBand(50), "mid");
  assert.strictEqual(traitBand(41), "mid");
  assert.strictEqual(traitBand(40), "low");
});

test("every axis carries all three legs of strength, risk and use", () => {
  Object.entries(TRAIT_BASE).forEach(([axis, t]) => {
    ["high", "mid", "low", "strength", "risk", "use"].forEach(k => {
      assert.ok(t[k] && t[k].length > 0, `${axis} is missing ${k}`);
    });
    // "Use it" is the leg that makes the framing actionable rather than a
    // compliment, so it must actually say where to point the tendency.
    assert.ok(t.use.length > 30, `${axis} use copy is too thin to act on`);
  });
});

test("no trait copy passes judgement on the person", () => {
  // Targets judgement aimed at the reader, not any negative word. "A poor
  // situation" describes circumstances and is fine; "you are poor at this"
  // would not be. The earlier version of this test banned the substring and
  // flagged the former, which was the test being wrong rather than the copy.
  const all = Object.values(TRAIT_BASE)
    .map(t => [t.high, t.mid, t.low, t.strength, t.risk, t.use].join(" "))
    .join(" ").toLowerCase();
  ["weakness", "you are bad", "poor at", "you should", "you must", "failure"].forEach(w =>
    assert.ok(!all.includes(w), `trait copy should not contain "${w}"`));
});
