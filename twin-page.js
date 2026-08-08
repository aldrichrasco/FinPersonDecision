// The Financial Twin's page.
//
// Structure follows what the twin actually is: a set of beliefs, each with
// evidence behind it and a status that can change. The most important section
// is not what the twin knows, it is what it has got wrong, because that is
// where the model improves and where the person's own knowledge enters.
(async function () {
  const content = document.getElementById("twin-content");
  const meta = document.getElementById("twin-meta");
  if (!content) return;

  // The server is the source of truth, same as the MRI report. Reading only
  // localStorage meant a signed-in person whose browser storage had been
  // cleared saw a twin that knew nothing, while the server held their whole
  // history. Local is the fallback, not the primary.
  let decisions = [];
  try {
    if (typeof pushMriDecisionToServer === "function") await pushMriDecisionToServer();
    const report = (typeof fetchFreeMriReport === "function") ? await fetchFreeMriReport() : null;
    if (report && Array.isArray(report.decisions)) decisions = report.decisions;
  } catch (e) {}
  if (!decisions.length && typeof getMriDecisions === "function") decisions = getMriDecisions();

  let twin = buildTwin(decisions);
  twin = twinApplyCorrections(twin);

  const TEST_SCENARIO = {
    text: "Your laptop dies. A refurbished replacement is $600, and the listing says the price ends tonight.",
    timed: true, surface: "bnpl", principle: "credit_is_free",
  };

  render();

  function render() {
    meta.textContent = twin.decisionCount
      ? `${twin.decisionCount} decision${twin.decisionCount === 1 ? "" : "s"} observed`
      : "No decisions yet";

    if (!twin.rules.length) {
      content.innerHTML = `
        <div style="text-align:center;padding:20px 0 34px;">${twinAvatarSvg(null, { size: 150 })}</div>
        <div class="mri-empty">
          <p class="mri-empty-lab">Your twin has nothing to go on</p>
          <p class="mri-empty-txt">Your twin is built from what you actually do, not what you say about yourself, so it needs decisions before it can believe anything. <strong>A handful is enough to start.</strong></p>
          <a class="mri-btn mri-btn-sm" href="dashboard.html">Make some decisions</a>
        </div>`;
      return;
    }

    content.className = "twin-boot";
    content.innerHTML = [
      renderStatus(),
      renderHead(),
      renderBeliefs(),
      renderContested(),
      renderPrediction(),
      renderSimulation(),
      renderAppearance(),
      renderMethod(),
    ].join("");

    bind();
  }

  // A short readout on load. States what the model is running on, in its own
  // register, before it says anything about the person.
  function renderStatus() {
    const conf = twin.confirmed.length, cont = twin.contested.length;
    return `
      <div>
        <p class="twin-status">Model online &middot; ${twin.decisionCount} decisions read &middot; ${conf} rule${conf === 1 ? "" : "s"} confirmed${cont ? ` &middot; ${cont} under challenge` : ""}</p>
        <div class="twin-status-bar"></div>
      </div>`;
  }

  // ------------------------------------------------------------------ head
  function renderHead() {
    const m = twin.match;
    return `
      <section class="mri-sec">
        <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
          <div style="flex-shrink:0;">${twinAvatarSvg(twin, { size: 150 })}</div>
          <div style="min-width:220px;flex:1;">
            <p class="mri-sec-num" style="margin:0 0 6px;">${esc(twin.maturity.label.toUpperCase())}</p>
            <h1 class="mri-name" style="font-size:clamp(24px,4vw,32px);">Your Financial Twin</h1>
            <p class="mri-lede" style="font-size:15px;">A model of the rules you decide by, assembled from what you did rather than what you said.</p>
            ${m ? `<p class="mri-twin-metric" style="margin-top:12px;">Matches ${m.matched} of your ${m.total} predicted decisions</p>` : ""}
          </div>
        </div>
      </section>`;
  }

  // --------------------------------------------------------------- beliefs
  function ruleCard(r) {
    const pct = Math.round(r.rate * 100);
    const statusLabel = { confirmed: "Confirmed", contested: "Under challenge", proposed: "Still a hunch" }[r.status];
    const statusColor = { confirmed: "var(--mri-good)", contested: "var(--mri-warn)", proposed: "var(--mri-ink-3)" }[r.status];
    return `
      <div class="mri-ev-item" style="grid-template-columns:1fr;gap:8px;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap;">
          <p class="mri-inter-head" style="font-size:16px;margin:0;max-width:44ch;">${esc(r.statement)}</p>
          <span class="mri-twin-metric" style="color:${statusColor};flex-shrink:0;">${statusLabel}</span>
        </div>
        <div class="mri-tend-bar" style="max-width:100%;"><span class="mri-tend-fill" style="width:${pct}%;background:${statusColor};display:block;"></span></div>
        <p class="mri-ev-txt" style="font-size:13px;">Held in <strong>${r.support} of ${r.total}</strong> decisions where it applied. ${esc(r.note)}</p>
        ${r.refined && r.status === "confirmed" ? `
          <p class="mri-ev-txt" style="font-size:12.5px;color:var(--mri-ink-3);">
            Refined from an earlier, vaguer belief: <em>${esc(r.refined)}</em>
          </p>` : ""}
      </div>`;
  }

  function renderBeliefs() {
    const shown = twin.confirmed.concat(twin.proposed);
    if (!shown.length) return "";
    return `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">01</span>
          <h2 class="mri-sec-title">What your twin believes</h2>
        </div>
        <p class="mri-note" style="margin-bottom:16px;">Each of these is a rule, not a score. A rule can be argued with, tested, and thrown out, which is the point.</p>
        <div class="mri-ev">${shown.map(ruleCard).join("")}</div>
      </section>`;
  }

  function renderContested() {
    if (!twin.contested.length) return "";
    return `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">02</span>
          <h2 class="mri-sec-title">What it is getting wrong</h2>
        </div>
        <p class="mri-note" style="margin-bottom:16px;">These beliefs have run into evidence against them. They are shown rather than quietly dropped, because a model that hides its weak points cannot be checked.</p>
        <div class="mri-ev">${twin.contested.map(ruleCard).join("")}</div>
      </section>`;
  }

  // ------------------------------------------------------------ prediction
  // The live loop. A confirmed rule is turned into a call on a fresh scenario,
  // and the person gets to say whether it is right. Disagreement asks WHY,
  // because the reason is the exception the model is missing.
  function renderPrediction() {
    const p = twinPredict(twin, TEST_SCENARIO);
    if (!p) {
      return `
        <section class="mri-sec">
          <div class="mri-sec-head">
            <span class="mri-sec-num">03</span>
            <h2 class="mri-sec-title">Test your twin</h2>
          </div>
          <div class="mri-empty">
            <p class="mri-empty-lab">Not confident enough to call it</p>
            <p class="mri-empty-txt">Your twin will not guess. It needs at least one confirmed rule that applies to a scenario before it will predict what you do.</p>
            <a class="mri-btn mri-btn-sm" href="dashboard.html">Give it more to work with</a>
          </div>
        </section>`;
    }
    return `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">03</span>
          <h2 class="mri-sec-title">Test your twin</h2>
        </div>
        <div class="mri-twin-demo">
          <p class="mri-twin-lab">Called before you decide</p>
          <p class="mri-twin-scenario">${esc(TEST_SCENARIO.text)}</p>
          <p class="mri-twin-call">Your twin ${esc(p.call)}.</p>
          <p class="mri-twin-because">Because of a rule it holds: <em>${esc(p.rule.statement)}</em> That has held in ${esc(p.basis)} where it applied.</p>
          <div class="mri-twin-ask" id="twin-ask">
            <p class="mri-twin-q">Is it right?</p>
            <button class="mri-btn mri-btn-ghost mri-btn-sm" data-agree="1" data-rule="${esc(p.rule.id)}" type="button">Yes, that's me</button>
            <button class="mri-btn mri-btn-ghost mri-btn-sm" data-agree="0" data-rule="${esc(p.rule.id)}" type="button">No, I'd wait</button>
          </div>
          <div id="twin-followup"></div>
        </div>
      </section>`;
  }


  // ------------------------------------------------------------ simulation
  // Watch the model act without you. Three agents, same scenarios, same order:
  // your learned rules, a textbook version of your archetype, and chance.
  // The third is what makes the first two interpretable.
  function renderSimulation() {
    if (!twin.confirmed.length) {
      return `
        <section class="mri-sec">
          <div class="mri-sec-head">
            <span class="mri-sec-num">04</span>
            <h2 class="mri-sec-title">Watch it run</h2>
          </div>
          <div class="mri-empty">
            <p class="mri-empty-lab">Nothing to run yet</p>
            <p class="mri-empty-txt">Once your twin holds at least one confirmed rule, it can play a run of decisions on its own while you watch, alongside your archetype and a random baseline.</p>
            <a class="mri-btn mri-btn-sm" href="dashboard.html">Give it a rule to learn</a>
          </div>
        </section>`;
    }
    const profile = (typeof getProfile === "function" ? getProfile() : null) || {};
    const persona = (typeof PERSONAS !== "undefined")
      ? PERSONAS.find(p => p.slug === profile.archetype) : null;
    const group = persona ? persona.group : "conservative";
    const sim = runTwinSimulation(twin, group, { rounds: 16 });
    window.__lastSim = sim;

    return `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">04</span>
          <h2 class="mri-sec-title">Watch it run</h2>
        </div>
        <p class="mri-note" style="margin-bottom:18px;">Sixteen decisions, made three ways over the same scenarios in the same order. You supervise; nobody here is you.</p>
        ${simChart(sim)}
        <div class="mri-split-legend" style="margin-top:14px;">
          <span><i style="background:var(--mri-accent);"></i>Your rules</span>
          <span><i style="background:var(--mri-good);"></i>Your archetype, by the book</span>
          <span><i style="background:var(--mri-ink-3);"></i>Chance</span>
        </div>
        <p class="mri-note" style="margin-top:16px;">
          ${sim.gapToArchetype > 0
            ? `Playing by your own rules finished <strong>${money(sim.gapToArchetype)}</strong> behind the textbook version of your archetype, across ${sim.divergences} decision${sim.divergences === 1 ? "" : "s"} where the two disagreed.`
            : `Playing by your own rules matched or beat the textbook version of your archetype over this run.`}
        </p>
        <p class="mri-note" style="margin-top:10px;font-size:13px;color:var(--mri-ink-3);">
          ${sim.beatsChance
            ? "Your line separates clearly from the random baseline, so this run reflects a real pattern rather than noise."
            : "<strong>Your line is not clearly separated from chance yet.</strong> Treat this run as illustrative: your twin needs more evidence before its behaviour is distinguishable from random."}
        </p>
        <p style="margin-top:16px;"><button class="mri-btn mri-btn-ghost mri-btn-sm" id="twin-sim-log" type="button">Show every decision</button></p>
        <div id="twin-sim-detail"></div>
      </section>`;
  }

  function money(n) {
    return "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
  }

  function simChart(sim) {
    const W = 620, H = 210, padL = 8, padR = 8, padT = 14, padB = 22;
    const all = [].concat(sim.tracks.you, sim.tracks.archetype, sim.tracks.drift);
    const min = Math.min(...all), max = Math.max(...all);
    const span = (max - min) || 1;
    const x = i => padL + (i / (sim.tracks.you.length - 1)) * (W - padL - padR);
    const y = v => padT + (1 - (v - min) / span) * (H - padT - padB);
    const path = track => track.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const zeroY = y(0);
    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;" role="img"
           aria-label="Three cumulative decision tracks over sixteen rounds: your rules, your archetype, and chance.">
        <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}"
              stroke="var(--mri-rule)" stroke-width="1"/>
        <path d="${path(sim.tracks.drift)}" fill="none" stroke="var(--mri-ink-3)" stroke-width="1.6" stroke-dasharray="4 4"/>
        <path d="${path(sim.tracks.archetype)}" fill="none" stroke="var(--mri-good)" stroke-width="2"/>
        <path d="${path(sim.tracks.you)}" fill="none" stroke="var(--mri-accent)" stroke-width="2.6"/>
        <circle cx="${x(sim.tracks.you.length - 1).toFixed(1)}" cy="${y(sim.final.you).toFixed(1)}" r="4"
                fill="var(--mri-accent)" stroke="var(--mri-surface)" stroke-width="2"/>
        <text x="${padL}" y="${H - 6}" style="font-family:var(--mri-mono);font-size:9px;fill:var(--mri-ink-3);">ROUND 1</text>
        <text x="${W - padR}" y="${H - 6}" text-anchor="end" style="font-family:var(--mri-mono);font-size:9px;fill:var(--mri-ink-3);">${sim.rounds}</text>
      </svg>`;
  }

  function renderSimLog(sim) {
    return `
      <div class="mri-ev" style="margin-top:16px;">
        ${sim.log.map(l => `
          <div class="mri-ev-item" style="grid-template-columns:34px 1fr;">
            <span class="mri-ev-num">${String(l.round).padStart(2, "0")}</span>
            <div>
              <p class="mri-ev-txt" style="margin-bottom:5px;">${esc(l.scenario)}${l.timed ? ' <strong style="color:var(--mri-warn);">timed</strong>' : ""}</p>
              <p class="mri-ev-txt" style="font-size:12.5px;color:var(--mri-ink-3);">
                You: ${esc(l.you)} &middot; Archetype: ${esc(l.archetype)} &middot; Chance: ${esc(l.drift)}
              </p>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // ------------------------------------------------------------ appearance
  // Cosmetics only, and the page says so plainly. Nothing here changes what
  // the twin knows or how confident it is, because an accuracy you can buy
  // makes the whole model worthless.
  function renderAppearance() {
    const cos = getTwinCosmetics();
    const swatches = Object.entries(TWIN_PALETTES).map(([name, p]) => {
      const owned = cos.owned.includes(name);
      const active = cos.palette === name;
      return `
        <button class="mri-btn mri-btn-ghost mri-btn-sm" data-palette="${esc(name)}"
                ${owned ? "" : "disabled"}
                style="display:flex;align-items:center;gap:8px;${active ? "border-width:2px;" : ""}${owned ? "" : "opacity:.45;"}">
          <span style="width:12px;height:12px;border-radius:50%;background:${p.core};display:block;"></span>
          <span>${esc(name)}</span>
          ${owned ? (active ? "<span style='font-size:11px;'>in use</span>" : "") : "<span style='font-size:11px;'>locked</span>"}
        </button>`;
    }).join("");
    return `
      <section class="mri-sec">
        <div class="mri-sec-head">
          <span class="mri-sec-num">05</span>
          <h2 class="mri-sec-title">Appearance</h2>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">${swatches}</div>
        <p class="mri-note" style="font-size:13px;">
          Appearance is cosmetic and nothing more. <strong>There is deliberately no way to make your twin smarter with money.</strong>
          A model of yourself whose accuracy could be purchased would tell you nothing about yourself, so the only thing that improves it is more decisions.
        </p>
      </section>`;
  }

  function renderMethod() {
    return `
      <div class="mri-method">
        <p><strong>How your twin learns.</strong> Every rule is checked against the decisions where it applies, counting both the times it held and the times it did not. Rules need at least ${TWIN_MIN_EVIDENCE} applicable decisions before they stop being a hunch, and lose that status if support falls away.</p>
        <p>Telling it that it is wrong counts too, and counts heavily. Two disagreements will demote a belief the behaviour still supports, on the basis that you know an exception the decision log cannot see.</p>
        <p><strong>Your twin is a model, not a verdict.</strong> It is meant to be wrong sometimes, and that is when it is most useful.</p>
      </div>`;
  }

  // ---------------------------------------------------------------- events
  function bind() {
    document.querySelectorAll("[data-agree]").forEach(btn => {
      btn.addEventListener("click", () => {
        const agreed = btn.dataset.agree === "1";
        const ruleId = btn.dataset.rule;
        if (agreed) {
          recordTwinCorrection(ruleId, true, null);
          document.getElementById("twin-followup").innerHTML =
            `<p class="mri-note" style="margin-top:14px;">Recorded. Your twin weights that rule more heavily, and will keep testing it.</p>`;
          document.getElementById("twin-ask").querySelectorAll("button").forEach(b => b.disabled = true);
        } else {
          askWhy(ruleId);
        }
        if (typeof track === "function") track("twin_feedback", { rule: ruleId, agreed });
      });
    });

    document.getElementById("twin-sim-log")?.addEventListener("click", () => {
      const host = document.getElementById("twin-sim-detail");
      if (!host || !window.__lastSim) return;
      host.innerHTML = host.innerHTML ? "" : renderSimLog(window.__lastSim);
    });

    document.querySelectorAll("[data-palette]").forEach(btn => {
      btn.addEventListener("click", () => {
        setTwinPalette(btn.dataset.palette);
        render();
      });
    });
  }

  // The most valuable interaction in the product: the person naming the
  // exception. Each reason implies a different follow-up for the model.
  function askWhy(ruleId) {
    document.getElementById("twin-ask").querySelectorAll("button").forEach(b => b.disabled = true);
    document.getElementById("twin-followup").innerHTML = `
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--mri-rule-soft);">
        <p class="mri-twin-q" style="margin-bottom:10px;">What makes this one different?</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${TWIN_DISAGREE_REASONS.map(r =>
            `<button class="mri-btn mri-btn-ghost mri-btn-sm" data-reason="${esc(r.id)}" data-rule="${esc(ruleId)}" type="button">${esc(r.label)}</button>`
          ).join("")}
        </div>
      </div>`;
    document.querySelectorAll("[data-reason]").forEach(btn => {
      btn.addEventListener("click", () => {
        recordTwinCorrection(btn.dataset.rule, false, btn.dataset.reason);
        document.getElementById("twin-followup").innerHTML =
          `<p class="mri-note" style="margin-top:14px;">Recorded. Your twin now treats that rule as under challenge, and the next scenarios will probe for the exception you just described.</p>`;
        if (typeof track === "function") track("twin_correction", { rule: btn.dataset.rule, reason: btn.dataset.reason });
        // Re-evaluate immediately so the change is visible, not promised.
        twin = twinApplyCorrections(buildTwin(decisions));
        setTimeout(render, 1200);
      });
    });
  }
})();
