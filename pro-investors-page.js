// FinPerson Pro — investor-archetype quiz. Free, no sign-in required,
// localStorage-only (same shape as the retail quiz.js, minus the tiebreaker
// escalation — with 7 archetypes at a >30-point minimum pairwise distance
// instead of 11 at ~35, the base question bank alone separates them
// reliably enough; see tests-js/investor-model.test.js).
(function () {
  const content = document.getElementById("pro-investors-content");
  const STORAGE_KEY = "finperson_investor_profile";

  const QUESTIONS = [
    {
      q: "When you find a promising position, how long do you expect to hold it?",
      options: [
        { label: "Years, maybe decades — I'm not selling on noise", d: { time_horizon: +20 } },
        { label: "As long as the original macro thesis still holds", d: { time_horizon: +10, analysis_lens: +12 } },
        { label: "Weeks to months, until the setup plays out", d: { time_horizon: -15 } },
        { label: "Days — I'm in and out fast", d: { time_horizon: -22 } },
      ],
    },
    {
      q: "A rule you've relied on for years just told you to do something that feels wrong. What do you do?",
      options: [
        { label: "Follow it anyway — that's the whole point of having a rule", d: { decision_process: +22 } },
        { label: "Check whether conditions have actually changed before deciding", d: { decision_process: +10, analysis_lens: +8 } },
        { label: "Override it — I trust my read of this specific situation more", d: { decision_process: -20 } },
        { label: "I don't really use fixed rules to begin with", d: { decision_process: -15 } },
      ],
    },
    {
      q: "How many positions do you typically hold at once?",
      options: [
        { label: "One or two I really believe in", d: { conviction: +22 } },
        { label: "A handful of high-conviction bets", d: { conviction: +12 } },
        { label: "Dozens, spread wide", d: { conviction: -18 } },
        { label: "As many as it takes to feel diversified", d: { conviction: -22 } },
      ],
    },
    {
      q: "Everyone around you is suddenly convinced the market's about to do something big. Your instinct?",
      options: [
        { label: "If everyone agrees, the trade's probably already priced in — or wrong", d: { market_stance: +20 } },
        { label: "Depends what the data says, not what people feel", d: { market_stance: +8, analysis_lens: +10 } },
        { label: "Ride it — trends persist longer than people expect", d: { market_stance: -20 } },
        { label: "I don't really form views on crowd sentiment", d: { market_stance: 0 } },
      ],
    },
    {
      q: "What actually drives your decision to buy something?",
      options: [
        { label: "Interest rates, currencies, the macro backdrop", d: { analysis_lens: +22 } },
        { label: "Price action and chart signals, not the underlying story", d: { analysis_lens: +15, decision_process: +10 } },
        { label: "Whatever's cheap relative to what I think it's worth", d: { analysis_lens: -15 } },
        { label: "The specific business — its numbers, its moat, its management", d: { analysis_lens: -20 } },
      ],
    },
    {
      q: "A position moves hard against you overnight. First reaction?",
      options: [
        { label: "This is exactly when big positions get interesting", d: { risk_posture: +22 } },
        { label: "My stop already handled it before I even saw this", d: { decision_process: +15, risk_posture: +8 } },
        { label: "Check my thesis — if it's intact, this is noise", d: { risk_posture: -10, time_horizon: +8 } },
        { label: "Cut it — protecting capital comes first", d: { risk_posture: -20 } },
      ],
    },
    {
      q: "What's the actual goal of your process?",
      options: [
        { label: "Be right about something nobody else sees yet", d: { market_stance: +15, conviction: +10 } },
        { label: "Catch the move once it's already confirmed", d: { market_stance: -18, decision_process: +10 } },
        { label: "Compound steadily and never blow up", d: { risk_posture: -20, time_horizon: +12 } },
        { label: "Capture the market's return as cheaply and reliably as possible", d: { decision_process: +15, conviction: -20, risk_posture: -15 } },
      ],
    },
  ];

  let step = 0;
  let profile = neutralInvestorProfile();

  function renderStep() {
    if (step >= QUESTIONS.length) return renderResult();
    const q = QUESTIONS[step];
    content.innerHTML = `
      <p class="pro-mono" style="color:var(--pro-muted);font-size:12px;margin:0 0 14px;">Question ${step + 1} of ${QUESTIONS.length}</p>
      <h2 style="font-family:var(--font-display);font-weight:500;font-size:21px;margin:0 0 20px;color:var(--pro-ink);">${esc(q.q)}</h2>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${q.options.map((o, i) => `<button class="pro-option-btn" data-i="${i}" type="button">${esc(o.label)}</button>`).join("")}
      </div>
    `;
    content.querySelectorAll(".pro-option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const opt = q.options[+btn.dataset.i];
        Object.entries(opt.d || {}).forEach(([axis, delta]) => {
          profile[axis] = clampInvestor01to100((profile[axis] ?? 50) + delta);
        });
        step += 1;
        renderStep();
      });
    });
  }

  function renderResult() {
    const slug = matchInvestorArchetype(profile);
    const investor = INVESTOR_PROFILES[slug];
    const at = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, slug, at }));
    } catch (e) {}

    const axisRows = INVESTOR_AXIS_KEYS.map(k => {
      const value = Math.round(profile[k] ?? 50);
      const meta = INVESTOR_AXES[k];
      return `
        <div class="pro-axis-row">
          <div class="pro-axis-head"><span>${esc(meta.label)}</span><span class="pro-mono">${value}</span></div>
          <div class="pro-axis-scale"><span class="pro-axis-marker" style="left:${value}%;"></span></div>
          <div class="pro-axis-poles"><span>${esc(meta.low)}</span><span>${esc(meta.high)}</span></div>
        </div>`;
    }).join("");

    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px;">
        <div style="width:64px;height:64px;flex-shrink:0;">${investorPortraitSvg(slug)}</div>
        <div>
          <span class="pro-badge">Closest match</span>
          <h2 style="font-family:var(--font-display);font-weight:500;font-size:26px;margin:0;color:var(--pro-ink);">${esc(investor.name)}</h2>
          <p class="pro-mono" style="color:var(--pro-muted);font-size:12px;margin:2px 0 0;">${esc(investor.era)}</p>
        </div>
      </div>
      <p style="font-size:15px;line-height:1.6;color:var(--pro-ink);">${esc(investor.blurb)}</p>
      <p class="pro-footer-note" style="margin:8px 0 0;">${esc(investor.citation)}</p>

      <div style="margin-top:22px;">
        ${axisRows}
      </div>

      <div class="pro-panel pro-panel-raised" style="margin-top:22px;">
        <p class="pro-mono" style="color:var(--pro-accent);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Next: train the discipline</p>
        <p style="font-size:14.5px;color:var(--pro-ink);margin:0 0 14px;">Knowing your style is the easy part. The Turtle Trading simulation tests whether you can actually follow a system when your gut disagrees with it — the specific skill the archetype above either has, or doesn't.</p>
        <a class="pro-btn" href="pro-turtle.html">Try the Turtle simulation &rarr;</a>
      </div>

      <button class="pro-btn pro-btn-secondary" id="pro-investors-again" type="button" style="margin-top:14px;">Retake the quiz</button>
    `;
    document.getElementById("pro-investors-again").addEventListener("click", () => {
      step = 0;
      profile = neutralInvestorProfile();
      renderStep();
    });
  }

  renderStep();
})();
