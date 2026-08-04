// Crypto Impulse Check — a chained run through a coin's real historical
// BTC/ETH volatility events (crypto.py, real CoinGecko data), oldest
// first. Each round is shown without its outcome, a decision, then the
// real outcome revealed, exactly like before — but now the rounds chain:
// returns compound round to round, tracked against what always following
// the Donchian breakout rule (the same rule turtle-sim.js's simulator
// trades, see pro-turtle-page.js) would have done. The final summary
// reuses turtle-sim's own drawEquityCurves (turtle-chart.js) — the same
// "dashed rule vs. solid you" comparison, now built from real market
// history instead of a synthetic PRNG series.
//
// Deliberately avoids a right/wrong verdict on any single choice — same
// tone as coach.py's DECISION_COACHING mode. A handful of real events
// isn't a backtest with statistical power; the summary says so.
(function () {
  const content = document.getElementById("crypto-content");
  const status = document.getElementById("crypto-status");
  const ticker = document.getElementById("current-price-ticker");
  const breakoutContext = document.getElementById("breakout-context");

  let currentCoin = "bitcoin";
  let currentScenario = null;
  let state = null;

  const COIN_LABEL = { bitcoin: "BTC", ethereum: "ETH" };

  function fmtUsd(n) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function fmtPct(x) {
    return `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
  }

  function fmtEquity(equityMultiplier) {
    const pct = (equityMultiplier - 1) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  async function refreshTicker() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/crypto/price?coin=${currentCoin}`);
      if (!res.ok) { ticker.textContent = ""; return; }
      const data = await res.json();
      ticker.textContent = `${COIN_LABEL[currentCoin]} now: ${fmtUsd(data.usd)}`;
    } catch (e) {
      ticker.textContent = "";
    }
  }

  async function refreshBreakoutStats() {
    if (!breakoutContext) return;
    breakoutContext.textContent = "";
    try {
      const res = await fetch(`${API_BASE_URL}/api/crypto/breakout-stats?coin=${currentCoin}`);
      if (!res.ok) return;
      const s = await res.json();
      if (!s.n_breakouts) return;
      breakoutContext.textContent =
        `Turtle Trading angle: of the last ${s.n_breakouts} real ${COIN_LABEL[currentCoin]} moves that were also a ` +
        `${s.period}-day Donchian breakout (the same rule turtle-sim's simulator trades), price kept moving the ` +
        `same direction over the next 14 days ${s.continuation_rate}% of the time (n=${s.n_breakouts}).`;
    } catch (e) {
      breakoutContext.textContent = "";
    }
  }

  // Entry point: loads the coin's real event roadmap (chronological,
  // oldest first) and starts a fresh chained run at round 1.
  async function loadSession(coin) {
    currentCoin = coin;
    state = { rounds: [], roundIndex: 0, playerEquity: 1, ruleEquity: 1, playerCurve: [1], ruleCurve: [1], overrideCount: 0 };
    status.hidden = false;
    content.innerHTML = "";
    content.appendChild(status);
    refreshTicker();
    refreshBreakoutStats();

    try {
      const res = await fetch(`${API_BASE_URL}/api/crypto/session-events?coin=${coin}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        renderError(err.error || "Couldn't load real events right now.");
        return;
      }
      const data = await res.json();
      state.rounds = data.rounds;
      loadRound(0);
    } catch (e) {
      renderError("Couldn't reach the price data right now.");
    }
  }

  async function loadRound(index) {
    state.roundIndex = index;
    status.hidden = false;
    content.innerHTML = "";
    content.appendChild(status);

    try {
      const eventTimestamp = state.rounds[index].event_timestamp;
      const res = await fetch(`${API_BASE_URL}/api/crypto/scenario?coin=${currentCoin}&event_timestamp=${eventTimestamp}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        renderError(err.error || "Couldn't load this round right now.");
        return;
      }
      currentScenario = await res.json();
      renderScenario();
    } catch (e) {
      renderError("Couldn't reach the price data right now.");
    }
  }

  function renderError(message) {
    status.hidden = true;
    content.innerHTML = `<p class="scenario-empty-body">${esc(message)} <button class="linkish" id="retry-btn" type="button">Try again</button></p>`;
    document.getElementById("retry-btn")?.addEventListener("click", () => loadSession(currentCoin));
  }

  function breakoutBadge(signal, period) {
    if (signal !== "buy" && signal !== "sell") return "";
    const dir = signal === "buy" ? "upside" : "downside";
    return `<p class="scenario-text" style="font-size:13px;color:var(--slate);">
      This was also a real ${period}-day Donchian breakout to the ${dir} — the same signal turtle-sim's rule trades on.
    </p>`;
  }

  function ruleLine(signal) {
    if (signal !== "buy" && signal !== "sell") return "";
    const label = signal === "buy" ? "BUY" : "SELL";
    return `<p class="scenario-text" style="font-size:13px;color:var(--slate);">
      The Donchian rule here says: <strong>${label}</strong>. Your choice below can follow it or override it.
    </p>`;
  }

  function renderScenario() {
    status.hidden = true;
    const s = currentScenario;
    const verb = s.direction === "drop" ? "dropped" : "spiked";
    const total = state.rounds.length;
    content.innerHTML = `
      <p class="scenario-eyebrow" style="margin-bottom:2px;">Round ${state.roundIndex + 1} of ${total}</p>
      <section class="scenario-card" id="scenario-card">
        <p class="scenario-eyebrow">${COIN_LABEL[s.coin]} · ${fmtDate(s.event_timestamp)}</p>
        <p class="scenario-text">
          ${COIN_LABEL[s.coin]} just ${verb} ${Math.abs(s.pct_change)}% in a single day, landing at ${fmtUsd(s.price_at_event)}.
          This actually happened. You don't know yet what it did next.
        </p>
        ${breakoutBadge(s.breakout_signal, s.breakout_period)}
        ${ruleLine(s.breakout_signal)}
        <canvas id="price-chart" width="760" height="180" style="width:100%;max-width:100%;height:180px;display:block;margin:14px 0;"></canvas>
        <div class="scenario-choices">
          <button class="choice-btn" data-choice="buy">
            <span class="choice-body"><span class="choice-text">Buy more</span><span class="choice-tag">Lean into the move</span></span>
          </button>
          <button class="choice-btn" data-choice="hold">
            <span class="choice-body"><span class="choice-text">Hold</span><span class="choice-tag">Do nothing</span></span>
          </button>
          <button class="choice-btn" data-choice="sell">
            <span class="choice-body"><span class="choice-text">Sell</span><span class="choice-tag">Get out</span></span>
          </button>
        </div>
      </section>
    `;
    drawPricePath(s.lead_in, null);
    content.querySelectorAll(".choice-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        content.querySelectorAll(".choice-btn").forEach(b => { b.disabled = true; });
        btn.classList.add("choice-pressed");
        submitDecision(btn.dataset.choice);
      });
    });
  }

  async function submitDecision(choice) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/crypto/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin: currentScenario.coin,
          event_timestamp: currentScenario.event_timestamp,
          choice,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        renderError(err.error || "Couldn't record that right now.");
        return;
      }
      const result = await res.json();
      renderReveal(choice, result);
    } catch (e) {
      renderError("Couldn't reach the server right now.");
    }
  }

  function renderReveal(choice, result) {
    if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete("crypto-impulse");
    if (typeof markTrainingRep === "function") markTrainingRep("crypto-impulse");
    if (choice !== result.breakout_signal) state.overrideCount += 1;
    state.playerEquity *= 1 + result.player_return_pct / 100;
    state.ruleEquity *= 1 + result.rule_return_pct / 100;
    state.playerCurve.push(state.playerEquity);
    state.ruleCurve.push(state.ruleEquity);

    const outcomeUp = result.outcome_pct_change > 0;
    const outcomeText = `Over the next ${result.outcome.length} days, ${COIN_LABEL[result.coin]} moved ${outcomeUp ? "up" : "down"} another ${Math.abs(result.outcome_pct_change)}%.`;
    const isLastRound = state.roundIndex + 1 >= state.rounds.length;

    const card = document.getElementById("scenario-card");
    const framing = framingFor(choice, result);
    const breakoutOutcome = breakoutOutcomeText(result);
    card.insertAdjacentHTML("beforeend", `
      <div class="scenario-eyebrow" style="margin-top:18px;">What actually happened</div>
      <p class="scenario-text">${outcomeText}</p>
      <p class="scenario-text" style="color:var(--slate);font-size:14px;">${framing}</p>
      ${breakoutOutcome}
      <p class="scenario-text" style="font-family:var(--font-mono);font-size:13px;">
        Round return: you ${fmtPct(result.player_return_pct)} &middot; rule ${fmtPct(result.rule_return_pct)}
      </p>
      <p class="scenario-text" style="font-family:var(--font-mono);font-size:13px;color:var(--slate);">
        Running total: you ${fmtEquity(state.playerEquity)} &middot; always-follow-the-rule ${fmtEquity(state.ruleEquity)}
      </p>
      <button class="btn btn-primary" id="next-round-btn">${isLastRound ? "See summary" : "Next round"}</button>
    `);
    drawPricePath(currentScenario.lead_in, result.outcome);
    document.getElementById("next-round-btn").addEventListener("click", () => {
      if (isLastRound) renderSummary();
      else loadRound(state.roundIndex + 1);
    });
  }

  function renderSummary() {
    if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete("full-crypto-session");
    if (typeof markTrainingRep === "function") markTrainingRep("full-crypto-session");
    status.hidden = true;
    const total = state.rounds.length;
    const helped = state.playerEquity >= state.ruleEquity;
    content.innerHTML = `
      <section class="scenario-card">
        <p class="scenario-eyebrow">Run complete — ${COIN_LABEL[currentCoin]}</p>
        <h2 style="font-family:var(--font-display);font-weight:500;font-size:22px;margin:4px 0 12px;">
          ${state.overrideCount} override${state.overrideCount === 1 ? "" : "s"} out of ${total} round${total === 1 ? "" : "s"}
        </h2>
        <canvas id="crypto-equity-chart" style="width:100%;display:block;"></canvas>
        <p class="scenario-text" style="font-family:var(--font-mono);margin-top:14px;">
          Always following the rule: <strong>${fmtEquity(state.ruleEquity)}</strong>
        </p>
        <p class="scenario-text" style="font-family:var(--font-mono);">
          You: <strong style="color:${helped ? "var(--teal)" : "var(--brick)"};">${fmtEquity(state.playerEquity)}</strong>
        </p>
        <p class="scenario-text" style="font-size:13px;color:var(--slate);">
          Dashed line: always following the Donchian rule. Solid line: what you actually did.
          ${total} real event${total === 1 ? "" : "s"} is a single run, not a backtest with statistical power —
          this shows what compounding your own choices looked like this time, not what to expect next time.
        </p>
        <button class="btn btn-secondary reroll-btn" id="reroll-btn">Run it again</button>
      </section>
    `;
    drawEquityCurves(document.getElementById("crypto-equity-chart"), state.ruleCurve, state.playerCurve);
    document.getElementById("reroll-btn").addEventListener("click", () => loadSession(currentCoin));
  }

  // Deliberately no "you were right/wrong" verdict — see this file's
  // header comment. Only references the person's own saved axis scores
  // (never raw model vocabulary — same translation-layer rule PAPER.md
  // §7.8 states for the rest of the app) when a profile actually exists.
  function framingFor(choice, result) {
    const action = choice === "buy" ? "buying into" : choice === "sell" ? "selling out of" : "holding through";
    let line = `${action[0].toUpperCase()}${action.slice(1)} a sudden ${result.direction} is one real, immediate reaction — this single instance doesn't prove it's the right one to repeat.`;

    const saved = typeof getProfile === "function" ? getProfile() : null;
    if (saved && saved.profile) {
      const impulse = saved.profile.impulse_regulation;
      const risk = saved.profile.risk_disposition;
      if (typeof impulse === "number" && choice !== "hold") {
        if (impulse <= 40) {
          line += " Your own quiz profile reads toward the impulsive end on impulse regulation — worth noticing whether this reaction matched your usual pace, or was faster.";
        } else if (impulse >= 66) {
          line += " Your own quiz profile reads toward the deliberate end on impulse regulation — worth noticing whether this reaction matched that, or broke from it.";
        }
      }
      if (typeof risk === "number" && choice === "buy" && result.direction === "drop") {
        if (risk <= 40) {
          line += " Buying into a drop leans further into risk than a risk-averse profile typically would — not wrong, just worth being aware of.";
        }
      }
    }
    return line;
  }

  // Ties this one instance back to the aggregate rate in #breakout-context
  // — one breakout continuing or reversing doesn't confirm or refute that
  // rate, same "one data point" caveat as framingFor above.
  function breakoutOutcomeText(result) {
    if (result.breakout_signal !== "buy" && result.breakout_signal !== "sell") return "";
    const dir = result.breakout_signal === "buy" ? "upside" : "downside";
    const verdict = result.breakout_continued ? "continued in that direction" : "reversed instead";
    return `<p class="scenario-text" style="font-size:13px;color:var(--slate);">
      This was also a real ${result.breakout_period}-day breakout to the ${dir} — this particular one ${verdict}
      over the following ${result.outcome.length} days.
    </p>`;
  }

  // Same technique as dashboard.js's drawNetWorthChart: device-pixel-ratio
  // aware, palette pulled from CSS custom properties, no charting library.
  function drawPricePath(leadIn, outcome) {
    const canvas = document.getElementById("price-chart");
    if (!canvas) return;
    const width = canvas.clientWidth || 760, height = 180, dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr; canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const all = outcome ? leadIn.concat(outcome) : leadIn;
    const prices = all.map(p => p.price);
    const low = Math.min(...prices), spread = Math.max(1, Math.max(...prices) - low);
    const pad = { top: 16, right: 12, bottom: 24, left: 12 };
    const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
    const xFor = i => pad.left + (all.length === 1 ? plotW / 2 : (i / (all.length - 1)) * plotW);
    const yFor = value => pad.top + plotH - ((value - low) / spread) * plotH;

    const css = getComputedStyle(document.body);
    const teal = css.getPropertyValue("--teal").trim() || "#0B4A44";
    const marigold = css.getPropertyValue("--marigold").trim() || "#B5860B";
    const slate = css.getPropertyValue("--slate").trim() || "#5B5E66";
    const line = css.getPropertyValue("--line").trim() || "rgba(18,25,46,.14)";

    ctx.strokeStyle = line;
    ctx.beginPath(); ctx.moveTo(pad.left, height - pad.bottom + .5); ctx.lineTo(width - pad.right, height - pad.bottom + .5); ctx.stroke();

    // Lead-in: solid teal.
    ctx.strokeStyle = teal; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    ctx.beginPath();
    leadIn.forEach((p, i) => i ? ctx.lineTo(xFor(i), yFor(p.price)) : ctx.moveTo(xFor(i), yFor(p.price)));
    ctx.stroke();

    // Event-day marker.
    const eventIdx = leadIn.length - 1;
    ctx.fillStyle = marigold;
    ctx.beginPath(); ctx.arc(xFor(eventIdx), yFor(leadIn[eventIdx].price), 4.5, 0, Math.PI * 2); ctx.fill();

    if (outcome && outcome.length) {
      // Outcome: dashed slate, continuing from the event point.
      ctx.strokeStyle = slate; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(xFor(eventIdx), yFor(leadIn[eventIdx].price));
      outcome.forEach((p, i) => ctx.lineTo(xFor(eventIdx + 1 + i), yFor(p.price)));
      ctx.stroke();
      ctx.setLineDash([]);
      const last = outcome[outcome.length - 1];
      ctx.fillStyle = slate;
      ctx.beginPath(); ctx.arc(xFor(all.length - 1), yFor(last.price), 4, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = slate; ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.fillText(fmtUsd(leadIn[0].price), pad.left, height - 7);
    const endLabel = fmtUsd(all[all.length - 1].price);
    ctx.fillText(endLabel, Math.max(pad.left, width - pad.right - ctx.measureText(endLabel).width), height - 7);
  }

  document.querySelectorAll("#coin-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (chip.dataset.coin === currentCoin) return;
      document.querySelectorAll("#coin-chips .chip").forEach(c => {
        c.classList.toggle("active", c === chip);
        c.setAttribute("aria-pressed", String(c === chip));
      });
      loadSession(chip.dataset.coin);
    });
  });

  loadSession(currentCoin);
})();
