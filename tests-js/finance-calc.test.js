const test = require('node:test');
const assert = require('node:assert/strict');
const {
  futureValue, ruleOf72, feeDragComparison, solveTimeToGoal, solveRequiredContribution,
  latteFactor, simulateDebtPayoff, debtPayoffComparison, emergencyFundTarget, minimumPaymentTrap,
  rolloverLoanTrap, deferredInterestTrap, bnplStackingLoad,
} = require('../finance-calc.js');

test('futureValue: zero rate and zero contribution never grows', () => {
  const result = futureValue(1000, 0, 0, 10);
  assert.equal(result.finalValue, 1000);
  assert.equal(result.totalGrowth, 0);
});

test('futureValue: zero rate with contributions is pure addition', () => {
  const result = futureValue(1000, 100, 0, 2); // 24 months * 100 = 2400
  assert.equal(result.finalValue, 1000 + 100 * 24);
  assert.equal(result.totalContributed, 1000 + 100 * 24);
});

test('futureValue: matches the closed-form lump-sum formula with no contributions', () => {
  const result = futureValue(1000, 0, 12, 1); // 1% monthly for 12 months
  const expected = 1000 * Math.pow(1.01, 12);
  assert.ok(Math.abs(result.finalValue - expected) < 1e-6);
});

test('futureValue: series has one entry per year plus year 0, and ends at finalValue', () => {
  const result = futureValue(500, 50, 7, 5);
  assert.equal(result.series.length, 6);
  assert.equal(result.series[0].year, 0);
  assert.equal(result.series[0].value, 500);
  assert.ok(Math.abs(result.series[5].value - result.finalValue) < 1e-9);
});

test('futureValue: a higher rate always ends with a higher value, same inputs otherwise', () => {
  const low = futureValue(1000, 100, 3, 20);
  const high = futureValue(1000, 100, 10, 20);
  assert.ok(high.finalValue > low.finalValue);
});

test('ruleOf72: the approximation and the exact answer are close but not identical at 7%', () => {
  const { approxYears, exactYears } = ruleOf72(7);
  assert.ok(Math.abs(approxYears - 10.2857) < 1e-3);
  assert.ok(exactYears > 9 && exactYears < 10.5);
  assert.notEqual(approxYears, exactYears);
});

test('ruleOf72: exact doubling time actually doubles the principal', () => {
  const { exactYears } = ruleOf72(7);
  const result = futureValue(1000, 0, 7, exactYears);
  assert.ok(Math.abs(result.finalValue - 2000) < 1);
});

test('feeDragComparison: the lower-fee fund always ends ahead', () => {
  const { a, b, difference } = feeDragComparison(10000, 200, 7, 30, 0.05, 1.0);
  assert.ok(a.finalValue > b.finalValue);
  assert.ok(difference > 0);
});

test('feeDragComparison: identical fees produce identical results', () => {
  const { a, b, difference } = feeDragComparison(10000, 200, 7, 30, 0.5, 0.5);
  assert.equal(difference, 0);
  assert.equal(a.finalValue, b.finalValue);
});

test('solveTimeToGoal: already-met goal takes zero time', () => {
  assert.equal(solveTimeToGoal(5000, 100, 7, 1000), 0);
});

test('solveTimeToGoal: unreachable goal (no growth, no contribution) is Infinity', () => {
  assert.equal(solveTimeToGoal(1000, 0, 0, 5000), Infinity);
});

test('solveTimeToGoal: round-trips through futureValue for a reachable goal', () => {
  const years = solveTimeToGoal(1000, 100, 7, 50000);
  const check = futureValue(1000, 100, 7, years);
  assert.ok(Math.abs(check.finalValue - 50000) < 1);
});

test('solveTimeToGoal: zero-rate case matches simple division', () => {
  const years = solveTimeToGoal(0, 100, 0, 12000);
  assert.ok(Math.abs(years - 10) < 1e-9); // 12000 / 100 = 120 months = 10 years
});

test('solveRequiredContribution: round-trips through futureValue for a reachable goal', () => {
  const contribution = solveRequiredContribution(1000, 7, 10, 50000);
  const check = futureValue(1000, contribution, 7, 10);
  assert.ok(Math.abs(check.finalValue - 50000) < 1);
});

test('solveRequiredContribution: principal alone already meeting the goal needs a non-positive contribution', () => {
  const contribution = solveRequiredContribution(100000, 7, 10, 50000);
  assert.ok(contribution <= 0);
});

test('solveRequiredContribution: zero-rate case matches simple division', () => {
  const contribution = solveRequiredContribution(0, 0, 10, 12000);
  assert.ok(Math.abs(contribution - 100) < 1e-9); // 12000 / 120 months = 100
});

test('latteFactor: converts a per-week habit to a monthly amount via a 52-week year', () => {
  const result = latteFactor(5, 5, 7, 1); // $5, 5x/week
  const expectedMonthly = (5 * 5 * 52) / 12;
  assert.ok(Math.abs(result.monthlyAmount - expectedMonthly) < 1e-9);
});

test('latteFactor: investing beats the raw amount spent, given a positive rate', () => {
  const result = latteFactor(5, 5, 7, 20);
  assert.ok(result.invested.finalValue > result.totalSpent);
});

test('latteFactor: at 0% rate, investing equals just saving the cash', () => {
  const result = latteFactor(4, 3, 0, 5);
  assert.ok(Math.abs(result.invested.finalValue - result.totalSpent) < 1e-6);
});

test('simulateDebtPayoff: a single debt clears in the same time regardless of strategy label', () => {
  const debts = [{ name: "Card", balance: 1000, aprPct: 20, minPayment: 25 }];
  const avalanche = simulateDebtPayoff(debts, 50, "avalanche");
  const snowball = simulateDebtPayoff(debts, 50, "snowball");
  assert.equal(avalanche.months, snowball.months);
  assert.ok(avalanche.cleared);
});

test('simulateDebtPayoff: extra payment always pays off faster than minimums alone', () => {
  const debts = [{ name: "Card", balance: 3000, aprPct: 22, minPayment: 60 }];
  const withExtra = simulateDebtPayoff(debts, 100, "avalanche");
  const noExtra = simulateDebtPayoff(debts, 0, "avalanche");
  assert.ok(withExtra.months < noExtra.months);
});

test('simulateDebtPayoff: payments too small to cover interest never clear the debt', () => {
  const debts = [{ name: "Card", balance: 5000, aprPct: 29, minPayment: 5 }];
  const result = simulateDebtPayoff(debts, 0, "avalanche");
  assert.equal(result.cleared, false);
});

test('debtPayoffComparison: avalanche never pays more total interest than snowball', () => {
  const debts = [
    { name: "Store card", balance: 800, aprPct: 26, minPayment: 30 },
    { name: "Credit card", balance: 4000, aprPct: 19, minPayment: 90 },
    { name: "Personal loan", balance: 6000, aprPct: 9, minPayment: 150 },
  ];
  const { avalanche, snowball, interestSaved } = debtPayoffComparison(debts, 200);
  assert.ok(interestSaved >= -1e-6); // avalanche.totalInterest <= snowball.totalInterest
  assert.ok(avalanche.totalInterest <= snowball.totalInterest + 1e-6);
});

test('debtPayoffComparison: snowball clears the smallest balance first', () => {
  const debts = [
    { name: "Small", balance: 500, aprPct: 10, minPayment: 25 },
    { name: "Big", balance: 8000, aprPct: 25, minPayment: 150 },
  ];
  const { snowball, avalanche } = debtPayoffComparison(debts, 200);
  assert.equal(snowball.payoffOrder[0], "Small");
  assert.equal(avalanche.payoffOrder[0], "Big"); // avalanche orders by APR, Big has the higher rate
});

test('emergencyFundTarget: coverage and remaining are consistent with the target', () => {
  const result = emergencyFundTarget(2000, 6, 4000, 500);
  assert.equal(result.targetAmount, 12000);
  assert.equal(result.currentCoverageMonths, 2);
  assert.equal(result.remaining, 8000);
  assert.ok(Math.abs(result.monthsToTarget - 16) < 1e-9);
});

test('emergencyFundTarget: already-met target needs zero more months', () => {
  const result = emergencyFundTarget(1000, 3, 5000, 100);
  assert.equal(result.remaining, 0);
  assert.equal(result.monthsToTarget, 0);
});

test('emergencyFundTarget: zero contribution with a remaining gap is unreachable', () => {
  const result = emergencyFundTarget(1000, 3, 0, 0);
  assert.equal(result.monthsToTarget, Infinity);
});

test('minimumPaymentTrap: a higher fixed payment always clears faster and cheaper than minimums alone', () => {
  const result = minimumPaymentTrap(5000, 22, 2, 25, 200);
  assert.ok(result.fixed.months < result.minimumOnly.months);
  assert.ok(result.fixed.totalInterest < result.minimumOnly.totalInterest);
  assert.ok(result.monthsSaved > 0);
  assert.ok(result.interestSaved > 0);
});

test('minimumPaymentTrap: minimum-only path clears eventually for a typical card (percent-of-balance payments shrink but stay above interest)', () => {
  const result = minimumPaymentTrap(3000, 19.99, 2, 25, 150);
  assert.ok(result.minimumOnly.cleared);
  assert.ok(result.minimumOnly.months > result.fixed.months);
});

test('rolloverLoanTrap: the fee repeats every rollover while principal is never reduced', () => {
  const result = rolloverLoanTrap(300, 15, 14, 4); // $300 payday loan, 15% fee, 14-day term, rolled over 4x
  assert.equal(result.feePerPeriod, 45);
  assert.equal(result.totalFeesPaid, 180);
  assert.equal(result.totalPaid, 480); // fees paid, but the $300 principal is STILL owed
});

test('rolloverLoanTrap: implied APR is very high for a short period even at a modest-looking fee', () => {
  const result = rolloverLoanTrap(300, 15, 14, 0);
  assert.ok(result.impliedApr > 300); // 15% per 14 days annualizes far past what "15%" sounds like
});

test('rolloverLoanTrap: zero rollovers means zero fees paid so far, but principal is unchanged', () => {
  const result = rolloverLoanTrap(500, 25, 30, 0);
  assert.equal(result.totalFeesPaid, 0);
  assert.equal(result.series.length, 1);
  assert.equal(result.series[0].cumulativeFees, 0);
});

test('deferredInterestTrap: paying in full before the deadline means zero retroactive interest', () => {
  const result = deferredInterestTrap(1200, 12, 29.99, 100); // 12 * 100 = 1200, exactly clears it
  assert.equal(result.paidOffInTime, true);
  assert.equal(result.retroactiveInterest, 0);
  assert.equal(result.totalCost, 1200);
});

test('deferredInterestTrap: missing the deadline by even a little charges interest on the WHOLE original amount, not just what remains', () => {
  const result = deferredInterestTrap(1200, 12, 29.99, 99); // $12 short of paid off
  assert.equal(result.paidOffInTime, false);
  assert.ok(result.remainingBalance < 15); // only a small amount is actually left...
  // ...but the retroactive charge is based on the full $1200 over all 12 months, not the ~$12 remaining
  const expectedRetroactive = 1200 * (29.99 / 100 / 12) * 12;
  assert.ok(Math.abs(result.retroactiveInterest - expectedRetroactive) < 0.01);
  assert.ok(result.retroactiveInterest > 300); // a real, large gotcha relative to the ~$12 shortfall
});

test('bnplStackingLoad: combines per-period obligation across active plans', () => {
  const plans = [
    { amount: 100, installmentsTotal: 4, installmentsRemaining: 3, lateFeePerMissed: 7 },
    { amount: 200, installmentsTotal: 4, installmentsRemaining: 2, lateFeePerMissed: 10 },
  ];
  const result = bnplStackingLoad(plans);
  assert.equal(result.activeCount, 2);
  assert.equal(result.perPeriodObligation, 25 + 50); // 100/4 + 200/4
  assert.equal(result.maxLateFeeExposure, 17);
});

test('bnplStackingLoad: fully-paid plans do not count toward the active load', () => {
  const plans = [
    { amount: 100, installmentsTotal: 4, installmentsRemaining: 0, lateFeePerMissed: 7 },
    { amount: 200, installmentsTotal: 4, installmentsRemaining: 2, lateFeePerMissed: 10 },
  ];
  const result = bnplStackingLoad(plans);
  assert.equal(result.activeCount, 1);
  assert.equal(result.perPeriodObligation, 50);
});
