// Turtle Trading simulation — pure functions only (no DOM, no canvas). The
// rule is a real one: a Donchian channel breakout, the actual system Curtis
// Faith describes the original Turtles trading in "Way of the Turtle" — buy
// when price breaks above its N-period high, sell/short when it breaks
// below its N-period low, otherwise hold. Everything here is synthetic
// price data, not live market feeds — same "illustrative, not real
// research-backed data" convention as classroom.html's simulated opponents.
//
// The whole point of the exercise: track what happens if you always follow
// the signal (ruleEquity) next to what actually happens when a player is
// free to override it on gut instinct (playerEquity) — the cost of
// overriding, made visible round by round instead of asserted.

// Simple seeded PRNG (mulberry32) so a price series is reproducible from a
// seed for testing, without pulling in a dependency for one function.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random walk with occasional regime shifts in drift, so breakouts actually
// happen (a pure random walk with zero drift rarely trends long enough for
// a Donchian signal to fire meaningfully). `rng` defaults to Math.random;
// pass mulberry32(seed) for deterministic output in tests.
function generatePriceSeries(numPoints, opts) {
  const o = opts || {};
  const rng = o.rng || Math.random;
  const startPrice = o.startPrice ?? 100;
  const volatility = o.volatility ?? 0.012;
  const regimeLength = o.regimeLength ?? 8;

  const prices = [startPrice];
  let drift = 0;
  for (let i = 1; i < numPoints; i++) {
    if ((i - 1) % regimeLength === 0) {
      // New regime: trend up, trend down, or flat, roughly equally likely.
      const r = rng();
      drift = r < 0.4 ? volatility * 0.6 : r < 0.8 ? -volatility * 0.6 : 0;
    }
    const shock = (rng() - 0.5) * 2 * volatility;
    const changePct = drift + shock;
    prices.push(Math.max(0.01, prices[i - 1] * (1 + changePct)));
  }
  return prices;
}

// Donchian breakout signal for the point at `index`, looking back over the
// `period` prices strictly before it (index itself is the "current" price
// being compared against the prior channel, not included in the channel).
function donchianSignal(prices, index, period) {
  if (index < period) return "hold";
  const window = prices.slice(index - period, index);
  const high = Math.max(...window);
  const low = Math.min(...window);
  const current = prices[index];
  if (current > high) return "buy";
  if (current < low) return "sell";
  return "hold";
}

// Return of one round's action, realized over the move from prices[index]
// to prices[index + 1]. "buy" profits if price rises, "sell" (short)
// profits if price falls, "hold" is flat (0 return, no position risked).
function actionReturnPct(prices, index, action) {
  if (action === "hold" || index + 1 >= prices.length) return 0;
  const changePct = (prices[index + 1] - prices[index]) / prices[index];
  return action === "buy" ? changePct : action === "sell" ? -changePct : 0;
}

// One resolved round: computes the rule's signal, the return the rule
// itself would have earned, and the return the player's chosen action
// (which may equal the signal, or override it) actually earned.
function resolveRound(prices, index, period, playerAction) {
  const signal = donchianSignal(prices, index, period);
  const ruleReturnPct = actionReturnPct(prices, index, signal);
  const playerReturnPct = actionReturnPct(prices, index, playerAction);
  return {
    index, signal, playerAction,
    overridden: playerAction !== signal,
    ruleReturnPct, playerReturnPct,
  };
}

// Runs a full simulation: prices from index `period` to `period + rounds`,
// applying `playerActions[i]` (one of "buy"/"sell"/"hold", already resolved
// — "follow the rule" should be pre-resolved to that round's signal by the
// caller before calling this) at each round, compounding two equity curves
// starting at 1.0. Returns the per-round detail plus both curves.
function runSimulation(prices, period, playerActions) {
  const rounds = [];
  const ruleEquityCurve = [1];
  const playerEquityCurve = [1];
  let ruleEquity = 1;
  let playerEquity = 1;
  let overrideCount = 0;

  for (let i = 0; i < playerActions.length; i++) {
    const index = period + i;
    if (index >= prices.length - 1) break;
    const round = resolveRound(prices, index, period, playerActions[i]);
    ruleEquity *= 1 + round.ruleReturnPct;
    playerEquity *= 1 + round.playerReturnPct;
    ruleEquityCurve.push(ruleEquity);
    playerEquityCurve.push(playerEquity);
    if (round.overridden) overrideCount += 1;
    rounds.push(round);
  }

  return {
    rounds,
    ruleEquityCurve,
    playerEquityCurve,
    finalRuleEquity: ruleEquity,
    finalPlayerEquity: playerEquity,
    overrideCount,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    mulberry32, generatePriceSeries, donchianSignal, actionReturnPct, resolveRound, runSimulation,
  };
}
