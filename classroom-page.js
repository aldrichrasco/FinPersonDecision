// The Classroom — real economics games played against simulated
// "classmates" whose behavior is parametrized by their archetype's actual
// existing risk_disposition/prosocial_orientation scores (same data the
// rest of the app uses). Each game pairs a rational-equilibrium prediction
// against the well-documented real finding, so the gap between them is the
// lesson, not a score to optimize.
(function () {
  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }
  function archetypeOptionsHtml(selected) {
    return PERSONAS.map(p => `<option value="${esc(p.slug)}"${p.slug === selected ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  }
  function portraitChip(slug, size) {
    const p = PERSONAS.find(x => x.slug === slug);
    return `<div class="report-portrait" style="width:${size}px;height:${size}px;flex-shrink:0;">${archetypePortraitSvg(p.slug, p.group)}</div>`;
  }

  // Optional, self-declared grouping key (e.g. a teacher's class code) —
  // still anonymous, just narrows "what everyone else has done" from the
  // whole internet down to one class. Persisted so it survives switching
  // games/tabs within the same browser.
  const COHORT_STORAGE_KEY = "finperson_cohort";
  function getCohort() {
    try {
      return (localStorage.getItem(COHORT_STORAGE_KEY) || "").trim() || null;
    } catch (e) {
      return null;
    }
  }

  // Anonymous by construction — no user identity is sent. This is what
  // turns solo play into real cross-player data: enough people playing the
  // same game against simulated opponents still generates genuine human
  // variance worth comparing, even without a live second player.
  function logPlay(game, role, archetype, detail) {
    fetch("/api/classroom-play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, role, archetype, detail, cohort: getCohort() }),
    }).catch(() => {});
  }

  function analyticsSectionHtml(game) {
    const cohort = getCohort();
    const qs = cohort ? `game=${game}&cohort=${encodeURIComponent(cohort)}` : `game=${game}`;
    return `
      <section class="report-section" id="classroom-analytics-${game}">
        <p class="chart-title">${cohort ? `What your class (${esc(cohort)}) has done` : "What everyone else has done"}</p>
        <p class="scenario-empty-body" id="classroom-analytics-body-${game}">Loading results from other plays&hellip;</p>
        <p class="report-body" style="margin-top:10px;">
          <a href="/api/classroom-stats?${qs}&amp;format=csv" id="classroom-download-${game}">Download the raw data (CSV) &rarr;</a>
        </p>
      </section>`;
  }

  const ANALYTICS_FORMATTERS = {
    trust: s => s.count
      ? `Across ${s.count} play${s.count === 1 ? "" : "s"}: average amount sent was ${fmt(s.avg_sent)}, and trustees returned an average of ${s.avg_return_pct}% of the pool.`
      : "No plays recorded yet — be the first.",
    ultimatum: s => s.count
      ? `Across ${s.count} play${s.count === 1 ? "" : "s"}: the average offer was ${s.avg_offer_pct}% of the pot, and ${s.rejection_rate_pct}% of offers were rejected.`
      : "No plays recorded yet — be the first.",
    goods: s => s.count
      ? `Across ${s.count} completed game${s.count === 1 ? "" : "s"}: round-1 group contributions averaged ${fmt(s.avg_first_round_total)}, dropping to ${fmt(s.avg_last_round_total)} by the final round.`
      : "No completed games recorded yet — be the first.",
  };

  function loadAnalytics(game) {
    const bodyEl = document.getElementById(`classroom-analytics-body-${game}`);
    if (!bodyEl) return;
    const cohort = getCohort();
    const qs = cohort ? `game=${game}&cohort=${encodeURIComponent(cohort)}` : `game=${game}`;
    fetch(`/api/classroom-stats?${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(stats => { bodyEl.textContent = ANALYTICS_FORMATTERS[game](stats); })
      .catch(() => { bodyEl.textContent = "Couldn't load results right now."; });
  }

  // Each game is a revealed-preference probe for exactly one FBM axis (see
  // AXES/ARCHETYPE_PROFILES in fbm.js) — the same rubric the onboarding quiz
  // scores. The quiz only ever runs once and just captures a starting point;
  // a single game result is real behavioral evidence too, so it can nudge
  // that one axis a small, capped amount. This is deliberately NOT a re-quiz:
  // no persona switch, no big swing off one play — just a tentative signal,
  // same shape as the quiz's own `delta` mechanic in quiz.js. If the visitor
  // has no saved profile yet (hasn't taken the quiz), there's nothing to
  // nudge and this silently no-ops rather than fabricating one from a game.
  function nudgeAxis(axis, rawDelta, source) {
    if (typeof getProfile !== "function" || typeof saveProfile !== "function") return null;
    const saved = getProfile();
    if (!saved || !saved.profile) return null;
    const delta = Math.max(-4, Math.min(4, Math.round(rawDelta)));
    if (!delta) return null;
    const profile = { ...saved.profile };
    profile[axis] = clamp01to100((profile[axis] ?? 50) + delta);
    const archetype = matchArchetype(profile);
    const capability = capabilityIndex(profile);
    saveProfile(profile, archetype, capability);
    if (typeof logProfileNudge === "function") logProfileNudge(axis, delta, source);
    return { axis, delta, value: profile[axis] };
  }

  function nudgeNoteHtml(nudge) {
    if (!nudge) return "";
    const a = AXES[nudge.axis];
    const sign = nudge.delta >= 0 ? "+" : "";
    return `<p class="report-meta" style="margin-top:10px;">Based on this play, your <strong>${esc(a.label)}</strong> nudged ${sign}${nudge.delta} (tentative — one game, not a full re-test).</p>`;
  }

  // Short "what am I about to play" primer shown above each game's setup
  // screen — separate from the mechanics explainer that already lives in
  // each setup screen, this is about *why the game exists* before you touch
  // any controls.
  const GAME_INTROS = {
    trust: {
      title: "The Trust Game",
      cite: "Berg, Dickhaut &amp; McCabe (1995)",
      bullets: [
        "Tests whether strangers trust each other with money — and whether that trust gets honored.",
        "Whatever the Investor sends triples in transit, so trust can literally create wealth for both sides.",
        "Purely rational play sends and returns $0. Real players usually don't.",
      ],
    },
    goods: {
      title: "The Public Goods Game",
      cite: "Isaac &amp; Walker (1988); Fehr &amp; G&auml;chter (2000)",
      bullets: [
        "Tests whether people cooperate for a shared payoff when free-riding pays better individually.",
        "Every dollar contributed doubles and splits evenly — the group always gains, but each contributor personally loses money by giving.",
        "Purely rational play contributes $0 every round. Real groups start out moderate and decay as free-riding is noticed.",
      ],
    },
    ultimatum: {
      title: "The Ultimatum Game",
      cite: "G&uuml;th, Schmittberger &amp; Schwarze (1982)",
      bullets: [
        "Tests whether fairness beats profit — for both the person offering and the person deciding.",
        "The Responder can reject any offer, destroying the entire pot for both sides — a real cost to punish unfairness.",
        "Purely rational play offers next-to-nothing and accepts anything above $0. Real responders reject low offers often.",
      ],
    },
  };

  function gameIntroHtml(game) {
    const info = GAME_INTROS[game];
    return `
      <section class="report-section report-support" style="text-align:left;margin-bottom:18px;">
        <p class="chart-title">${esc(info.title)}</p>
        <ul class="report-list">${info.bullets.map(b => `<li>${b}</li>`).join("")}</ul>
        <p class="report-meta" style="margin-top:10px;">${info.cite}</p>
      </section>`;
  }

  // ============================================================ Trust Game
  // Berg, Dickhaut & McCabe (1995). Investor sends part of $10, it triples,
  // Trustee decides how much to send back. Backward induction says both
  // amounts are $0; real players consistently send and return real money.
  const TrustGame = (function () {
    const content = document.getElementById("classroom-content");
    const ENDOWMENT = 10;
    const MULTIPLIER = 3;
    let state = { archetype: null, role: "investor", sent: null, returned: null };

    function sendFraction(profile) {
      return Math.max(0, Math.min(0.9, 0.15 + (profile.risk_disposition / 100) * 0.25 + (profile.prosocial_orientation / 100) * 0.35));
    }
    function returnFraction(profile) {
      return Math.max(0, Math.min(0.9, 0.15 + (profile.prosocial_orientation / 100) * 0.45));
    }

    function renderSetup() {
      content.innerHTML = `
        ${gameIntroHtml("trust")}
        <section class="report-section" style="border-top:0;padding-top:0;">
          <p class="chart-title">Set up the game</p>
          <div class="dash-setup-row" style="margin-bottom:14px;">
            <span class="dash-label">Play against</span>
            <select id="classroom-opponent" class="goal-input" style="max-width:280px;">${archetypeOptionsHtml(state.archetype)}</select>
          </div>
          <div class="dash-setup-row" style="margin-bottom:18px;">
            <span class="dash-label">Your role</span>
            <div class="chip-row">
              <button class="chip${state.role === "investor" ? " active" : ""}" data-role="investor" type="button">Investor</button>
              <button class="chip${state.role === "trustee" ? " active" : ""}" data-role="trustee" type="button">Trustee</button>
            </div>
          </div>
          <p class="report-body" id="classroom-role-explainer" style="font-size:13.5px;color:var(--slate);"></p>
          <button class="btn btn-primary" id="classroom-start" type="button">Start round</button>
        </section>
      `;
      const roleExplainer = document.getElementById("classroom-role-explainer");
      function updateExplainer() {
        roleExplainer.textContent = state.role === "investor"
          ? `As Investor, you start with $${ENDOWMENT}. Whatever you send to the Trustee gets tripled before they receive it — then they decide how much, if any, to send back.`
          : `As Trustee, your opponent starts with $${ENDOWMENT} and decides how much to send you (it triples on the way). You then decide how much of what you received to send back.`;
      }
      updateExplainer();
      content.querySelectorAll("[data-role]").forEach(btn => {
        btn.addEventListener("click", () => {
          state.role = btn.dataset.role;
          content.querySelectorAll("[data-role]").forEach(b => b.classList.toggle("active", b === btn));
          updateExplainer();
        });
      });
      document.getElementById("classroom-start").addEventListener("click", () => {
        state.archetype = document.getElementById("classroom-opponent").value;
        state.sent = null;
        state.returned = null;
        if (state.role === "investor") renderInvestorChoice();
        else renderTrusteeWaiting();
      });
    }

    function opponentHeader() {
      const p = PERSONAS.find(x => x.slug === state.archetype);
      return `
        <div class="report-header" style="border-bottom:0;padding-bottom:0;">
          ${portraitChip(p.slug, 52)}
          <div><p class="report-meta" style="margin:0;">Playing against</p><h3 style="margin:0;font-family:var(--font-display);font-weight:500;">${esc(p.name)}</h3></div>
        </div>`;
    }

    function renderInvestorChoice() {
      content.innerHTML = `
        ${opponentHeader()}
        <section class="report-section" style="padding-top:16px;">
          <p class="chart-title">How much do you send?</p>
          <p class="report-body">You have $${ENDOWMENT}. Whatever you send gets tripled before your opponent decides how much to return.</p>
          <input type="range" id="classroom-send-slider" min="0" max="${ENDOWMENT}" step="1" value="5" style="width:100%;max-width:400px;">
          <p class="report-clevel-badge" id="classroom-send-value" style="margin-top:10px;">$5</p>
          <button class="btn btn-primary" id="classroom-send-confirm" type="button" style="display:block;margin-top:10px;">Send it</button>
        </section>
      `;
      const slider = document.getElementById("classroom-send-slider");
      const valueEl = document.getElementById("classroom-send-value");
      slider.addEventListener("input", () => { valueEl.textContent = fmt(Number(slider.value)); });
      document.getElementById("classroom-send-confirm").addEventListener("click", () => {
        const sent = Number(slider.value);
        const profile = ARCHETYPE_PROFILES[state.archetype];
        const pool = sent * MULTIPLIER;
        const returned = Math.round(pool * returnFraction(profile));
        state.sent = sent;
        state.returned = returned;
        renderResult();
      });
    }

    function renderTrusteeWaiting() {
      const profile = ARCHETYPE_PROFILES[state.archetype];
      const sent = Math.round(ENDOWMENT * sendFraction(profile));
      const pool = sent * MULTIPLIER;
      state.sent = sent;
      content.innerHTML = `
        ${opponentHeader()}
        <section class="report-section" style="padding-top:16px;">
          <p class="chart-title">They sent you ${fmt(sent)}</p>
          <p class="report-body">Tripled on the way, you're holding <strong>${fmt(pool)}</strong>. How much do you send back?</p>
          <input type="range" id="classroom-return-slider" min="0" max="${pool}" step="1" value="${Math.round(pool / 2)}" style="width:100%;max-width:400px;">
          <p class="report-clevel-badge" id="classroom-return-value" style="margin-top:10px;">${fmt(Math.round(pool / 2))}</p>
          <button class="btn btn-primary" id="classroom-return-confirm" type="button" style="display:block;margin-top:10px;">Send it back</button>
        </section>
      `;
      const slider = document.getElementById("classroom-return-slider");
      const valueEl = document.getElementById("classroom-return-value");
      slider.addEventListener("input", () => { valueEl.textContent = fmt(Number(slider.value)); });
      document.getElementById("classroom-return-confirm").addEventListener("click", () => {
        state.returned = Number(slider.value);
        renderResult();
      });
    }

    function renderResult() {
      const pool = state.sent * MULTIPLIER;
      const youAreInvestor = state.role === "investor";
      const investorFinal = youAreInvestor ? (ENDOWMENT - state.sent) + state.returned : pool - state.returned;
      const trusteeFinal = youAreInvestor ? pool - state.returned : (ENDOWMENT - state.sent) + state.returned;
      const yourFinal = youAreInvestor ? investorFinal : trusteeFinal;
      const sentPct = Math.round((state.sent / ENDOWMENT) * 100);
      const returnedPct = pool ? Math.round((state.returned / pool) * 100) : 0;
      logPlay("trust", state.role, state.archetype, { sent: state.sent, returned: state.returned, pool });
      // Investor's send is a risk-under-uncertainty call; Trustee's return is
      // unforced giving once the money is already theirs — closer to a pure
      // prosocial-orientation read, same logic a Dictator Game would give.
      const nudge = youAreInvestor
        ? nudgeAxis("risk_disposition", nudgeDeltaFromFraction(state.sent / ENDOWMENT), "classroom:trust:investor")
        : nudgeAxis("prosocial_orientation", nudgeDeltaFromFraction(returnedPct / 100), "classroom:trust:trustee");

      content.innerHTML = `
        ${opponentHeader()}
        <section class="report-section" style="padding-top:16px;">
          <p class="chart-title">What happened</p>
          <p class="report-body">Sent: <strong>${fmt(state.sent)}</strong> (${sentPct}% of $${ENDOWMENT}) &rarr; tripled to <strong>${fmt(pool)}</strong> &rarr; returned: <strong>${fmt(state.returned)}</strong> (${returnedPct}% of the pool).</p>
          <p class="report-body">Investor ends with <strong>${fmt(investorFinal)}</strong>. Trustee ends with <strong>${fmt(trusteeFinal)}</strong>.</p>
          <p class="report-clevel-badge">You ended with ${fmt(yourFinal)}</p>
        </section>

        <section class="report-section">
          <p class="chart-title">What the equilibrium predicted</p>
          <p class="report-body">Work it out by backward induction: a purely self-interested Trustee keeps the whole pool and returns $0. Knowing that, a purely self-interested Investor should never send anything in the first place. The rational-equilibrium prediction for this entire game is <strong>$0 sent, $0 returned</strong> — everyone walks away with exactly what they started with.</p>
          <p class="model-axis-citation">Berg, Dickhaut &amp; McCabe (1995), "Trust, Reciprocity, and Social History" — the original trust-game study. Real investors sent roughly half their endowment on average, and trustees returned enough that most investors ended up ahead of where they started.</p>
        </section>

        <section class="report-section report-support" style="text-align:left;">
          <p class="chart-title">Why the gap exists</p>
          <p class="report-body">The opponent here plays a simplified model of ${esc(PERSONAS.find(p => p.slug === state.archetype).name)}'s existing profile — sending and returning more when their <code>prosocial_orientation</code> and <code>risk_disposition</code> scores are higher. This is illustrative, not a research-backed per-archetype prediction — real people's behavior in this exact game varies enormously and isn't fully explained by any one trait. The point isn't the specific number; it's that almost nobody actually plays the equilibrium.</p>
          ${nudgeNoteHtml(nudge)}
        </section>

        ${analyticsSectionHtml("trust")}

        <div class="recap-actions" style="margin-top:8px;">
          <button class="btn btn-primary" id="classroom-again" type="button">Play again</button>
          <button class="btn btn-secondary" id="classroom-new-setup" type="button">Change opponent / role</button>
        </div>
      `;
      loadAnalytics("trust");
      document.getElementById("classroom-again").addEventListener("click", () => {
        state.sent = null; state.returned = null;
        if (state.role === "investor") renderInvestorChoice(); else renderTrusteeWaiting();
      });
      document.getElementById("classroom-new-setup").addEventListener("click", renderSetup);
    }

    return { init: renderSetup };
  })();

  // ===================================================== Public Goods Game
  // Isaac & Walker (1988); Fehr & Gächter (2000). Everyone privately
  // decides how much of their endowment to put into a shared pot; the pot
  // is multiplied and split evenly regardless of who contributed what.
  // Equilibrium is $0 from everyone (free-ride). Real groups start around
  // 40-60% of endowment and decay toward zero over repeated rounds unless
  // costly punishment is allowed — the "unraveling" is the whole lesson.
  const PublicGoodsGame = (function () {
    const content = document.getElementById("classroom-content");
    const ENDOWMENT = 10;
    const MULTIPLIER = 2;
    const PLAYERS = 4; // you + 3 classmates
    const ROUNDS = 5;
    const DECAY = 0.82;

    let state = { classmates: ["steady_saver", "impulsive_spender", "purposeful_giver"], round: 1, history: [], contribution: null };

    function baseFraction(profile) {
      return Math.max(0, Math.min(0.9, 0.15 + (profile.prosocial_orientation / 100) * 0.45));
    }
    function classmateContribution(slug, round) {
      const profile = ARCHETYPE_PROFILES[slug];
      const frac = baseFraction(profile) * Math.pow(DECAY, round - 1);
      return Math.round(ENDOWMENT * frac);
    }

    function renderSetup() {
      content.innerHTML = `
        ${gameIntroHtml("goods")}
        <section class="report-section" style="border-top:0;padding-top:0;">
          <p class="chart-title">Set up your group</p>
          <p class="report-body">Three classmates, five rounds. Everyone starts with $${ENDOWMENT} each round and privately decides how much to put into the shared pot — it doubles, then splits evenly among all ${PLAYERS} of you no matter who contributed what.</p>
          ${state.classmates.map((slug, i) => `
            <div class="dash-setup-row" style="margin-bottom:10px;">
              <span class="dash-label">Classmate ${i + 1}</span>
              <select class="goal-input classroom-classmate-select" data-idx="${i}" style="max-width:280px;">${archetypeOptionsHtml(slug)}</select>
            </div>`).join("")}
          <button class="btn btn-primary" id="classroom-goods-start" type="button" style="margin-top:8px;">Start round 1</button>
        </section>
      `;
      content.querySelectorAll(".classroom-classmate-select").forEach(sel => {
        sel.addEventListener("change", () => { state.classmates[Number(sel.dataset.idx)] = sel.value; });
      });
      document.getElementById("classroom-goods-start").addEventListener("click", () => {
        state.round = 1;
        state.history = [];
        renderRound();
      });
    }

    function classmatesRowHtml() {
      return state.classmates.map(slug => {
        const p = PERSONAS.find(x => x.slug === slug);
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">${portraitChip(slug, 40)}<span style="font-size:11px;color:var(--slate);max-width:70px;text-align:center;">${esc(p.name)}</span></div>`;
      }).join("");
    }

    function renderRound() {
      content.innerHTML = `
        <section class="report-section" style="border-top:0;padding-top:0;">
          <p class="chart-title">Round ${state.round} of ${ROUNDS}</p>
          <div style="display:flex;gap:16px;margin:10px 0 18px;">${classmatesRowHtml()}</div>
          <p class="report-body">You have $${ENDOWMENT} this round. How much do you put into the shared pot?</p>
          <input type="range" id="classroom-goods-slider" min="0" max="${ENDOWMENT}" step="1" value="5" style="width:100%;max-width:400px;">
          <p class="report-clevel-badge" id="classroom-goods-value" style="margin-top:10px;">$5</p>
          <button class="btn btn-primary" id="classroom-goods-confirm" type="button" style="display:block;margin-top:10px;">Contribute</button>
        </section>
      `;
      const slider = document.getElementById("classroom-goods-slider");
      const valueEl = document.getElementById("classroom-goods-value");
      slider.addEventListener("input", () => { valueEl.textContent = fmt(Number(slider.value)); });
      document.getElementById("classroom-goods-confirm").addEventListener("click", () => {
        const yours = Number(slider.value);
        const classmateAmounts = state.classmates.map(slug => classmateContribution(slug, state.round));
        const total = yours + classmateAmounts.reduce((a, b) => a + b, 0);
        const pot = total * MULTIPLIER;
        const share = pot / PLAYERS;
        const payoff = (ENDOWMENT - yours) + share;
        state.history.push({ round: state.round, yours, classmateAmounts, total, share, payoff });
        if (state.round < ROUNDS) {
          state.round += 1;
          renderRoundResult();
        } else {
          renderFinal();
        }
      });
    }

    function renderRoundResult() {
      const last = state.history[state.history.length - 1];
      content.innerHTML = `
        <section class="report-section" style="border-top:0;padding-top:0;">
          <p class="chart-title">Round ${last.round} result</p>
          <p class="report-body">You put in <strong>${fmt(last.yours)}</strong>. Classmates put in ${last.classmateAmounts.map(fmt).join(", ")}. Group total: <strong>${fmt(last.total)}</strong> &rarr; doubled to ${fmt(last.total * MULTIPLIER)} &rarr; split ${PLAYERS} ways.</p>
          <p class="report-clevel-badge">You got back ${fmt(last.share)} this round (net ${last.payoff >= ENDOWMENT ? "+" : ""}${fmt(last.payoff - ENDOWMENT)})</p>
          <button class="btn btn-primary" id="classroom-goods-next" type="button" style="display:block;margin-top:14px;">Continue to round ${state.round}</button>
        </section>
      `;
      document.getElementById("classroom-goods-next").addEventListener("click", renderRound);
    }

    function contributionChart() {
      const maxVal = ENDOWMENT * PLAYERS;
      const barW = 60, gap = 24, baseX = 60, baseY = 190, maxH = 150;
      const bars = state.history.map((h, i) => {
        const x = baseX + i * (barW + gap);
        const h_px = (h.total / maxVal) * maxH;
        const y = baseY - h_px;
        return `
          <rect x="${x}" y="${y}" width="${barW}" height="${h_px}" rx="4" fill="var(--teal)"/>
          <text x="${x + barW / 2}" y="${baseY + 18}" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--slate)">R${h.round}</text>
          <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink)">${fmt(h.total)}</text>
        `;
      }).join("");
      return `
        <svg viewBox="0 0 480 220" role="img" aria-label="Group contribution total per round" style="width:100%;max-width:480px;">
          <line x1="50" y1="190" x2="460" y2="190" stroke="var(--line)" stroke-width="1.5"/>
          ${bars}
        </svg>`;
    }

    function renderFinal() {
      const totalPayoff = state.history.reduce((sum, h) => sum + h.payoff, 0);
      const startTotal = ENDOWMENT * ROUNDS;
      const firstTotal = state.history[0].total;
      const last = state.history[state.history.length - 1];
      const lastTotal = last.total;
      const yourTotalContribution = state.history.reduce((sum, h) => sum + h.yours, 0);
      logPlay("goods", "player", state.classmates[0], {
        firstRoundTotal: firstTotal,
        lastRoundTotal: lastTotal,
        yourTotalContribution,
        yourTotalPayoff: totalPayoff,
        rounds: ROUNDS,
      });
      const avgContribFrac = yourTotalContribution / startTotal;
      const nudge = nudgeAxis("prosocial_orientation", nudgeDeltaFromFraction(avgContribFrac), "classroom:goods:player");
      content.innerHTML = `
        <section class="report-section" style="border-top:0;padding-top:0;">
          <p class="chart-title">After ${ROUNDS} rounds</p>
          <p class="report-body">Group contribution went from <strong>${fmt(firstTotal)}</strong> in round 1 to <strong>${fmt(lastTotal)}</strong> by round ${ROUNDS} (out of a possible ${fmt(ENDOWMENT * PLAYERS)} each round).</p>
          ${contributionChart()}
          <p class="report-body">Round ${ROUNDS} (your last): you put in <strong>${fmt(last.yours)}</strong> and got back <strong>${fmt(last.share)}</strong> (net ${last.payoff >= ENDOWMENT ? "+" : ""}${fmt(last.payoff - ENDOWMENT)}) — folded into the total below, same as every other round.</p>
          <p class="report-clevel-badge" style="margin-top:14px;">You ended with ${fmt(totalPayoff)} across ${ROUNDS} rounds (started with ${fmt(startTotal)})</p>
        </section>

        <section class="report-section">
          <p class="chart-title">What the equilibrium predicted</p>
          <p class="report-body">A purely self-interested player never contributes — every dollar put in returns only $${(MULTIPLIER / PLAYERS).toFixed(2)} to the contributor personally, a straight loss, even though the group as a whole comes out ahead. The rational-equilibrium prediction is <strong>$0 contributed, every round, by everyone</strong>.</p>
          <p class="model-axis-citation">Isaac &amp; Walker (1988) on voluntary contributions in public-goods games; Fehr &amp; Gächter (2000) on why contributions reliably decay toward zero over repeated rounds — and how allowing players to punish free-riders, even at a cost to themselves, sustains cooperation instead.</p>
        </section>

        <section class="report-section report-support" style="text-align:left;">
          <p class="chart-title">Why the decline happens</p>
          <p class="report-body">Classmates here contribute a fraction of their $${ENDOWMENT} based on their <code>prosocial_orientation</code> score, shrinking further each round — a simplified model of the real "unraveling" pattern: people who start out cooperative scale back once they notice others free-riding, even if they'd have preferred everyone kept contributing. Nobody has to be purely selfish for the group total to collapse.</p>
          ${nudgeNoteHtml(nudge)}
        </section>

        ${analyticsSectionHtml("goods")}

        <div class="recap-actions" style="margin-top:8px;">
          <button class="btn btn-primary" id="classroom-goods-again" type="button">Play again</button>
          <button class="btn btn-secondary" id="classroom-goods-setup" type="button">Change classmates</button>
        </div>
      `;
      loadAnalytics("goods");
      document.getElementById("classroom-goods-again").addEventListener("click", () => {
        state.round = 1; state.history = [];
        renderRound();
      });
      document.getElementById("classroom-goods-setup").addEventListener("click", renderSetup);
    }

    return { init: renderSetup };
  })();

  // ======================================================== Ultimatum Game
  // Güth, Schmittberger & Schwarze (1982) — the original ultimatum-game
  // study. One player proposes a split of $10; the other accepts (both get
  // the split as proposed) or rejects (both get $0). Subgame-perfect
  // rationality says the proposer offers the smallest possible amount and
  // the responder accepts anything above zero. Real responders reliably
  // reject low offers — punishing perceived unfairness even at a real cost
  // to themselves.
  const UltimatumGame = (function () {
    const content = document.getElementById("classroom-content");
    const POT = 10;
    let state = { archetype: null, role: "proposer", offer: null, accepted: null };

    function offerFraction(profile) {
      // Fairness-minded proposers offer closer to an even split.
      return Math.max(0.05, Math.min(0.5, 0.1 + (profile.prosocial_orientation / 100) * 0.35));
    }
    function minAcceptableFraction(profile) {
      // More self-efficacy/confidence -> less willing to accept a lowball
      // offer just to avoid walking away with nothing.
      return Math.max(0, Math.min(0.5, 0.05 + (profile.financial_self_efficacy / 100) * 0.3));
    }

    function renderSetup() {
      content.innerHTML = `
        ${gameIntroHtml("ultimatum")}
        <section class="report-section" style="border-top:0;padding-top:0;">
          <p class="chart-title">Set up the game</p>
          <p class="report-body">$${POT} on the table. The Proposer offers a split; the Responder accepts (both keep it) or rejects (both get $0).</p>
          <div class="dash-setup-row" style="margin-bottom:14px;">
            <span class="dash-label">Play against</span>
            <select id="classroom-ult-opponent" class="goal-input" style="max-width:280px;">${archetypeOptionsHtml(state.archetype)}</select>
          </div>
          <div class="dash-setup-row" style="margin-bottom:18px;">
            <span class="dash-label">Your role</span>
            <div class="chip-row">
              <button class="chip${state.role === "proposer" ? " active" : ""}" data-ult-role="proposer" type="button">Proposer</button>
              <button class="chip${state.role === "responder" ? " active" : ""}" data-ult-role="responder" type="button">Responder</button>
            </div>
          </div>
          <button class="btn btn-primary" id="classroom-ult-start" type="button">Start round</button>
        </section>
      `;
      content.querySelectorAll("[data-ult-role]").forEach(btn => {
        btn.addEventListener("click", () => {
          state.role = btn.dataset.ultRole;
          content.querySelectorAll("[data-ult-role]").forEach(b => b.classList.toggle("active", b === btn));
        });
      });
      document.getElementById("classroom-ult-start").addEventListener("click", () => {
        state.archetype = document.getElementById("classroom-ult-opponent").value;
        state.offer = null;
        state.accepted = null;
        if (state.role === "proposer") renderProposerChoice();
        else renderResponderChoice();
      });
    }

    function opponentHeader() {
      const p = PERSONAS.find(x => x.slug === state.archetype);
      return `
        <div class="report-header" style="border-bottom:0;padding-bottom:0;">
          ${portraitChip(p.slug, 52)}
          <div><p class="report-meta" style="margin:0;">Playing against</p><h3 style="margin:0;font-family:var(--font-display);font-weight:500;">${esc(p.name)}</h3></div>
        </div>`;
    }

    function renderProposerChoice() {
      content.innerHTML = `
        ${opponentHeader()}
        <section class="report-section" style="padding-top:16px;">
          <p class="chart-title">How much do you offer them?</p>
          <p class="report-body">You're splitting $${POT}. Offer too little and they may reject it — then you both get nothing.</p>
          <input type="range" id="classroom-ult-slider" min="0" max="${POT}" step="1" value="5" style="width:100%;max-width:400px;">
          <p class="report-clevel-badge" id="classroom-ult-value" style="margin-top:10px;">$5 to them, $5 to you</p>
          <button class="btn btn-primary" id="classroom-ult-confirm" type="button" style="display:block;margin-top:10px;">Make the offer</button>
        </section>
      `;
      const slider = document.getElementById("classroom-ult-slider");
      const valueEl = document.getElementById("classroom-ult-value");
      slider.addEventListener("input", () => {
        const v = Number(slider.value);
        valueEl.textContent = `${fmt(v)} to them, ${fmt(POT - v)} to you`;
      });
      document.getElementById("classroom-ult-confirm").addEventListener("click", () => {
        const offer = Number(slider.value);
        const profile = ARCHETYPE_PROFILES[state.archetype];
        const threshold = minAcceptableFraction(profile) * POT;
        state.offer = offer;
        state.accepted = offer >= threshold;
        renderResult();
      });
    }

    function renderResponderChoice() {
      const profile = ARCHETYPE_PROFILES[state.archetype];
      const offer = Math.round(POT * offerFraction(profile));
      state.offer = offer;
      content.innerHTML = `
        ${opponentHeader()}
        <section class="report-section" style="padding-top:16px;">
          <p class="chart-title">They offer you ${fmt(offer)}</p>
          <p class="report-body">Out of $${POT} total, they'd keep ${fmt(POT - offer)} and you'd get ${fmt(offer)} — if you accept. If you reject, you both get $0.</p>
          <div class="recap-actions">
            <button class="btn btn-primary" id="classroom-ult-accept" type="button">Accept ${fmt(offer)}</button>
            <button class="btn btn-secondary" id="classroom-ult-reject" type="button">Reject — both get $0</button>
          </div>
        </section>
      `;
      document.getElementById("classroom-ult-accept").addEventListener("click", () => { state.accepted = true; renderResult(); });
      document.getElementById("classroom-ult-reject").addEventListener("click", () => { state.accepted = false; renderResult(); });
    }

    function renderResult() {
      const youAreProposer = state.role === "proposer";
      const proposerFinal = state.accepted ? (POT - state.offer) : 0;
      const responderFinal = state.accepted ? state.offer : 0;
      const yourFinal = youAreProposer ? proposerFinal : responderFinal;
      const offerPct = Math.round((state.offer / POT) * 100);
      logPlay("ultimatum", state.role, state.archetype, { offer: state.offer, accepted: state.accepted, pot: POT });
      // Proposer's offer is a fairness/giving call, same shape as Trust's
      // return leg. Responder's accept/reject on a lowball offer is a
      // walk-away-from-guaranteed-money call — reads closer to financial
      // self-efficacy (confident enough to refuse) than to giving.
      const offerFrac = state.offer / POT;
      const nudge = youAreProposer
        ? nudgeAxis("prosocial_orientation", nudgeDeltaFromFraction(offerFrac), "classroom:ultimatum:proposer")
        : nudgeAxis("financial_self_efficacy", nudgeDeltaUltimatumResponder(offerFrac, state.accepted), "classroom:ultimatum:responder");

      content.innerHTML = `
        ${opponentHeader()}
        <section class="report-section" style="padding-top:16px;">
          <p class="chart-title">What happened</p>
          <p class="report-body">Offer: <strong>${fmt(state.offer)}</strong> to the responder (${offerPct}% of $${POT}) &mdash; <strong>${state.accepted ? "accepted" : "rejected"}</strong>.</p>
          <p class="report-body">Proposer ends with <strong>${fmt(proposerFinal)}</strong>. Responder ends with <strong>${fmt(responderFinal)}</strong>.</p>
          <p class="report-clevel-badge">You ended with ${fmt(yourFinal)}</p>
        </section>

        <section class="report-section">
          <p class="chart-title">What the equilibrium predicted</p>
          <p class="report-body">A purely self-interested Responder should accept any offer above $0 &mdash; something beats nothing. Knowing that, a purely self-interested Proposer should offer the smallest possible amount. The rational-equilibrium prediction is a near-$0 offer, accepted.</p>
          <p class="model-axis-citation">G&uuml;th, Schmittberger &amp; Schwarze (1982), "An Experimental Analysis of Ultimatum Bargaining" &mdash; the original study. Real proposers typically offer close to an even split, and real responders reliably reject offers below roughly 20&ndash;30%, walking away with nothing rather than accept what feels unfair.</p>
        </section>

        <section class="report-section report-support" style="text-align:left;">
          <p class="chart-title">Why the gap exists</p>
          <p class="report-body">The opponent here plays a simplified model of ${esc(PERSONAS.find(p => p.slug === state.archetype).name)}'s existing profile &mdash; offering closer to a fair split when <code>prosocial_orientation</code> is higher, and demanding a fairer offer before accepting when <code>financial_self_efficacy</code> is higher. This is illustrative, not a research-backed per-archetype prediction. The real lesson is that "rational" and "accepted in practice" aren't the same thing &mdash; people pay real money to punish what feels unfair.</p>
          ${nudgeNoteHtml(nudge)}
        </section>

        ${analyticsSectionHtml("ultimatum")}

        <div class="recap-actions" style="margin-top:8px;">
          <button class="btn btn-primary" id="classroom-ult-again" type="button">Play again</button>
          <button class="btn btn-secondary" id="classroom-ult-setup" type="button">Change opponent / role</button>
        </div>
      `;
      loadAnalytics("ultimatum");
      document.getElementById("classroom-ult-again").addEventListener("click", () => {
        state.offer = null; state.accepted = null;
        if (state.role === "proposer") renderProposerChoice(); else renderResponderChoice();
      });
      document.getElementById("classroom-ult-setup").addEventListener("click", renderSetup);
    }

    return { init: renderSetup };
  })();

  // ------------------------------------------------------------ class code
  const cohortInput = document.getElementById("classroom-cohort-input");
  if (cohortInput) {
    cohortInput.value = getCohort() || "";
    cohortInput.addEventListener("change", () => {
      try {
        const v = cohortInput.value.trim();
        if (v) localStorage.setItem(COHORT_STORAGE_KEY, v);
        else localStorage.removeItem(COHORT_STORAGE_KEY);
      } catch (e) {}
    });
  }

  // ==================================================================== nav
  const TABS = { trust: TrustGame, goods: PublicGoodsGame, ultimatum: UltimatumGame };
  function showTab(name) {
    Object.keys(TABS).forEach(t => {
      const btn = document.getElementById(`classroom-tabbtn-${t}`);
      if (btn) {
        btn.classList.toggle("active", t === name);
        btn.setAttribute("aria-selected", t === name ? "true" : "false");
        btn.tabIndex = t === name ? 0 : -1;
      }
    });
    TABS[name].init();
  }
  Object.keys(TABS).forEach(t => {
    const btn = document.getElementById(`classroom-tabbtn-${t}`);
    // Arrow-key/Home/End movement between tabs is handled app-wide by
    // initTabKeyboardNav() in ui.js (focuses + clicks the target tab) — this
    // just needs the click handler; aria-selected/tabindex above is this
    // page's own addition, since the shared helper doesn't set those.
    if (btn) btn.addEventListener("click", () => showTab(t));
  });
  showTab("trust");
})();
