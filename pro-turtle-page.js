// FinPerson Pro — Turtle Trading simulation page. Gated behind an active
// subscription (checked via the existing /api/billing/status, unused until
// now) — same "content.innerHTML = upsell; return;" idiom progress-page.js
// uses for "you haven't taken the quiz yet", just gating on subscription
// status instead of quiz completion.
(function () {
  const content = document.getElementById("pro-turtle-content");
  const ROUNDS = 15;
  const PERIOD = 10;

  function renderUpsell() {
    content.innerHTML = `
      <span class="pro-badge">FinPerson Pro</span>
      <h2 style="font-family:var(--font-display);font-weight:500;font-size:22px;margin:0 0 10px;color:var(--pro-ink);">This is the paid part</h2>
      <p style="font-size:15px;line-height:1.6;color:var(--pro-ink);margin:0 0 8px;">The <a href="pro-investors.html" style="color:var(--pro-accent);">investor-style quiz</a> is free. This simulation — and your results history — needs an active subscription.</p>
      <p class="pro-footer-note" style="margin:0 0 20px;">Stripe handles the card. FinPerson never sees or stores it.</p>
      <button class="pro-btn" id="pro-turtle-subscribe" type="button">Start subscription</button>
      <p class="pro-mono" id="pro-turtle-upsell-status" style="color:var(--pro-muted);font-size:13px;margin-top:12px;"></p>
    `;
    const status = document.getElementById("pro-turtle-upsell-status");
    document.getElementById("pro-turtle-subscribe").addEventListener("click", async (e) => {
      e.target.disabled = true;
      status.textContent = "Starting checkout…";
      try {
        const res = await fetch("/api/billing/create-checkout-session", { method: "POST", credentials: "include" });
        if (res.status === 401) {
          status.textContent = "Sign in first, then come back to subscribe.";
          e.target.disabled = false;
          return;
        }
        if (res.status === 503) {
          status.textContent = "Subscriptions aren't set up yet on this deployment.";
          e.target.disabled = false;
          return;
        }
        if (!res.ok) throw new Error("checkout failed");
        const data = await res.json();
        window.location.href = data.url;
      } catch (err) {
        status.textContent = "Something went wrong — try again in a moment.";
        e.target.disabled = false;
      }
    });
  }

  function fmtPct(x) {
    const pct = x * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }
  function fmtEquity(x) {
    return `${((x - 1) * 100 >= 0 ? "+" : "")}${((x - 1) * 100).toFixed(1)}%`;
  }

  function runGame() {
    const state = {
      prices: generatePriceSeries(PERIOD + ROUNDS + 1),
      round: 0,
      ruleEquity: 1,
      playerEquity: 1,
      ruleCurve: [1],
      playerCurve: [1],
      overrideCount: 0,
      rounds: [],
      overrideOpen: false,
    };

    function renderRound() {
      const index = PERIOD + state.round;
      const signal = donchianSignal(state.prices, index, PERIOD);
      const signalLabel = { buy: "BUY", sell: "SELL", hold: "HOLD" }[signal];
      const signalColor = signal === "buy" ? "var(--pro-good)" : signal === "sell" ? "var(--pro-bad)" : "var(--pro-muted)";

      content.innerHTML = `
        <p class="pro-mono" style="color:var(--pro-muted);font-size:12px;margin:0 0 10px;">Round ${state.round + 1} of ${ROUNDS}</p>
        <canvas id="pro-turtle-price-chart" style="width:100%;display:block;"></canvas>
        <p style="font-size:15px;margin:14px 0 6px;color:var(--pro-ink);">The system's Donchian rule says: <strong class="pro-mono" style="color:${signalColor};">${signalLabel}</strong></p>
        <button class="pro-btn" id="pro-turtle-follow" type="button">Follow the system &rarr; ${signalLabel}</button>
        <button class="pro-btn pro-btn-secondary" id="pro-turtle-override-toggle" type="button" style="margin-left:8px;">Override with my own call</button>
        <div id="pro-turtle-override-options" style="display:none;margin-top:12px;gap:8px;flex-wrap:wrap;"></div>
      `;
      const canvas = document.getElementById("pro-turtle-price-chart");
      drawTurtleChart(canvas, state.prices, index, signal);

      document.getElementById("pro-turtle-follow").addEventListener("click", () => resolveAndAdvance(signal, signal));

      const overrideToggle = document.getElementById("pro-turtle-override-toggle");
      const overrideBox = document.getElementById("pro-turtle-override-options");
      overrideToggle.addEventListener("click", () => {
        overrideBox.style.display = "flex";
        overrideBox.innerHTML = ["buy", "sell", "hold"].map(a =>
          `<button class="pro-btn pro-btn-secondary" data-action="${a}" type="button">${a.toUpperCase()}</button>`
        ).join("");
        overrideBox.querySelectorAll("[data-action]").forEach(btn => {
          btn.addEventListener("click", () => resolveAndAdvance(btn.dataset.action, signal));
        });
      });
    }

    function resolveAndAdvance(playerAction, signal) {
      const index = PERIOD + state.round;
      const round = resolveRound(state.prices, index, PERIOD, playerAction);
      state.ruleEquity *= 1 + round.ruleReturnPct;
      state.playerEquity *= 1 + round.playerReturnPct;
      state.ruleCurve.push(state.ruleEquity);
      state.playerCurve.push(state.playerEquity);
      if (round.overridden) state.overrideCount += 1;
      state.rounds.push(round);
      renderOutcome(round);
    }

    function renderOutcome(round) {
      content.innerHTML = `
        <p class="pro-mono" style="color:var(--pro-muted);font-size:12px;margin:0 0 10px;">Round ${state.round + 1} of ${ROUNDS} — outcome</p>
        <p style="font-size:15px;color:var(--pro-ink);margin:0 0 6px;">
          ${round.overridden
            ? `You overrode the ${round.signal.toUpperCase()} signal with ${round.playerAction.toUpperCase()}.`
            : `You followed the system's ${round.signal.toUpperCase()} call.`}
        </p>
        <p class="pro-mono" style="font-size:14px;color:var(--pro-ink);">
          Rule return: <strong>${fmtPct(round.ruleReturnPct)}</strong> &nbsp;·&nbsp;
          Your return: <strong style="color:${round.playerReturnPct >= round.ruleReturnPct ? 'var(--pro-good)' : 'var(--pro-bad)'};">${fmtPct(round.playerReturnPct)}</strong>
        </p>
        <canvas id="pro-turtle-equity-chart" style="width:100%;display:block;margin-top:14px;"></canvas>
        <p class="pro-footer-note" style="margin-top:8px;">Dashed line: always following the rule. Solid line: what you actually did.</p>
        <button class="pro-btn" id="pro-turtle-next" type="button" style="margin-top:14px;">
          ${state.round + 1 < ROUNDS ? "Next round" : "See results"}
        </button>
      `;
      drawEquityCurves(document.getElementById("pro-turtle-equity-chart"), state.ruleCurve, state.playerCurve);
      document.getElementById("pro-turtle-next").addEventListener("click", () => {
        state.round += 1;
        if (state.round < ROUNDS) renderRound();
        else renderSummary();
      });
    }

    function renderSummary() {
      const helped = state.playerEquity >= state.ruleEquity;
      content.innerHTML = `
        <span class="pro-badge">Run complete</span>
        <h2 style="font-family:var(--font-display);font-weight:500;font-size:22px;margin:0 0 12px;color:var(--pro-ink);">${state.overrideCount} override${state.overrideCount === 1 ? "" : "s"} out of ${ROUNDS} rounds</h2>
        <canvas id="pro-turtle-final-chart" style="width:100%;display:block;"></canvas>
        <p class="pro-mono" style="font-size:15px;color:var(--pro-ink);margin:16px 0 4px;">
          Rule (if always followed): <strong>${fmtEquity(state.ruleEquity)}</strong>
        </p>
        <p class="pro-mono" style="font-size:15px;color:var(--pro-ink);margin:0 0 14px;">
          You: <strong style="color:${helped ? 'var(--pro-good)' : 'var(--pro-bad)'};">${fmtEquity(state.playerEquity)}</strong>
        </p>
        <p style="font-size:14.5px;line-height:1.6;color:var(--pro-ink);">
          ${state.overrideCount === 0
            ? "You never overrode the system. That's the entire discipline the original Turtles were trained on — the rule doesn't have to feel right every time to be worth following."
            : helped
              ? "Your overrides came out ahead of the rule this run — but a single 15-round run is a small sample. The research on this doesn't favor discretion over systems as a rule."
              : "Your overrides cost you relative to just following the rule — a small-scale version of what Barber &amp; Odean found at scale: individual investors who trade on discretion tend to underperform a disciplined, lower-turnover approach."}
        </p>
        <p class="pro-footer-note" style="margin-top:10px;">Barber &amp; Odean, "Trading Is Hazardous to Your Wealth" (2000), on overconfident/overtrading investors underperforming systematic buy-and-hold. Curtis Faith, "Way of the Turtle" (2007), on the original 1983 experiment this simulation is modeled on.</p>
        <button class="pro-btn" id="pro-turtle-again" type="button" style="margin-top:16px;">Run it again</button>
        <p class="pro-mono" id="pro-turtle-save-status" style="color:var(--pro-muted);font-size:13px;margin-top:10px;"></p>
      `;
      drawEquityCurves(document.getElementById("pro-turtle-final-chart"), state.ruleCurve, state.playerCurve);
      document.getElementById("pro-turtle-again").addEventListener("click", runGame);

      const saveStatus = document.getElementById("pro-turtle-save-status");
      fetch("/api/turtle/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rounds: state.rounds,
          final_rule_equity: state.ruleEquity,
          final_player_equity: state.playerEquity,
          override_count: state.overrideCount,
        }),
      }).then(r => { if (r.ok) saveStatus.textContent = "Saved to your results history."; })
        .catch(() => {});
    }

    renderRound();
  }

  (async () => {
    let active = false;
    try {
      const res = await fetch("/api/billing/status", { credentials: "include" });
      const data = await res.json();
      active = data.status === "active" || data.status === "trialing";
    } catch (e) {}
    if (active) runGame();
    else renderUpsell();
  })();
})();
