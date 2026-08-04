// Standard compound-interest / annuity math for the Calculators page
// (calculators.html, calculators-page.js). Pure functions, no DOM — same
// split as turtle-sim.js / pro-turtle-page.js, so this file is directly
// unit-testable with Node's test runner (tests-js/finance-calc.test.js)
// without a browser.
//
// Everything here is the textbook formula, not a house invention:
//   FV = P(1+i)^n + C * (((1+i)^n - 1) / i)     [future value of a lump
//                                                 sum P plus an ordinary
//                                                 monthly annuity C]
// with i = monthly rate, n = number of months. Solving that same
// equation for n (time to reach a goal) or C (required contribution) is
// what solveTimeToGoal / solveRequiredContribution do, algebraically —
// not simulated or approximated.

// Evaluated directly from the closed-form formula at whatever number of
// months is asked for (need not be a whole number) — used for every
// point below, including the final value, so a fractional-year answer
// from solveTimeToGoal/solveRequiredContribution round-trips exactly
// instead of drifting against a separately-stepped loop.
function _valueAtMonths(principal, monthlyContribution, monthlyRate, months) {
  if (monthlyRate === 0) return principal + monthlyContribution * months;
  const growth = Math.pow(1 + monthlyRate, months);
  return principal * growth + (monthlyContribution * (growth - 1)) / monthlyRate;
}

function futureValue(principal, monthlyContribution, annualRatePct, years) {
  const i = annualRatePct / 100 / 12;
  const totalMonths = years * 12;
  const wholeYears = Math.floor(years + 1e-9);
  const series = [];
  for (let y = 0; y <= wholeYears; y++) {
    series.push({ year: y, value: _valueAtMonths(principal, monthlyContribution, i, y * 12) });
  }
  const finalValue = _valueAtMonths(principal, monthlyContribution, i, totalMonths);
  if (Math.abs(totalMonths - wholeYears * 12) > 1e-9) {
    series.push({ year: years, value: finalValue }); // a fractional final year (e.g. a solved goal date)
  }
  const totalContributed = principal + monthlyContribution * totalMonths;
  return {
    finalValue,
    totalContributed,
    totalGrowth: finalValue - totalContributed,
    series,
  };
}

// The "rule of thumb" itself (72 / rate, in percent) next to the real
// doubling time under the SAME monthly-compounding convention futureValue
// uses everywhere else on this page — solving (1+i)^(12t) = 2 for t,
// where i is the monthly rate, not the simpler annual-compounding
// ln(2)/ln(1+r). The point of this calculator is showing how good (or
// not) the approximation is against a self-consistent exact answer, not
// producing a number under a different, uncommunicated assumption.
function ruleOf72(annualRatePct) {
  const i = annualRatePct / 100 / 12;
  return {
    approxYears: 72 / annualRatePct,
    exactYears: i > 0 ? Math.log(2) / (12 * Math.log(1 + i)) : Infinity,
  };
}

// Runs futureValue twice at (grossRatePct - feeAPct) and (grossRatePct -
// feeBPct) — the standard simplification of treating an expense ratio as
// a straight drag on annual return. Real funds compound fees daily/
// monthly against NAV, not annually against the gross return, so this is
// an approximation of the size of the effect, not a precise fee model.
function feeDragComparison(principal, monthlyContribution, grossRatePct, years, feeAPct, feeBPct) {
  const a = futureValue(principal, monthlyContribution, grossRatePct - feeAPct, years);
  const b = futureValue(principal, monthlyContribution, grossRatePct - feeBPct, years);
  return { a, b, difference: a.finalValue - b.finalValue };
}

// Solves FV = P(1+i)^n + C*((1+i)^n - 1)/i for n (in years), given a
// target goal. Returns Infinity if the goal is mathematically
// unreachable (no contribution and a non-positive rate, starting below
// the goal).
function solveTimeToGoal(principal, monthlyContribution, annualRatePct, goal) {
  if (principal >= goal) return 0;
  const i = annualRatePct / 100 / 12;
  if (i === 0) {
    if (monthlyContribution <= 0) return Infinity;
    return (goal - principal) / monthlyContribution / 12;
  }
  const denominator = principal * i + monthlyContribution;
  if (denominator <= 0) return Infinity;
  const x = (goal * i + monthlyContribution) / denominator;
  if (x <= 0) return Infinity;
  const months = Math.log(x) / Math.log(1 + i);
  return Math.max(0, months / 12);
}

// Solves the same equation for the required monthly contribution C,
// given a fixed number of years. Can come back negative or zero when the
// principal alone already clears the goal — callers should treat
// non-positive results as "no further contribution needed."
function solveRequiredContribution(principal, annualRatePct, years, goal) {
  const i = annualRatePct / 100 / 12;
  const n = Math.round(years * 12);
  if (n <= 0) return goal - principal;
  if (i === 0) return (goal - principal) / n;
  const x = Math.pow(1 + i, n);
  return ((goal - principal * x) * i) / (x - 1);
}

// What a small recurring spend costs vs. what it would be worth invested
// instead — the classic "latte factor" framing. Just futureValue() with
// the recurring amount converted to a monthly contribution (via a
// 52-week year, not a flat *4 weeks/month, so a "3x/week" habit is
// converted accurately rather than undercounted).
function latteFactor(perOccurrenceAmount, occurrencesPerWeek, annualRatePct, years) {
  const monthlyAmount = (perOccurrenceAmount * occurrencesPerWeek * 52) / 12;
  const invested = futureValue(0, monthlyAmount, annualRatePct, years);
  return {
    monthlyAmount,
    totalSpent: monthlyAmount * 12 * years,
    invested,
  };
}

const _DEBT_SIM_MAX_MONTHS = 600; // 50 years — a simulation cap, not a claim anything should take this long

// Simulates paying off a list of debts [{name, balance, aprPct,
// minPayment}] month by month: interest accrues on every balance, then
// minimums are paid, then any leftover monthly budget (plus the minimum
// payments freed up by already-paid-off debts, rolled forward — the real
// "snowball" mechanic) goes toward the single highest-priority remaining
// debt. "avalanche" orders by highest APR first (minimizes total
// interest, provably); "snowball" orders by smallest balance first
// (clears individual debts faster, which behavioral research on
// adherence — Gal & McShane 2012 — found people are actually more likely
// to stick with, even though it isn't the mathematically optimal order).
function simulateDebtPayoff(debts, extraMonthlyBudget, strategy) {
  const order = debts
    .map(d => ({ ...d }))
    .sort((a, b) => (strategy === "avalanche" ? b.aprPct - a.aprPct : a.balance - b.balance));

  let months = 0;
  let totalInterest = 0;
  while (order.some(d => d.balance > 0.005) && months < _DEBT_SIM_MAX_MONTHS) {
    months++;
    order.forEach(d => {
      if (d.balance <= 0) return;
      const interest = d.balance * (d.aprPct / 100 / 12);
      totalInterest += interest;
      d.balance += interest;
    });
    let freedUp = 0;
    order.forEach(d => {
      if (d.balance <= 0) return;
      const pay = Math.min(d.minPayment, d.balance);
      d.balance -= pay;
      if (d.balance <= 0.005) { d.balance = 0; freedUp += d.minPayment; }
    });
    let extra = extraMonthlyBudget + freedUp;
    for (const d of order) {
      if (extra <= 0) break;
      if (d.balance <= 0) continue;
      const pay = Math.min(extra, d.balance);
      d.balance -= pay;
      extra -= pay;
    }
  }
  return {
    months,
    totalInterest,
    payoffOrder: order.map(d => d.name),
    cleared: months < _DEBT_SIM_MAX_MONTHS,
  };
}

// Runs both strategies on the same debts/budget so they can be compared
// directly. Avalanche minimizes total interest by construction (it always
// puts extra money where it earns the highest guaranteed "return" — the
// interest rate being avoided) — interestSaved should never be negative.
function debtPayoffComparison(debts, extraMonthlyBudget) {
  const avalanche = simulateDebtPayoff(debts, extraMonthlyBudget, "avalanche");
  const snowball = simulateDebtPayoff(debts, extraMonthlyBudget, "snowball");
  return { avalanche, snowball, interestSaved: snowball.totalInterest - avalanche.totalInterest };
}

// No compounding here on purpose: an emergency fund is meant to be held
// as cash, not invested for growth, so this is pure arithmetic, not
// futureValue() — that's a deliberate difference from every other
// calculator on this page, not an oversight.
function emergencyFundTarget(monthlyExpenses, targetMonths, currentSavings, monthlyContribution) {
  const targetAmount = monthlyExpenses * targetMonths;
  const currentCoverageMonths = monthlyExpenses > 0 ? currentSavings / monthlyExpenses : 0;
  const remaining = Math.max(0, targetAmount - currentSavings);
  let monthsToTarget;
  if (remaining <= 0) monthsToTarget = 0;
  else if (monthlyContribution <= 0) monthsToTarget = Infinity;
  else monthsToTarget = remaining / monthlyContribution;
  return { targetAmount, currentCoverageMonths, remaining, monthsToTarget };
}

// Compares paying only the minimum (a percentage of the CURRENT balance,
// with a dollar floor — how real card issuers compute it, which is why
// the payment shrinks as the balance does and payoff drags out so much
// longer than a fixed payment would) against a fixed monthly payment on
// the same starting balance and APR.
function minimumPaymentTrap(balance, aprPct, minPaymentPct, minPaymentFloor, fixedPayment) {
  const monthlyRate = aprPct / 100 / 12;

  function runMinimumOnly() {
    let bal = balance, months = 0, totalInterest = 0;
    while (bal > 0.005 && months < _DEBT_SIM_MAX_MONTHS) {
      months++;
      const interest = bal * monthlyRate;
      totalInterest += interest;
      bal += interest;
      const payment = Math.min(Math.max(bal * (minPaymentPct / 100), minPaymentFloor), bal);
      bal -= payment;
    }
    return { months, totalInterest, cleared: months < _DEBT_SIM_MAX_MONTHS };
  }

  function runFixed() {
    let bal = balance, months = 0, totalInterest = 0;
    while (bal > 0.005 && months < _DEBT_SIM_MAX_MONTHS) {
      months++;
      const interest = bal * monthlyRate;
      totalInterest += interest;
      bal += interest;
      const payment = Math.min(fixedPayment, bal);
      bal -= payment;
    }
    return { months, totalInterest, cleared: months < _DEBT_SIM_MAX_MONTHS };
  }

  const minimumOnly = runMinimumOnly();
  const fixed = runFixed();
  return {
    minimumOnly,
    fixed,
    interestSaved: minimumOnly.totalInterest - fixed.totalInterest,
    monthsSaved: minimumOnly.months - fixed.months,
  };
}

// Shared math for payday loans AND auto title loans — structurally the
// same trap: a flat fee charged per short period, principal never
// actually reduces unless paid in full, so "renewing"/"rolling over"
// just pays the fee again. Only the typical fee%/period length differ
// between the two (UI supplies those), which is why one function covers
// both rather than two near-duplicates.
function rolloverLoanTrap(principal, feePercentPerPeriod, periodDays, numRollovers) {
  const feePerPeriod = principal * (feePercentPerPeriod / 100);
  const totalFeesPaid = feePerPeriod * numRollovers;
  const impliedApr = feePercentPerPeriod * (365 / periodDays);
  const series = [];
  for (let r = 0; r <= numRollovers; r++) {
    series.push({ rollover: r, cumulativeFees: feePerPeriod * r });
  }
  return { feePerPeriod, totalFeesPaid, impliedApr, totalPaid: totalFeesPaid + principal, series };
}

// The "0% if paid in full by month N" trap: if even a small balance
// survives the promo window, the standard mechanic is a RETROACTIVE
// interest charge — computed on the ORIGINAL purchase amount, over the
// WHOLE promo period, at the card's normal APR — not just interest on
// what's left. That retroactivity, not the rate itself, is what makes
// this trap different from an ordinary loan.
function deferredInterestTrap(purchaseAmount, promoMonths, deferredAprPct, monthlyPayment) {
  const totalPaidDuringPromo = Math.min(monthlyPayment * promoMonths, purchaseAmount);
  const remainingBalance = Math.max(0, purchaseAmount - monthlyPayment * promoMonths);
  const paidOffInTime = remainingBalance <= 0.005;
  const retroactiveInterest = paidOffInTime
    ? 0
    : purchaseAmount * (deferredAprPct / 100 / 12) * promoMonths;
  return {
    totalPaidDuringPromo,
    remainingBalance,
    paidOffInTime,
    retroactiveInterest,
    totalCost: purchaseAmount + retroactiveInterest,
  };
}

// Several concurrent "pay in 4" plans, each with its own remaining
// installments — the point isn't any single plan (each is usually
// interest-free), it's that the COMBINED per-period obligation and
// missed-payment fee exposure is easy to lose track of once a few plans
// overlap, since each one individually looks small.
function bnplStackingLoad(plans) {
  const active = plans.filter(p => p.installmentsRemaining > 0);
  const perPeriodObligation = active.reduce((sum, p) => sum + p.amount / p.installmentsTotal, 0);
  const totalRemainingOwed = active.reduce(
    (sum, p) => sum + (p.amount / p.installmentsTotal) * p.installmentsRemaining, 0
  );
  const maxLateFeeExposure = active.reduce((sum, p) => sum + (p.lateFeePerMissed || 0), 0);
  return { activeCount: active.length, perPeriodObligation, totalRemainingOwed, maxLateFeeExposure };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    futureValue, ruleOf72, feeDragComparison, solveTimeToGoal, solveRequiredContribution,
    latteFactor, simulateDebtPayoff, debtPayoffComparison, emergencyFundTarget, minimumPaymentTrap,
    rolloverLoanTrap, deferredInterestTrap, bnplStackingLoad,
  };
}
