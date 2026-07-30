const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mulberry32, generatePriceSeries, donchianSignal, actionReturnPct, resolveRound, runSimulation,
} = require('../turtle-sim.js');

test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('generatePriceSeries with a seeded rng is reproducible', () => {
  const a = generatePriceSeries(30, { rng: mulberry32(7) });
  const b = generatePriceSeries(30, { rng: mulberry32(7) });
  assert.deepEqual(a, b);
  assert.equal(a.length, 30);
  assert.equal(a[0], 100);
});

test('generatePriceSeries prices never go non-positive', () => {
  const prices = generatePriceSeries(200, { rng: mulberry32(1), volatility: 0.5 });
  assert.ok(prices.every(p => p > 0));
});

test('donchianSignal: breakout above the prior window is "buy"', () => {
  const prices = [10, 11, 9, 10, 12, 20]; // window [10,11,9,10,12] max=12, current=20 > 12
  assert.equal(donchianSignal(prices, 5, 5), 'buy');
});

test('donchianSignal: breakout below the prior window is "sell"', () => {
  const prices = [10, 11, 9, 10, 12, 1]; // window min=9, current=1 < 9
  assert.equal(donchianSignal(prices, 5, 5), 'sell');
});

test('donchianSignal: inside the prior range is "hold"', () => {
  const prices = [10, 11, 9, 10, 12, 10.5]; // 9 < 10.5 < 12
  assert.equal(donchianSignal(prices, 5, 5), 'hold');
});

test('donchianSignal: not enough history yet is "hold"', () => {
  const prices = [10, 11, 9];
  assert.equal(donchianSignal(prices, 2, 5), 'hold');
});

test('actionReturnPct: "buy" profits when price rises', () => {
  const prices = [100, 110];
  assert.ok(actionReturnPct(prices, 0, 'buy') > 0);
  assert.equal(actionReturnPct(prices, 0, 'buy'), 0.1);
});

test('actionReturnPct: "sell" profits when price falls', () => {
  const prices = [100, 90];
  assert.equal(actionReturnPct(prices, 0, 'sell'), 0.1);
});

test('actionReturnPct: "hold" is always flat', () => {
  const prices = [100, 150];
  assert.equal(actionReturnPct(prices, 0, 'hold'), 0);
});

test('resolveRound: flags override correctly when player action differs from signal', () => {
  const prices = [10, 11, 9, 10, 12, 20]; // signal is 'buy'
  const followed = resolveRound(prices, 5, 5, 'buy');
  const overridden = resolveRound(prices, 5, 5, 'sell');
  assert.equal(followed.overridden, false);
  assert.equal(overridden.overridden, true);
  assert.equal(overridden.signal, 'buy');
});

test('runSimulation: always following the signal makes rule and player equity identical', () => {
  const prices = generatePriceSeries(40, { rng: mulberry32(3) });
  const period = 10;
  const actions = [];
  for (let i = 0; i < 20; i++) actions.push(donchianSignal(prices, period + i, period));
  const result = runSimulation(prices, period, actions);
  assert.equal(result.overrideCount, 0);
  assert.ok(Math.abs(result.finalRuleEquity - result.finalPlayerEquity) < 1e-9);
});

test('runSimulation: equity curves start at 1 and have one entry per round plus the start', () => {
  const prices = generatePriceSeries(30, { rng: mulberry32(9) });
  const period = 10;
  const actions = new Array(15).fill('hold');
  const result = runSimulation(prices, period, actions);
  assert.equal(result.ruleEquityCurve[0], 1);
  assert.equal(result.playerEquityCurve[0], 1);
  assert.equal(result.ruleEquityCurve.length, result.rounds.length + 1);
});

test('runSimulation: all-hold player never overrides a hold signal, but does override buy/sell signals', () => {
  const prices = generatePriceSeries(30, { rng: mulberry32(11) });
  const period = 10;
  const actions = new Array(15).fill('hold');
  const result = runSimulation(prices, period, actions);
  const nonHoldSignals = result.rounds.filter(r => r.signal !== 'hold').length;
  assert.equal(result.overrideCount, nonHoldSignals);
});
