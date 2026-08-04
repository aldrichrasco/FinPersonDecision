// Retirement Systems page — the one interactive piece, comparing what
// YOUR contribution alone grows to vs. your contribution plus the
// employer/mandatory portion combined. Reuses finance-calc.js's
// futureValue() (same math as the Calculators page) and chart.js/
// turtle-chart.js's generic chart helpers — no new math, no new charting
// code, just a different framing of the same compounding.
(function () {
  const fieldsEl = document.getElementById("rs-fields");
  let currentCountry = "us";

  // Illustrative starting points only — see this page's own disclaimer.
  // "yourPct" is a reasonable typical elective/voluntary rate for that
  // system; "employerPct" is the mandatory/matched portion which is the
  // whole point of this comparison.
  const COUNTRY_PRESETS = {
    us: { label: "US 401(k)", salary: 70000, yourPct: 6, employerPct: 3, note: "A common 401(k) match: 50% up to 6% of salary — the employer 3% here is contingent on you contributing at least 6% yourself." },
    au: { label: "AU Superannuation", salary: 70000, yourPct: 0, employerPct: 11.5, note: "The 11.5% employer rate is mandatory and paid on top of salary regardless of what you contribute — \"your %\" here is optional extra (\"salary sacrifice\") on top of that." },
    uk: { label: "UK Workplace Pension", salary: 45000, yourPct: 5, employerPct: 3, note: "A typical auto-enrolment split — roughly 5% employee / 3% employer, the common minimum combined ~8%." },
    ca: { label: "CA RRSP", salary: 65000, yourPct: 5, employerPct: 0, note: "No national employer mandate — 0% employer here reflects a typical individual RRSP with no employer match; some employer group RRSPs do match." },
    nz: { label: "NZ KiwiSaver", salary: 60000, yourPct: 3, employerPct: 3, note: "KiwiSaver minimums: 3% employee (selectable up to 10%) and a mandatory 3% employer minimum." },
  };

  function fmtUsd(n) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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
    const v = parseFloat(document.getElementById(id).value);
    return isFinite(v) ? v : 0;
  }

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

  function renderFields(preset) {
    fieldsEl.innerHTML = fieldsRow(
      field("rs-salary", "Annual salary ($)", preset.salary, { step: 1000 }) +
      field("rs-your-pct", "Your contribution (%)", preset.yourPct, { step: 0.5 }) +
      field("rs-employer-pct", "Employer/mandatory (%)", preset.employerPct, { step: 0.5 }) +
      field("rs-years", "Years", 30, { step: 1, min: 1 }) +
      field("rs-rate", "Assumed rate (%)", 7, { step: 0.1 })
    ) + `<p style="font-size:12.5px;color:var(--slate);margin:-8px 0 18px;">${preset.note}</p>`;
    ["rs-salary", "rs-your-pct", "rs-employer-pct", "rs-years", "rs-rate"].forEach(id =>
      document.getElementById(id).addEventListener("input", recalc)
    );
  }

  function recalc() {
    const salary = num("rs-salary"), yourPct = num("rs-your-pct"), employerPct = num("rs-employer-pct");
    const years = Math.max(1, num("rs-years")), rate = num("rs-rate");
    const yourMonthly = (salary * yourPct) / 100 / 12;
    const combinedMonthly = (salary * (yourPct + employerPct)) / 100 / 12;

    const yourOnly = futureValue(0, yourMonthly, rate, years);
    const combined = futureValue(0, combinedMonthly, rate, years);

    const t = tokens();
    drawGrowthChart(
      document.getElementById("rs-chart"),
      [yourOnly.series, combined.series],
      [t.slate, t.teal],
      [true, false]
    );
    document.getElementById("rs-legend").innerHTML = `
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.slate};display:inline-block;"></span>Your contribution only</span>
      <span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:2px;background:${t.teal};display:inline-block;"></span>Your + employer/mandatory combined</span>
    `;
    document.getElementById("rs-results").innerHTML = `
      <div>Your contribution alone: <strong>${fmtUsd(yourOnly.finalValue)}</strong></div>
      <div>Combined with employer/mandatory: <strong style="color:var(--teal);">${fmtUsd(combined.finalValue)}</strong></div>
      <div style="color:var(--slate);">The employer/mandatory portion alone is worth ${fmtUsd(combined.finalValue - yourOnly.finalValue)} of that total over ${years} years.</div>
    `;
  }

  document.querySelectorAll("#rs-country-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (chip.dataset.country === currentCountry) return;
      currentCountry = chip.dataset.country;
      document.querySelectorAll("#rs-country-chips .chip").forEach(c => {
        c.classList.toggle("active", c === chip);
        c.setAttribute("aria-pressed", String(c === chip));
      });
      renderFields(COUNTRY_PRESETS[currentCountry]);
      recalc();
    });
  });

  renderFields(COUNTRY_PRESETS[currentCountry]);
  recalc();
})();
