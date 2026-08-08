// The shopping exercise: a second evidence source for the Financial MRI.
//
// The sandbox asks "what would you do?" about someone else's situation. This
// asks you to actually spend a fixed budget, which surfaces different things:
// what you drop when money runs short, whether a countdown moves you, and
// whether you revise a decision once you can see the whole basket.
//
// It writes into the SAME decision log the sandbox does, using the same
// surface and principle tags, so the MRI and the Twin read it without
// knowing or caring which exercise produced it. That is the point of tagging
// by behaviour rather than by exercise.

const SHOP_BUDGET = 400;

// Each item maps to a behavioural surface the twin's rules already key on.
// `pressure` marks the ones with a countdown or scarcity cue: those become
// `timed` decisions, which is what feeds the deadline rule.
const SHOP_ITEMS = [
  { id: "groceries", name: "Week's groceries", price: 120, need: "essential",
    surface: "obligation", principle: "id_notice",
    note: "You need this. The only question is what it crowds out." },
  { id: "phone_bill", name: "Phone bill, due today", price: 60, need: "essential",
    surface: "obligation", principle: "catch_up_later", pressure: true,
    note: "Late fee applies after midnight." },
  { id: "shoes", name: "Shoes you've wanted, 40% off", price: 90, need: "want",
    surface: "bnpl", principle: "credit_is_free", pressure: true,
    note: "Sale ends in two hours." },
  { id: "dinner", name: "Dinner with friends", price: 55, need: "social",
    surface: "family_loan", principle: "others_first",
    note: "You said you'd come. Nobody would mind if you didn't." },
  { id: "course", name: "Online course you'd finish", price: 110, need: "growth",
    surface: "opportunity", principle: "catch_up_later",
    note: "Pays back slowly, if at all, and only if you actually finish it." },
  { id: "buffer", name: "Move it to savings", price: 100, need: "buffer",
    surface: "windfall", principle: "more_saved_is_better",
    note: "Does nothing for you today." },
  { id: "gift", name: "Birthday gift for a friend", price: 45, need: "social",
    surface: "family_loan", principle: "others_first",
    note: "Their birthday is Saturday." },
  { id: "subscription", name: "Annual subscription, renews tomorrow", price: 70, need: "want",
    surface: "subscription", principle: "id_notice", pressure: true,
    note: "You used it twice last year." },
];

// What the basket says. Deliberately descriptive rather than graded: there is
// no correct basket, and scoring one would turn an observation into a test.
function readBasket(selected) {
  const items = SHOP_ITEMS.filter(i => selected.includes(i.id));
  const spend = items.reduce((s, i) => s + i.price, 0);
  const by = need => items.filter(i => i.need === need).length;
  const pressured = items.filter(i => i.pressure).length;
  const totalPressured = SHOP_ITEMS.filter(i => i.pressure).length;

  const reads = [];
  if (by("essential") < SHOP_ITEMS.filter(i => i.need === "essential").length) {
    reads.push("You left an essential unpaid to make room for something else. Worth knowing what won.");
  }
  if (by("buffer")) {
    reads.push("You moved money to savings while other things went unbought. Not everyone does that with a fixed budget.");
  }
  if (pressured >= totalPressured && totalPressured > 0) {
    reads.push("You bought every item that carried a countdown or a deadline.");
  } else if (pressured === 0 && totalPressured > 0) {
    reads.push("You bought nothing that had a countdown on it.");
  }
  if (by("social") >= 2) {
    reads.push("Two of your purchases were for other people rather than for you.");
  }
  if (by("growth")) {
    reads.push("You spent on something whose payoff is slow and uncertain.");
  }
  if (spend < SHOP_BUDGET * 0.6) {
    reads.push(`You left ${SHOP_BUDGET - spend} of ${SHOP_BUDGET} unspent. Holding back is itself a decision.`);
  }
  return { items, spend, remaining: SHOP_BUDGET - spend, reads };
}

// Converts the basket into decision records the MRI already understands.
// Every item is a decision: buying is one choice, skipping is the other, and
// both are recorded so the log is not silently biased toward purchases.
function basketToDecisions(selected, predicted) {
  const now = Date.now();
  return SHOP_ITEMS.map((item, idx) => {
    const bought = selected.includes(item.id);
    const predictedBought = predicted.includes(item.id);
    return {
      at: now + idx,
      scenario: `${item.name} ($${item.price})`,
      choice: bought ? `Bought ${item.name}` : `Skipped ${item.name}`,
      // Index 0 is buy, 1 is skip, so predicted-versus-actual lines up with
      // how the sandbox records choice indices.
      predicted: predictedBought ? 0 : 1,
      actual: bought ? 0 : 1,
      matched: bought === predictedBought,
      timed: item.pressure === true,
      surface: item.surface,
      principle: item.principle,
      netWorthDelta: bought ? -item.price : 0,
      // The counterfactual: what the predicted choice would have cost.
      predictedNetWorthDelta: predictedBought ? -item.price : 0,
    };
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { SHOP_ITEMS, SHOP_BUDGET, readBasket, basketToDecisions };
}
