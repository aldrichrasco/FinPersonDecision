// Calculators page — four real compound-interest tools (finance-calc.js
// has the pure math, unit-tested in tests-js/finance-calc.test.js; this
// file is just the DOM wiring). Charts reuse chart.js/turtle-chart.js's
// generic drawTrack/tokens/turtleChartGeometry, the same helpers
// pro-turtle-page.js and crypto-impulse-page.js's summary chart use — no
// new charting code, no library.
//
// Every module recalculates on every keystroke (no submit button): a
// calculator that requires clicking "go" to see the effect of one more
// digit undersells the actual point of these tools, which is letting
// someone feel how sensitive a 30-year projection is to a rate or a fee.
(function () {
  const content = document.getElementById("calc-content");
  let currentCalc = "growth";

  function fmtUsd(n) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function fmtYears(y) {
    if (!isFinite(y)) return "never, at these numbers";
    const years = Math.floor(y);
    const months = Math.round((y - years) * 12);
    if (months === 12) return `${years + 1} years`;
    if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
    return months === 0 ? `${years} year${years === 1 ? "" : "s"}` : `${years}y ${months}m`;
  }

  function field(id, label, value, opts = {}) {
    const step = opts.step ?? "1";
    const min = opts.min ?? "0";
    return `
      <label style="display:block;">
        <span style="display:block;font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--slate);margin-bottom:6px;">${label}</span>
        <input type="number" id="${id}" class="goal-input" value="${value}" min="${min}" step="${step}" style="max-width:160px;">
      </label>
    `;
  }

  function fieldsRow(html) {
    return `<div style="display:flex;flex-wrap:wrap;gap:16px 20px;margin-bottom:20px;">${html}</div>`;
  }

  function num(id) {
    const el = document.getElementById(id);
    const v = parseFloat(el.value);
    return isFinite(v) ? v : 0;
  }

  // Plain-language definitions for jargon used across the modules below —
  // wrapped inline via gloss() as a dotted-underline span with a hover/
  // focus tooltip (styles.css's .glossary-term), so a beginner doesn't
  // have to leave the page to look a term up.
  const GLOSSARY = {
    principal: "The amount you start with, before any growth or contributions are added.",
    compounding: "Earning growth on your growth, not just on what you put in — the reason these curves bend upward instead of climbing in a straight line.",
    "expense ratio": "The fund's annual fee, taken as a percentage of your balance every year whether the fund goes up or down.",
    apr: "Annual Percentage Rate — the yearly cost of borrowing (or, for a debt, the interest rate), expressed as a percentage.",
    "opportunity cost": "What you give up by choosing one option over another — here, the growth that money could have earned if invested instead of spent.",
    liquidity: "How quickly you can turn something into usable cash without losing value — why an emergency fund belongs in a savings account, not invested.",
    avalanche: "Paying extra toward the highest-interest debt first, minimums on the rest — mathematically minimizes the total interest you pay.",
    snowball: "Paying extra toward the smallest-balance debt first, minimums on the rest — costs a bit more in interest, but clears individual debts sooner, which research finds people are more likely to actually stick with.",
  };

  function gloss(term, displayText) {
    const def = GLOSSARY[term.toLowerCase()];
    const text = displayText || term;
    if (!def) return text;
    return `<span class="glossary-term" tabindex="0">${text}<span class="glossary-tooltip">${def}</span></span>`;
  }

  function habitTip(html) {
    return `
      <div style="background:var(--teal-tint);border-radius:10px;padding:12px 16px;margin-top:18px;">
        <p style="font-family:var(--font-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--teal);margin:0 0 4px;">Good habit</p>
        <p style="font-size:13.5px;line-height:1.5;color:var(--ink);margin:0;">${html}</p>
      </div>
    `;
  }

  // Generic multi-line growth chart: any number of {year,value} series,
  // same geometry approach as turtle-chart.js's drawEquityCurves but with
  // a real dollar-value domain instead of an equity multiplier.
  function drawGrowthChart(canvas, seriesList, colors, dashedFlags) {
    if (!canvas) return;
    const allValues = seriesList.flatMap(s => s.map(p => p.value));
    const minVal = Math.min(0, ...allValues);
    const maxVal = Math.max(...allValues);
    const pad = (maxVal - minVal) * 0.08 || 1;
    const g = turtleChartGeometry(canvas, minVal - pad, maxVal + pad);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = g.w * dpr; canvas.height = g.h * dpr; canvas.style.height = `${g.h}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    seriesList.forEach((s, idx) => {
      const values = s.map(p => p.value);
      drawTrack(ctx, g, values, values.length, colors[idx], {
        width: dashedFlags && dashedFlags[idx] ? 2 : 2.5,
        dashed: !!(dashedFlags && dashedFlags[idx]),
      });
    });
  }

  // ---------------------------------------------------------------- growth

  function renderGrowth() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Compound Growth — the "assumed rate" problem</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Long-term projections live or die on the rate you assume. A 7% real return is a common rule-of-thumb
          for a diversified stock fund over long periods — but it is an assumption, not a guarantee. This chart
          shows your assumption bracketed by a more conservative and a more optimistic one, same ${gloss("principal", "starting amount")},
          same contributions, same years. The curve you see is ${gloss("compounding")} at work.
        </p>
        ${fieldsRow(
          field("cg-initial", "Initial amount ($)", 1000, { step: 100 }) +
          field("cg-contribution", "Monthly contribution ($)", 200, { step: 25 }) +
          field("cg-years", "Years", 30, { step: 1, min: 1 }) +
          field("cg-rate", "Your assumed rate (%)", 7, { step: 0.1 })
        )}
        <canvas id="cg-chart" style="width:100%;display:block;"></canvas>
        <div id="cg-legend" style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-family:var(--font-mono);font-size:12px;"></div>
        <div id="cg-results" style="margin-top:16px;font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip('Start now, even small. Money contributed in your first years has the most years left to compound — waiting five years to start "until I can contribute more" usually costs more than the extra amount would have earned.')}
      </section>
    `;
    ["cg-initial", "cg-contribution", "cg-years", "cg-rate"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalcGrowth)
    );
    recalcGrowth();
  }

  function recalcGrowth() {
    const initial = num("cg-initial"), contribution = num("cg-contribution");
    const years = Math.max(1, num("cg-years")), rate = num("cg-rate");
    const conservative = Math.max(0, rate - 4), optimistic = rate + 4;

    const t = tokens();
    const runs = [
      { label: `Conservative (${conservative.toFixed(1)}%)`, rate: conservative, color: t.slate, dashed: true },
      { label: `Your assumption (${rate.toFixed(1)}%)`, rate, color: t.teal, dashed: false },
      { label: `Optimistic (${optimistic.toFixed(1)}%)`, rate: optimistic, color: t.brick, dashed: true },
    ].map(r => ({ ...r, result: futureValue(initial, contribution, r.rate, years) }));

    drawGrowthChart(
      document.getElementById("cg-chart"),
      runs.map(r => r.result.series),
      runs.map(r => r.color),
      runs.map(r => r.dashed)
    );
    document.getElementById("cg-legend").innerHTML = runs.map(r => `
      <span style="display:flex;align-items:center;gap:6px;">
        <span style="width:14px;height:2px;background:${r.color};display:inline-block;"></span>${r.label}
      </span>
    `).join("");
    const primary = runs[1].result;
    document.getElementById("cg-results").innerHTML = runs.map(r => `
      <div>${r.label}: <strong>${fmtUsd(r.result.finalValue)}</strong></div>
    `).join("") + `
      <div style="margin-top:8px;color:var(--slate);">
        At your assumption: ${fmtUsd(primary.totalContributed)} contributed, ${fmtUsd(primary.totalGrowth)} from growth.
      </div>
    `;
  }

  // ---------------------------------------------------------------- rule72

  function renderRule72() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Rule of 72 — how good is the shortcut?</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          "Years to double = 72 &divide; rate" is a mental-math shortcut, not the real answer. This compares it
          against the exact doubling time (solved from the same compounding used everywhere else on this page).
        </p>
        ${fieldsRow(field("r72-rate", "Annual rate (%)", 7, { step: 0.1 }))}
        <div id="r72-results" style="font-family:var(--font-mono);font-size:15px;line-height:2;"></div>
        ${habitTip("Rules of thumb are for quick intuition, not the final word. They're great for a gut check in conversation — but before a real decision, run the actual numbers, here or with the other calculators on this page.")}
      </section>
    `;
    document.getElementById("r72-rate").addEventListener("input", recalcRule72);
    recalcRule72();
  }

  function recalcRule72() {
    const rate = num("r72-rate");
    const { approxYears, exactYears } = ruleOf72(rate);
    const diffMonths = Math.abs(approxYears - exactYears) * 12;
    document.getElementById("r72-results").innerHTML = `
      <div>Rule of 72 estimate: <strong>${fmtYears(approxYears)}</strong> to double</div>
      <div>Exact answer: <strong>${fmtYears(exactYears)}</strong> to double</div>
      <div style="color:var(--slate);font-size:13px;">
        Off by about ${diffMonths < 1 ? "less than a month" : `${diffMonths.toFixed(1)} months`}
        ${rate > 15 || rate < 4 ? " — the approximation gets noticeably worse the further the rate is from roughly 6-10%." : "."}
      </div>
    `;
  }

  // ---------------------------------------------------------------- fees

  function renderFees() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Fee Drag — what an ${gloss("expense ratio")} actually costs</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Same contributions, same gross return, two ${gloss("expense ratio", "expense ratios")} subtracted from it. Fees are a straight
          drag on the return you actually keep, and they compound away just as powerfully as growth compounds up.
        </p>
        ${fieldsRow(
          field("fd-initial", "Initial amount ($)", 10000, { step: 500 }) +
          field("fd-contribution", "Monthly contribution ($)", 300, { step: 25 }) +
          field("fd-years", "Years", 30, { step: 1, min: 1 }) +
          field("fd-gross", "Gross annual return (%)", 7, { step: 0.1 })
        )}
        ${fieldsRow(
          field("fd-fee-a", "Fund A expense ratio (%)", 0.05, { step: 0.05 }) +
          field("fd-fee-b", "Fund B expense ratio (%)", 1.0, { step: 0.05 })
        )}
        <canvas id="fd-chart" style="width:100%;display:block;"></canvas>
        <div id="fd-legend" style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-family:var(--font-mono);font-size:12px;"></div>
        <div id="fd-results" style="margin-top:16px;font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip("Check a fund's expense ratio before you buy it — it's public (the fund's fact sheet or prospectus), and unlike future returns, it's one of the few things you can actually know in advance and control.")}
      </section>
    `;
    ["fd-initial", "fd-contribution", "fd-years", "fd-gross", "fd-fee-a", "fd-fee-b"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalcFees)
    );
    recalcFees();
  }

  function recalcFees() {
    const initial = num("fd-initial"), contribution = num("fd-contribution");
    const years = Math.max(1, num("fd-years")), gross = num("fd-gross");
    const feeA = num("fd-fee-a"), feeB = num("fd-fee-b");
    const { a, b, difference } = feeDragComparison(initial, contribution, gross, years, feeA, feeB);

    const t = tokens();
    drawGrowthChart(
      document.getElementById("fd-chart"),
      [a.series, b.series],
      [t.teal, t.brick],
      [false, true]
    );
    document.getElementById("fd-legend").innerHTML = `
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.teal};display:inline-block;"></span>Fund A (${feeA.toFixed(2)}% fee)</span>
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.brick};display:inline-block;"></span>Fund B (${feeB.toFixed(2)}% fee)</span>
    `;
    // The lower-fee fund always ends ahead here (same gross return, only
    // the fee differs) — compute the winner directly from the fees
    // rather than the value difference's sign, so the label can't drift
    // out of sync with which fund it's actually describing.
    const lowerFeeIsA = feeA <= feeB;
    document.getElementById("fd-results").innerHTML = `
      <div>Fund A ends at: <strong>${fmtUsd(a.finalValue)}</strong></div>
      <div>Fund B ends at: <strong>${fmtUsd(b.finalValue)}</strong></div>
      <div style="margin-top:8px;color:var(--teal);">
        The lower-fee fund (${lowerFeeIsA ? "Fund A" : "Fund B"}, ${Math.min(feeA, feeB).toFixed(2)}% vs
        ${Math.max(feeA, feeB).toFixed(2)}%) ends ${fmtUsd(Math.abs(difference))} ahead over ${years} years —
        same money in, same gross return, only the fee differs.
      </div>
    `;
  }

  // ---------------------------------------------------------------- goal

  let goalMode = "time"; // "time" solves for years; "contribution" solves for required monthly amount

  function renderGoal() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Savings Goal</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Solve for how long a goal takes at a given contribution, or how much you'd need to contribute to hit
          it by a given date.
        </p>
        <div class="chip-row" id="goal-mode-tabs" style="margin-bottom:18px;">
          <button class="chip ${goalMode === "time" ? "active" : ""}" data-mode="time" aria-pressed="${goalMode === "time"}">Solve for time</button>
          <button class="chip ${goalMode === "contribution" ? "active" : ""}" data-mode="contribution" aria-pressed="${goalMode === "contribution"}">Solve for contribution</button>
        </div>
        <div id="goal-fields"></div>
        <div id="goal-results" style="margin-top:16px;font-family:var(--font-mono);font-size:15px;line-height:1.9;"></div>
        ${habitTip("Automate whatever contribution you land on here — a transfer that happens on payday, before you see the money, works far more reliably than remembering to save what's left at the end of the month.")}
      </section>
    `;
    document.querySelectorAll("#goal-mode-tabs .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        goalMode = chip.dataset.mode;
        renderGoal();
      });
    });
    renderGoalFields();
  }

  function renderGoalFields() {
    const fieldsEl = document.getElementById("goal-fields");
    if (goalMode === "time") {
      fieldsEl.innerHTML = fieldsRow(
        field("g-initial", "Starting amount ($)", 2000, { step: 100 }) +
        field("g-contribution", "Monthly contribution ($)", 400, { step: 25 }) +
        field("g-rate", "Annual rate (%)", 7, { step: 0.1 }) +
        field("g-goal", "Goal amount ($)", 50000, { step: 1000 })
      );
      ["g-initial", "g-contribution", "g-rate", "g-goal"].forEach(id =>
        document.getElementById(id).addEventListener("input", recalcGoalTime)
      );
      recalcGoalTime();
    } else {
      fieldsEl.innerHTML = fieldsRow(
        field("g-initial", "Starting amount ($)", 2000, { step: 100 }) +
        field("g-rate", "Annual rate (%)", 7, { step: 0.1 }) +
        field("g-years", "Years available", 10, { step: 1, min: 1 }) +
        field("g-goal", "Goal amount ($)", 50000, { step: 1000 })
      );
      ["g-initial", "g-rate", "g-years", "g-goal"].forEach(id =>
        document.getElementById(id).addEventListener("input", recalcGoalContribution)
      );
      recalcGoalContribution();
    }
  }

  function recalcGoalTime() {
    const initial = num("g-initial"), contribution = num("g-contribution");
    const rate = num("g-rate"), goal = num("g-goal");
    const years = solveTimeToGoal(initial, contribution, rate, goal);
    document.getElementById("goal-results").innerHTML = isFinite(years)
      ? `<div>Time to reach ${fmtUsd(goal)}: <strong>${fmtYears(years)}</strong></div>`
      : `<div style="color:var(--brick);">Not reachable at $0/month growth with these numbers — add a contribution or a positive rate.</div>`;
  }

  function recalcGoalContribution() {
    const initial = num("g-initial"), rate = num("g-rate");
    const years = Math.max(1, num("g-years")), goal = num("g-goal");
    const contribution = solveRequiredContribution(initial, rate, years, goal);
    document.getElementById("goal-results").innerHTML = contribution > 0
      ? `<div>Required monthly contribution: <strong>${fmtUsd(contribution)}</strong></div>`
      : `<div style="color:var(--teal);">Your starting amount alone reaches ${fmtUsd(goal)} in ${years} years at this rate — no further contribution needed.</div>`;
  }

  // ---------------------------------------------------------------- latte

  function renderLatte() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Latte Factor — the cost of a small habit</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Not a claim that coffee is the problem — any small, regular spend works the same way. This is the
          ${gloss("opportunity cost")} of it: what the same money would be worth if it went into an investment
          account instead, on the same schedule.
        </p>
        ${fieldsRow(
          field("lf-amount", "Cost per occurrence ($)", 5, { step: 0.5 }) +
          field("lf-freq", "Times per week", 5, { step: 1, min: 0 }) +
          field("lf-years", "Years", 20, { step: 1, min: 1 }) +
          field("lf-rate", "Assumed rate (%)", 7, { step: 0.1 })
        )}
        <canvas id="lf-chart" style="width:100%;display:block;"></canvas>
        <div id="lf-legend" style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-family:var(--font-mono);font-size:12px;"></div>
        <div id="lf-results" style="margin-top:16px;font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip("This isn't a call to cut every small joy from your life — it's a call to redirect ONE habit you don't actually value, automatically, into an investment account. Pick one, not all of them.")}
      </section>
    `;
    ["lf-amount", "lf-freq", "lf-years", "lf-rate"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalcLatte)
    );
    recalcLatte();
  }

  function recalcLatte() {
    const amount = num("lf-amount"), freq = num("lf-freq");
    const years = Math.max(1, num("lf-years")), rate = num("lf-rate");
    const result = latteFactor(amount, freq, rate, years);
    const spentSeries = result.invested.series.map(p => ({ year: p.year, value: result.monthlyAmount * 12 * p.year }));

    const t = tokens();
    drawGrowthChart(
      document.getElementById("lf-chart"),
      [spentSeries, result.invested.series],
      [t.slate, t.teal],
      [true, false]
    );
    document.getElementById("lf-legend").innerHTML = `
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.slate};display:inline-block;"></span>Just spent (no growth)</span>
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.teal};display:inline-block;"></span>Invested instead</span>
    `;
    document.getElementById("lf-results").innerHTML = `
      <div>That's ${fmtUsd(result.monthlyAmount)}/month.</div>
      <div>Just spent over ${years} years: <strong>${fmtUsd(result.totalSpent)}</strong></div>
      <div>Invested instead: <strong style="color:var(--teal);">${fmtUsd(result.invested.finalValue)}</strong></div>
      <div style="color:var(--slate);">The difference — ${fmtUsd(result.invested.finalValue - result.totalSpent)} — is what ${gloss("compounding")} added, not extra money you found.</div>
    `;
  }

  // ---------------------------------------------------------------- debt

  function renderDebt() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Debt Payoff — ${gloss("avalanche")} vs ${gloss("snowball")}</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Enter up to three debts (leave a balance at 0 to skip it) and how much extra you can put toward them
          each month beyond the minimums. Both strategies pay every minimum, every month — they only differ in
          which debt the extra money attacks first.
        </p>
        ${fieldsRow(
          field("db-bal-1", "Debt 1 balance ($)", 800, { step: 50 }) +
          field("db-apr-1", "Debt 1 APR (%)", 24, { step: 0.5 }) +
          field("db-min-1", "Debt 1 min payment ($)", 30, { step: 5 })
        )}
        ${fieldsRow(
          field("db-bal-2", "Debt 2 balance ($)", 4000, { step: 100 }) +
          field("db-apr-2", "Debt 2 APR (%)", 18, { step: 0.5 }) +
          field("db-min-2", "Debt 2 min payment ($)", 90, { step: 5 })
        )}
        ${fieldsRow(
          field("db-bal-3", "Debt 3 balance ($)", 0, { step: 100 }) +
          field("db-apr-3", "Debt 3 APR (%)", 10, { step: 0.5 }) +
          field("db-min-3", "Debt 3 min payment ($)", 0, { step: 5 })
        )}
        ${fieldsRow(field("db-extra", "Extra monthly budget ($)", 150, { step: 25 }))}
        <div id="db-results" style="font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip("Mathematically, avalanche always wins or ties. But the method you'll actually stick with is the one that wins — if seeing a debt hit $0 quickly keeps you going, snowball's small extra cost may be worth it.")}
      </section>
    `;
    ["db-bal-1", "db-apr-1", "db-min-1", "db-bal-2", "db-apr-2", "db-min-2",
     "db-bal-3", "db-apr-3", "db-min-3", "db-extra"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalcDebt)
    );
    recalcDebt();
  }

  function recalcDebt() {
    const debts = [1, 2, 3]
      .map(i => ({
        name: `Debt ${i}`,
        balance: num(`db-bal-${i}`),
        aprPct: num(`db-apr-${i}`),
        minPayment: num(`db-min-${i}`),
      }))
      .filter(d => d.balance > 0);
    const extra = num("db-extra");
    const results = document.getElementById("db-results");

    if (!debts.length) {
      results.innerHTML = `<div style="color:var(--slate);">Enter at least one debt balance above.</div>`;
      return;
    }
    const { avalanche, snowball, interestSaved } = debtPayoffComparison(debts, extra);
    const warn = !avalanche.cleared
      ? `<div style="color:var(--brick);margin-bottom:10px;">These payments don't clear the debt within 50 years at these numbers — add more to the extra budget.</div>`
      : "";
    results.innerHTML = warn + `
      <div><strong>Avalanche</strong> (${avalanche.payoffOrder.join(" → ")}): ${fmtYears(avalanche.months / 12)}, ${fmtUsd(avalanche.totalInterest)} total interest</div>
      <div><strong>Snowball</strong> (${snowball.payoffOrder.join(" → ")}): ${fmtYears(snowball.months / 12)}, ${fmtUsd(snowball.totalInterest)} total interest</div>
      <div style="margin-top:8px;color:${interestSaved > 0.5 ? "var(--teal)" : "var(--slate)"};">
        ${interestSaved > 0.5 ? `Avalanche saves ${fmtUsd(interestSaved)} in interest here.` : "Both strategies cost about the same in interest with these numbers."}
      </div>
    `;
  }

  // ---------------------------------------------------------------- emergency

  function renderEmergency() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Emergency Fund</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Usually taught as the first step, before investing at all: enough cash, held for ${gloss("liquidity")}
          rather than growth, to cover a real gap — a lost job, a medical bill, a broken car — without going
          into debt for it.
        </p>
        ${fieldsRow(
          field("ef-expenses", "Monthly essential expenses ($)", 2500, { step: 100 }) +
          field("ef-months", "Target months of coverage", 6, { step: 1, min: 1 }) +
          field("ef-current", "Current savings ($)", 1500, { step: 100 }) +
          field("ef-contribution", "Monthly contribution ($)", 300, { step: 25 })
        )}
        <div id="ef-bar" style="height:14px;border-radius:999px;background:var(--slate-tint);overflow:hidden;margin:8px 0 16px;">
          <div id="ef-bar-fill" style="height:100%;background:var(--teal);width:0%;transition:width .2s ease;"></div>
        </div>
        <div id="ef-results" style="font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip("Keep this fund boring on purpose — a plain savings account, not invested. The point isn't growth, it's that the money is there, at full value, the day you need it.")}
      </section>
    `;
    ["ef-expenses", "ef-months", "ef-current", "ef-contribution"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalcEmergency)
    );
    recalcEmergency();
  }

  function recalcEmergency() {
    const expenses = num("ef-expenses"), targetMonths = Math.max(1, num("ef-months"));
    const current = num("ef-current"), contribution = num("ef-contribution");
    const result = emergencyFundTarget(expenses, targetMonths, current, contribution);
    const pct = Math.min(100, (result.currentCoverageMonths / targetMonths) * 100);
    document.getElementById("ef-bar-fill").style.width = `${pct}%`;
    document.getElementById("ef-results").innerHTML = `
      <div>Target: <strong>${fmtUsd(result.targetAmount)}</strong> (${targetMonths} months of expenses)</div>
      <div>You're currently covered for: <strong>${result.currentCoverageMonths.toFixed(1)} months</strong></div>
      ${result.remaining > 0
        ? `<div>Still need: <strong>${fmtUsd(result.remaining)}</strong> — about <strong>${fmtYears(result.monthsToTarget / 12)}</strong> at this contribution</div>`
        : `<div style="color:var(--teal);">Target already met.</div>`}
    `;
  }

  // ---------------------------------------------------------------- min-payment

  function renderMinPayment() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Minimum Payment Trap</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Real card issuers compute the minimum as a percentage of your CURRENT balance, with a dollar floor —
          so the payment shrinks as the balance does, and payoff drags out far longer than most people expect.
          Compare it against a fixed payment on the same balance and ${gloss("apr")}.
        </p>
        ${fieldsRow(
          field("mp-balance", "Balance ($)", 4000, { step: 100 }) +
          field("mp-apr", "APR (%)", 22, { step: 0.5 }) +
          field("mp-pct", "Minimum payment (% of balance)", 2, { step: 0.5 }) +
          field("mp-floor", "Minimum payment floor ($)", 25, { step: 5 })
        )}
        ${fieldsRow(field("mp-fixed", "Fixed payment to compare ($)", 200, { step: 25 }))}
        <div id="mp-results" style="font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip("Paying only the minimum on a revolving balance is one of the most expensive habits in personal finance. If you're carrying a balance, even a modest fixed payment above the minimum usually cuts years and thousands in interest off the payoff.")}
      </section>
    `;
    ["mp-balance", "mp-apr", "mp-pct", "mp-floor", "mp-fixed"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalcMinPayment)
    );
    recalcMinPayment();
  }

  function recalcMinPayment() {
    const balance = num("mp-balance"), apr = num("mp-apr");
    const pct = num("mp-pct"), floor = num("mp-floor"), fixed = num("mp-fixed");
    const { minimumOnly, fixed: fixedResult, interestSaved, monthsSaved } = minimumPaymentTrap(balance, apr, pct, floor, fixed);
    const results = document.getElementById("mp-results");
    const minWarn = !minimumOnly.cleared
      ? `<div style="color:var(--brick);">At these numbers, minimum payments don't clear the balance within 50 years — the payment shrinks with the balance almost as fast as it reduces it.</div>`
      : `<div>Minimum payments only: <strong>${fmtYears(minimumOnly.months / 12)}</strong>, ${fmtUsd(minimumOnly.totalInterest)} total interest</div>`;
    const fixedWarn = !fixedResult.cleared
      ? `<div style="color:var(--brick);">This fixed payment doesn't clear the balance within 50 years either — it needs to be well above the interest being charged each month.</div>`
      : `<div>Fixed ${fmtUsd(fixed)}/month: <strong>${fmtYears(fixedResult.months / 12)}</strong>, ${fmtUsd(fixedResult.totalInterest)} total interest</div>`;
    results.innerHTML = minWarn + fixedWarn + (minimumOnly.cleared && fixedResult.cleared ? `
      <div style="margin-top:8px;color:var(--teal);">
        The fixed payment saves ${fmtUsd(Math.max(0, interestSaved))} in interest and ${Math.max(0, Math.round(monthsSaved))} months.
      </div>
    ` : "");
  }

  // ---------------------------------------------------------------- payday / auto-title (shared rollover math)

  function renderRolloverTrap(kind) {
    const isPayday = kind === "payday";
    const defaults = isPayday
      ? { principal: 300, fee: 15, periodDays: 14, rollovers: 4 }
      : { principal: 1500, fee: 25, periodDays: 30, rollovers: 3 };
    const idPrefix = isPayday ? "pd" : "at";
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">${isPayday ? "Payday Loan" : "Auto Title Loan"} Rollover Spiral</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          ${isPayday
            ? "A payday loan charges a flat fee for a short term (often ~2 weeks). If it isn't paid off by then, \"rolling over\" (renewing) just pays the fee again — the amount you actually owe never goes down."
            : "An auto title loan works the same way as a payday loan, secured by your car instead: a flat fee per short term, and renewing pays the fee again without reducing what you owe. Missing payments risks losing the car."}
        </p>
        ${fieldsRow(
          field(`${idPrefix}-principal`, "Loan amount ($)", defaults.principal, { step: 50 }) +
          field(`${idPrefix}-fee`, "Fee (% of loan, per term)", defaults.fee, { step: 1 }) +
          field(`${idPrefix}-period`, "Term length (days)", defaults.periodDays, { step: 1, min: 1 }) +
          field(`${idPrefix}-rollovers`, "Number of rollovers", defaults.rollovers, { step: 1, min: 0 })
        )}
        <canvas id="${idPrefix}-chart" style="width:100%;display:block;"></canvas>
        <div id="${idPrefix}-legend" style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-family:var(--font-mono);font-size:12px;"></div>
        <div id="${idPrefix}-results" style="margin-top:16px;font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip(isPayday
          ? "The fee looks small in isolation. Annualized, it's usually 300–400%+ — far more than the emergency it's covering. If you're using one to bridge a gap, that gap is often still there at renewal time, which is exactly when rollovers start. A small Emergency Fund is the real alternative."
          : "Missing a payment risks losing your car — which for most people is also how they get to work, so the damage can cascade into lost income too. If you're considering one, a nonprofit credit counselor can often help for free before you sign.")}
      </section>
    `;
    [`${idPrefix}-principal`, `${idPrefix}-fee`, `${idPrefix}-period`, `${idPrefix}-rollovers`].forEach(id =>
      document.getElementById(id).addEventListener("input", () => recalcRolloverTrap(idPrefix))
    );
    recalcRolloverTrap(idPrefix);
  }

  function recalcRolloverTrap(idPrefix) {
    const principal = num(`${idPrefix}-principal`), feePct = num(`${idPrefix}-fee`);
    const periodDays = Math.max(1, num(`${idPrefix}-period`)), rollovers = Math.max(0, num(`${idPrefix}-rollovers`));
    const result = rolloverLoanTrap(principal, feePct, periodDays, rollovers);
    const feesSeries = result.series.map(p => ({ year: p.rollover, value: p.cumulativeFees }));
    const principalSeries = result.series.map(p => ({ year: p.rollover, value: principal }));

    const t = tokens();
    drawGrowthChart(
      document.getElementById(`${idPrefix}-chart`),
      [principalSeries, feesSeries],
      [t.slate, t.brick],
      [true, false]
    );
    document.getElementById(`${idPrefix}-legend`).innerHTML = `
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.slate};display:inline-block;"></span>Principal still owed (never shrinks)</span>
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.brick};display:inline-block;"></span>Fees paid so far</span>
    `;
    document.getElementById(`${idPrefix}-results`).innerHTML = `
      <div>Fee per term: <strong>${fmtUsd(result.feePerPeriod)}</strong></div>
      <div>Total fees paid after ${rollovers} rollover${rollovers === 1 ? "" : "s"}: <strong style="color:var(--brick);">${fmtUsd(result.totalFeesPaid)}</strong></div>
      <div>Implied ${gloss("apr")}: <strong style="color:var(--brick);">${result.impliedApr.toFixed(0)}%</strong></div>
      <div style="color:var(--slate);">You've paid ${fmtUsd(result.totalFeesPaid)} in fees and STILL owe the full ${fmtUsd(principal)} principal.</div>
    `;
  }

  // ---------------------------------------------------------------- deferred interest

  function renderDeferredInterest() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Deferred-Interest Store Promotion</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          "No interest if paid in full within N months" is real — until it isn't. If any balance survives the
          promo window, the usual mechanic charges interest RETROACTIVELY on the whole original purchase, for
          the whole promo period, at the card's normal (often high) rate — not just on what's left.
        </p>
        ${fieldsRow(
          field("di-amount", "Purchase amount ($)", 1200, { step: 50 }) +
          field("di-months", "Promo period (months)", 12, { step: 1, min: 1 }) +
          field("di-apr", "Card's deferred APR (%)", 29.99, { step: 0.5 }) +
          field("di-payment", "Your planned monthly payment ($)", 95, { step: 5 })
        )}
        <div id="di-results" style="font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip("If you use one of these promotions, calculate the exact payment needed to reach zero by the deadline and automate it. “Close enough” isn't — even a few dollars left over triggers interest on the ENTIRE original amount, not just what's remaining.")}
      </section>
    `;
    ["di-amount", "di-months", "di-apr", "di-payment"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalcDeferredInterest)
    );
    recalcDeferredInterest();
  }

  function recalcDeferredInterest() {
    const amount = num("di-amount"), months = Math.max(1, num("di-months"));
    const apr = num("di-apr"), payment = num("di-payment");
    const result = deferredInterestTrap(amount, months, apr, payment);
    document.getElementById("di-results").innerHTML = `
      <div>Paid during the promo: <strong>${fmtUsd(result.totalPaidDuringPromo)}</strong></div>
      <div>Remaining balance at the deadline: <strong>${fmtUsd(result.remainingBalance)}</strong></div>
      ${result.paidOffInTime
        ? `<div style="margin-top:8px;color:var(--teal);">Paid off in time — the promo worked as advertised. Total cost: ${fmtUsd(result.totalCost)}.</div>`
        : `<div style="margin-top:8px;color:var(--brick);">
             Not paid off in time. Retroactive interest charged on the full ${fmtUsd(amount)} over all ${months}
             months: <strong>${fmtUsd(result.retroactiveInterest)}</strong>. Total cost: <strong>${fmtUsd(result.totalCost)}</strong>
             — on a ${fmtUsd(result.remainingBalance)} shortfall.
           </div>`}
    `;
  }

  // ---------------------------------------------------------------- bnpl stacking

  function renderBnpl() {
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">BNPL Stacking</p>
        <p class="scenario-text" style="font-size:15px;max-width:640px;">
          Each "pay in 4" plan is usually small and interest-free on its own. The trap is combining several across
          different purchases and apps at once — the individual decisions all felt small, but the combined
          obligation didn't get decided all at once. Enter up to four active plans (0 installments remaining = skip it).
        </p>
        ${fieldsRow(
          field("bn-amt-1", "Plan 1 amount ($)", 80, { step: 10 }) +
          field("bn-total-1", "Plan 1 installments total", 4, { step: 1, min: 1 }) +
          field("bn-rem-1", "Plan 1 installments left", 3, { step: 1, min: 0 }) +
          field("bn-fee-1", "Plan 1 late fee ($)", 7, { step: 1 })
        )}
        ${fieldsRow(
          field("bn-amt-2", "Plan 2 amount ($)", 150, { step: 10 }) +
          field("bn-total-2", "Plan 2 installments total", 4, { step: 1, min: 1 }) +
          field("bn-rem-2", "Plan 2 installments left", 2, { step: 1, min: 0 }) +
          field("bn-fee-2", "Plan 2 late fee ($)", 8, { step: 1 })
        )}
        ${fieldsRow(
          field("bn-amt-3", "Plan 3 amount ($)", 60, { step: 10 }) +
          field("bn-total-3", "Plan 3 installments total", 4, { step: 1, min: 1 }) +
          field("bn-rem-3", "Plan 3 installments left", 1, { step: 1, min: 0 }) +
          field("bn-fee-3", "Plan 3 late fee ($)", 7, { step: 1 })
        )}
        ${fieldsRow(
          field("bn-amt-4", "Plan 4 amount ($)", 0, { step: 10 }) +
          field("bn-total-4", "Plan 4 installments total", 4, { step: 1, min: 1 }) +
          field("bn-rem-4", "Plan 4 installments left", 0, { step: 1, min: 0 }) +
          field("bn-fee-4", "Plan 4 late fee ($)", 0, { step: 1 })
        )}
        <div id="bn-results" style="font-family:var(--font-mono);font-size:14px;line-height:1.9;"></div>
        ${habitTip("Before accepting a new “pay in 4,” add up every payment across ALL your active plans for the next period — not just this one. That combined number is the real decision, not the four small ones that got you here.")}
      </section>
    `;
    [1, 2, 3, 4].flatMap(i => [`bn-amt-${i}`, `bn-total-${i}`, `bn-rem-${i}`, `bn-fee-${i}`]).forEach(id =>
      document.getElementById(id).addEventListener("input", recalcBnpl)
    );
    recalcBnpl();
  }

  function recalcBnpl() {
    const plans = [1, 2, 3, 4]
      .map(i => ({
        amount: num(`bn-amt-${i}`),
        installmentsTotal: Math.max(1, num(`bn-total-${i}`)),
        installmentsRemaining: num(`bn-rem-${i}`),
        lateFeePerMissed: num(`bn-fee-${i}`),
      }))
      .filter(p => p.amount > 0);
    const result = bnplStackingLoad(plans);
    document.getElementById("bn-results").innerHTML = result.activeCount
      ? `
        <div>Active plans: <strong>${result.activeCount}</strong></div>
        <div>Combined obligation this period: <strong style="color:var(--brick);">${fmtUsd(result.perPeriodObligation)}</strong></div>
        <div>Total still owed across all plans: <strong>${fmtUsd(result.totalRemainingOwed)}</strong></div>
        <div>If you missed every plan's payment this period: <strong style="color:var(--brick);">${fmtUsd(result.maxLateFeeExposure)}</strong> in late fees</div>
      `
      : `<div style="color:var(--slate);">Enter at least one plan with installments remaining above.</div>`;
  }

  // ---------------------------------------------------------------- tabs

  const RENDERERS = {
    growth: renderGrowth, rule72: renderRule72, fees: renderFees, goal: renderGoal,
    latte: renderLatte, debt: renderDebt, emergency: renderEmergency, minpayment: renderMinPayment,
    payday: () => renderRolloverTrap("payday"), autotitle: () => renderRolloverTrap("autotitle"),
    deferred: renderDeferredInterest, bnpl: renderBnpl,
  };

  // Roadmap levels link here as calculators.html#calc=<key> (see
  // roadmap-data.js) so "go do this" lands on the right tab directly,
  // not just the page — activateCalc() is shared by that deep link, the
  // tab clicks below, and the initial page load.
  function activateCalc(key) {
    if (!RENDERERS[key]) return;
    currentCalc = key;
    document.querySelectorAll("#calc-tabs .chip").forEach(c => {
      const active = c.dataset.calc === key;
      c.classList.toggle("active", active);
      c.setAttribute("aria-pressed", String(active));
    });
    RENDERERS[key]();
    if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete(key);
    if (typeof markTrainingRep === "function") markTrainingRep(key);
  }

  document.querySelectorAll("#calc-tabs .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (chip.dataset.calc === currentCalc) return;
      activateCalc(chip.dataset.calc);
    });
  });

  const hashMatch = location.hash.match(/calc=([\w-]+)/);
  activateCalc(hashMatch && RENDERERS[hashMatch[1]] ? hashMatch[1] : "growth");
})();
