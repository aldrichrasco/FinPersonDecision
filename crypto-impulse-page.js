// Crypto Impulse Check — a real historical BTC/ETH volatility event
// (crypto.py, real CoinGecko data) shown without its outcome, a decision,
// then the real outcome revealed. Deliberately avoids a right/wrong
// verdict on the choice itself, same tone as coach.py's DECISION_COACHING
// mode ("no correct answer, just a trade-off") — a single historical
// instance doesn't validate or invalidate a strategy, and framing it that
// way would be dishonest about what one data point can actually tell you.
(function () {
  const content = document.getElementById("crypto-content");
  const status = document.getElementById("crypto-status");
  const ticker = document.getElementById("current-price-ticker");

  let currentCoin = "bitcoin";
  let currentScenario = null;
  let revealed = false;

  const COIN_LABEL = { bitcoin: "BTC", ethereum: "ETH" };

  function fmtUsd(n) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

  async function loadScenario(coin) {
    currentCoin = coin;
    revealed = false;
    status.hidden = false;
    content.innerHTML = "";
    content.appendChild(status);
    refreshTicker();

    try {
      const res = await fetch(`${API_BASE_URL}/api/crypto/scenario?coin=${coin}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        renderError(err.error || "Couldn't load a scenario right now.");
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
    document.getElementById("retry-btn")?.addEventListener("click", () => loadScenario(currentCoin));
  }

  function renderScenario() {
    status.hidden = true;
    const s = currentScenario;
    const verb = s.direction === "drop" ? "dropped" : "spiked";
    content.innerHTML = `
      <section class="scenario-card" id="scenario-card">
        <p class="scenario-eyebrow">${COIN_LABEL[s.coin]} · ${fmtDate(s.event_timestamp)}</p>
        <p class="scenario-text">
          ${COIN_LABEL[s.coin]} just ${verb} ${Math.abs(s.pct_change)}% in a single day, landing at ${fmtUsd(s.price_at_event)}.
          This actually happened. You don't know yet what it did next.
        </p>
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
    revealed = true;
    const outcomeUp = result.outcome_pct_change > 0;
    const outcomeText = `Over the next ${result.outcome.length} days, ${COIN_LABEL[result.coin]} moved ${outcomeUp ? "up" : "down"} another ${Math.abs(result.outcome_pct_change)}%.`;

    const card = document.getElementById("scenario-card");
    const framing = framingFor(choice, result);
    card.insertAdjacentHTML("beforeend", `
      <div class="scenario-eyebrow" style="margin-top:18px;">What actually happened</div>
      <p class="scenario-text">${outcomeText}</p>
      <p class="scenario-text" style="color:var(--slate);font-size:14px;">${framing}</p>
      <button class="btn btn-secondary reroll-btn" id="reroll-btn">Try another moment</button>
    `);
    drawPricePath(currentScenario.lead_in, result.outcome);
    document.getElementById("reroll-btn").addEventListener("click", () => loadScenario(currentCoin));
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
      loadScenario(chip.dataset.coin);
    });
  });

  loadScenario(currentCoin);
})();
