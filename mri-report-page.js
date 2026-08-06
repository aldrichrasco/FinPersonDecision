// Advanced Financial MRI — paywalled report page. Same subscribe/paywall
// flow as chat.js (checks /api/billing/status, shows a "Become a
// supporter" button wired to the real Checkout session), then renders
// whatever /api/mri/report returns (mri_report.py's build_report output).
(function () {
  const content = document.getElementById("mri-content");
  const status = document.getElementById("mri-status");

  function fmtPct(x) {
    return `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
  }

  function renderPaywall() {
    status.hidden = true;
    content.innerHTML = `
      <section class="scenario-card">
        <span class="donate-featured-badge">Supporter</span>
        <h2 style="font-family:var(--font-display);font-weight:500;font-size:20px;margin:10px 0 8px;">See what your practice actually shows</h2>
        <p style="font-size:14.5px;line-height:1.6;margin:0 0 14px;">The quiz, sandbox, and every calculator stay free. This report is the paid part: it pulls together your real turtle-sim rounds and Crypto Impulse Check decisions against your quiz profile, and flags where what you said about yourself and what you've actually done under pressure don't match.</p>
        <button class="btn btn-primary" id="mri-subscribe-btn" type="button">Become a supporter — $5/mo</button>
        <p id="mri-paywall-status" style="font-size:12.5px;color:var(--slate);margin:10px 0 0;"></p>
        <p style="font-size:12.5px;color:var(--slate);margin:14px 0 0;"><a href="pricing.html">See full pricing &rarr;</a></p>
      </section>
    `;
    document.getElementById("mri-subscribe-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const paywallStatus = document.getElementById("mri-paywall-status");
      btn.disabled = true;
      paywallStatus.textContent = "Starting checkout…";
      try {
        const res = await fetch(`${API_BASE_URL}/api/billing/create-checkout-session`, { method: "POST", credentials: "include" });
        if (res.status === 401) {
          paywallStatus.textContent = "Sign in first, then come back to subscribe.";
          btn.disabled = false;
          return;
        }
        if (res.status === 503) {
          paywallStatus.textContent = "Subscriptions aren't set up yet on this deployment.";
          btn.disabled = false;
          return;
        }
        if (!res.ok) throw new Error("checkout failed");
        const data = await res.json();
        window.location.href = data.url;
      } catch (err) {
        paywallStatus.textContent = "Something went wrong — try again in a moment.";
        btn.disabled = false;
      }
    });
  }

  function section(eyebrow, bodyHtml) {
    return `<section class="scenario-card" style="margin-bottom:16px;"><p class="scenario-eyebrow">${eyebrow}</p>${bodyHtml}</section>`;
  }

  function renderReport(report) {
    status.hidden = true;
    const parts = [];

    if (report.self_report) {
      const sr = report.self_report;
      const name = (typeof PERSONAS !== "undefined" && PERSONAS.find(p => p.slug === sr.archetype)?.name) || sr.archetype;
      parts.push(section("Self-report — your quiz profile", `
        <p style="font-size:14.5px;margin:0 0 8px;">Matched archetype: <strong>${name}</strong>${sr.closeness !== null ? ` (${sr.closeness}% close to a typical ${name} profile)` : ""}</p>
      `));
    } else {
      parts.push(section("Self-report", `<p style="font-size:14px;color:var(--slate);margin:0;">No quiz result saved yet — <a href="index.html">take the quiz</a> to unlock this section.</p>`));
    }

    const ts = report.turtle_sim;
    if (ts.sessions > 0) {
      const biasLine = ts.override_direction_bias === null
        ? "Not enough overrides yet to read a direction (needs at least 3)."
        : ts.override_direction_bias > 0
          ? `Your overrides skew toward <strong>more aggressive</strong> calls than the rule (net +${ts.override_direction_bias}).`
          : ts.override_direction_bias < 0
            ? `Your overrides skew toward <strong>more cautious</strong> calls than the rule (net ${ts.override_direction_bias}).`
            : "Your overrides split evenly between more and less aggressive than the rule.";
      parts.push(section("Turtle Trading — real rounds", `
        <p style="font-size:14.5px;line-height:1.7;margin:0;">
          ${ts.sessions} session${ts.sessions === 1 ? "" : "s"}, ${ts.total_overrides} override${ts.total_overrides === 1 ? "" : "s"} of the rule.<br>
          ${biasLine}<br>
          Always following the rule averaged ${fmtPct(ts.avg_rule_equity_pct)}; what you actually did averaged ${fmtPct(ts.avg_player_equity_pct)}
          (beat or matched the rule in ${ts.beat_rule_rate_pct}% of sessions).
        </p>
      `));
    } else {
      parts.push(section("Turtle Trading", `<p style="font-size:14px;color:var(--slate);margin:0;">No saved runs yet — <a href="pro-turtle.html">try a session</a> to unlock this section.</p>`));
    }

    const ci = report.crypto_impulse;
    if (ci.decisions > 0) {
      parts.push(section("Crypto Impulse Check — real decisions", `
        <p style="font-size:14.5px;line-height:1.7;margin:0;">
          ${ci.decisions} real decision${ci.decisions === 1 ? "" : "s"}: ${ci.choice_counts.buy} buy, ${ci.choice_counts.hold} hold, ${ci.choice_counts.sell} sell.<br>
          Average real outcome across them: ${fmtPct(ci.avg_outcome_pct_change)}.
        </p>
      `));
    } else {
      parts.push(section("Crypto Impulse Check", `<p style="font-size:14px;color:var(--slate);margin:0;">No decisions logged yet — <a href="crypto-impulse.html">try a round</a> to unlock this section.</p>`));
    }

    const pv = report.practice_volume;
    parts.push(section("Practice volume", `
      <p style="font-size:14.5px;line-height:1.7;margin:0;">
        ${pv.levels_completed} Roadmap level${pv.levels_completed === 1 ? "" : "s"} completed, ${pv.training_reps} Behavioral Training rep${pv.training_reps === 1 ? "" : "s"} logged
        across ${pv.axes_in_training} ax${pv.axes_in_training === 1 ? "is" : "es"}.
      </p>
    `));

    if (report.revealed_vs_stated_note) {
      parts.push(`
        <section class="scenario-card" style="background:var(--gold-tint);margin-bottom:16px;">
          <p class="scenario-eyebrow" style="color:var(--marigold-ink);">Worth noticing</p>
          <p style="font-size:14.5px;line-height:1.7;margin:0;">${report.revealed_vs_stated_note}</p>
        </section>
      `);
    }

    content.innerHTML = parts.join("");
  }

  async function init() {
    let subscriptionActive = false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/status`, { credentials: "include" });
      const data = await res.json();
      subscriptionActive = data.status === "active" || data.status === "trialing";
    } catch (e) {}

    if (!subscriptionActive) {
      renderPaywall();
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/mri/report`, { credentials: "include" });
      if (!res.ok) throw new Error("report fetch failed");
      const report = await res.json();
      renderReport(report);
    } catch (e) {
      status.textContent = "Couldn't load your report right now — try again in a moment.";
    }
  }

  init();
})();
