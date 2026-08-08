const test = require("node:test");
const assert = require("node:assert");
const { SHOP_ITEMS, SHOP_BUDGET, readBasket, basketToDecisions } = require("../shopping.js");

test("the basket cannot be fully afforded, or there is no trade-off", () => {
  const total = SHOP_ITEMS.reduce((s, i) => s + i.price, 0);
  assert.ok(total > SHOP_BUDGET, "items must exceed the budget for the exercise to mean anything");
});

test("every item carries the tags the MRI reads", () => {
  SHOP_ITEMS.forEach(i => {
    assert.ok(i.surface, `${i.id} needs a surface`);
    assert.ok(i.principle, `${i.id} needs a principle`);
    assert.strictEqual(typeof i.price, "number");
  });
});

test("skipped items are recorded too, so the log is not biased toward purchases", () => {
  const decisions = basketToDecisions(["groceries"], ["groceries"]);
  assert.strictEqual(decisions.length, SHOP_ITEMS.length);
  assert.strictEqual(decisions.filter(d => d.actual === 1).length, SHOP_ITEMS.length - 1);
});

test("prediction mismatches are detected in both directions", () => {
  // Bought unexpectedly, and expected but skipped.
  const decisions = basketToDecisions(["shoes"], ["buffer"]);
  const shoes = decisions.find(d => d.scenario.startsWith("Shoes"));
  const buffer = decisions.find(d => d.scenario.startsWith("Move it"));
  assert.strictEqual(shoes.matched, false);
  assert.strictEqual(buffer.matched, false);
  assert.strictEqual(shoes.actual, 0);
  assert.strictEqual(buffer.actual, 1);
});

test("the counterfactual records what the predicted choice would have cost", () => {
  const decisions = basketToDecisions([], ["shoes"]);
  const shoes = decisions.find(d => d.scenario.startsWith("Shoes"));
  const price = SHOP_ITEMS.find(i => i.id === "shoes").price;
  assert.strictEqual(shoes.netWorthDelta, 0, "not bought, so nothing spent");
  assert.strictEqual(shoes.predictedNetWorthDelta, -price, "predicted buying it, which would have cost");
});

test("time-limited items become timed decisions for the deadline rule", () => {
  const decisions = basketToDecisions(SHOP_ITEMS.map(i => i.id), []);
  const timed = decisions.filter(d => d.timed).length;
  assert.strictEqual(timed, SHOP_ITEMS.filter(i => i.pressure).length);
  assert.ok(timed > 0, "the exercise needs pressure items to test the deadline rule");
});

test("the basket read is descriptive and never scores", () => {
  const read = readBasket(["groceries", "buffer"]);
  assert.ok(Array.isArray(read.reads));
  assert.strictEqual(read.spend + read.remaining, SHOP_BUDGET);
  const joined = read.reads.join(" ").toLowerCase();
  ["score", "grade", "wrong", "should have"].forEach(w =>
    assert.ok(!joined.includes(w), `read should not contain "${w}"`));
});

test("an empty basket still reports honestly rather than erroring", () => {
  const read = readBasket([]);
  assert.strictEqual(read.spend, 0);
  assert.ok(read.reads.length > 0, "spending nothing is itself worth naming");
});
