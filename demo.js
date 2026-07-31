// ---------------------------------------------------------------------------
// Demo harness. Seeds realistic state and calls the REAL rendering functions,
// so what you see is the actual code path rather than a mockup.
//
// External file, not inline in demo.html — the site-wide CSP
// (script-src 'self', no 'unsafe-inline'; see add_security_headers() in
// server.py) silently blocks inline <script> execution in any CSP-enforcing
// browser. Every other page already loads its logic from a file for this
// exact reason; this page's demo harness was the one exception, which meant
// none of it — the charts, the seed buttons, the probe/recap previews — ever
// actually ran.
// ---------------------------------------------------------------------------

const TRACKS = {
  steady:     [52, 55, 51, 57, 54, 58, 56, 60, 58, 61],
  breakdown:  [52, 46, 39, 31, 26, 22, 28, 34, 30, 27],
  distortion: [55, 61, 66, 70, 74, 78, 81, 79, 83, 86],
};

const LOGS = {
  steady: [
    { choice: "Pay from savings", delta: { savings: -1200 }, scenarioZone: "general" },
    { choice: "Contribute the full 6%", delta: { investments: 1800, expenses: 300 }, scenarioZone: "general" },
    { choice: "Pay down debt", delta: { debt: -3000 }, scenarioZone: "general" },
    { choice: "Take them and direct the extra to debt", delta: { income: 400, debt: -800 }, scenarioZone: "recovery" },
    { choice: "Add to emergency savings", delta: { savings: 3000 }, scenarioZone: "general" },
  ],
  breakdown: [
    { choice: "Put it on a 0% intro card", delta: { debt: 1200 }, scenarioZone: "general" },
    { choice: "Go, put it on a card", delta: { debt: 2000 }, scenarioZone: "general" },
    { choice: "Delay it and hope for the best", delta: { expenses: 300 }, scenarioZone: "general" },
    { choice: "Buy it now, worry later", delta: { debt: 400 }, scenarioZone: "general" },
    { choice: "Ignore it, deal with it later", delta: { debt: 600 }, scenarioZone: "recovery" },
  ],
  distortion: [
    { choice: "Decline, start a trip fund instead", delta: { savings: 200 }, scenarioZone: "living" },
    { choice: "Skip it and keep saving", delta: { savings: 200 }, scenarioZone: "living" },
    { choice: "Put it off again", delta: { expenses: 120 }, scenarioZone: "living" },
    { choice: "Add to emergency savings", delta: { savings: 3000 }, scenarioZone: "general" },
    { choice: "Keep struggling with it", delta: { expenses: 60 }, scenarioZone: "living" },
  ],
};

let mode = "steady";

function seed(which) {
  mode = which;
  const observed = TRACKS[which];
  const zones = observed.map(v => zoneStatus(v));
  const log = LOGS[which].map((d, i) => ({ ...d, flavor: "x", zone: zones[i] || "homeostasis" }));

  // 1. Learner chart
  setChartMode("simple");
  renderHomeostasisChart({
    observed,
    archetype: observed.map(() => 48),
    recalibrated: observed.map(v => recalibrate(v)),
    triggers: buildTriggers(observed),
  });

  // 2. Research chart — same data, full instrument
  renderResearchChart(observed);

  // 3. Observations
  const read = observePattern(log, zones);
  const panel = document.getElementById("pattern-panel");
  panel.className = `pattern-panel tone-${read.tone}`;
  panel.innerHTML = `<p class="pattern-headline">${read.headline}</p>
                     <p class="pattern-body">${read.body}</p>`;

  const logEl = document.getElementById("change-log");
  logEl.innerHTML = "";
  log.forEach((d, i) => {
    const slice = log.slice(0, i + 1);
    const obs = observeDecision(slice);
    const parts = Object.entries(d.delta).map(([k, v]) =>
      `${k} ${v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString()}`);
    const li = document.createElement("li");
    li.innerHTML = `<div class="log-row">
        <span class="log-choice">${d.choice}</span>
        <span class="log-delta">${parts.join(", ")}</span>
      </div>
      ${obs ? `<p class="log-observation">${obs}</p>` : ""}`;
    logEl.prepend(li);
  });

  renderScaffoldDemo();
  renderTrajectory(observed, zones);
}

function buildTriggers(observed) {
  const out = [];
  for (let i = 1; i < observed.length; i++) {
    const t = detectTrigger(observed[i - 1], observed[i]);
    if (t) out.push({ index: i, ...t });
  }
  return out;
}

// Renders the instrumented chart into a second canvas by temporarily
// repointing the module's expected element id.
function renderResearchChart(observed) {
  const real = document.getElementById("homeostasis-chart");
  const demo = document.getElementById("research-chart");
  real.id = "__tmp"; demo.id = "homeostasis-chart";
  setChartMode("research");
  renderHomeostasisChart({
    observed,
    archetype: observed.map(() => 48),
    recalibrated: observed.map(v => recalibrate(v)),
    triggers: buildTriggers(observed),
  });
  demo.id = "research-chart"; real.id = "homeostasis-chart";
  setChartMode("simple");
}

// Shows all three fade states side by side.
function renderScaffoldDemo() {
  try { localStorage.removeItem("finperson_idm"); } catch (e) {}
  const rows = [
    { k: "credit_is_free", label: "New to this principle", seed: [] },
    { k: "catch_up_later", label: "Recognised when asked, twice", seed: [["C1", "credit_card"], ["C1", "bnpl"]] },
    { k: "more_saved_is_better", label: "Recognised it unprompted", seed: [["C1", "windfall"], ["C2", "opportunity"]] },
  ];
  const host = document.getElementById("scaffold-demo");
  host.innerHTML = rows.map(r => {
    r.seed.forEach(([c, s], i) =>
      updateIDM(r.k, { correct: true, confidence: 0.6, surprise: 3, cLevel: c, surface: s, decisionIndex: i }));
    const resp = scaffoldedResponse(r.k, { observation: "You reached for credit again." });
    const badge = { name: "SYSTEM NAMES IT", ask: "SYSTEM ASKS", wait: "SYSTEM SAYS NOTHING" }[resp.level];
    return `<div class="pattern-panel tone-${resp.level === "wait" ? "good" : resp.level === "ask" ? "neutral" : "watch"}"
                 style="margin-bottom:12px;">
      <p class="demo-label" style="margin-bottom:8px;">${badge} &middot; ${r.label}</p>
      ${resp.text ? `<p class="pattern-body" style="color:var(--ink);">${resp.text}</p>` : ""}
      ${resp.prompt ? `<div class="scaffold-ask"><p>${resp.prompt}</p></div>` : ""}
      ${resp.openSlot ? `<p class="pattern-body" style="font-style:italic;">— silence, deliberately. This is where unprompted recognition becomes observable.</p>` : ""}
    </div>`;
  }).join("");
}

function renderTrajectory(observed, zones) {
  const s = calibrationSummary() || {};
  const inZone = zones.filter(z => z === "homeostasis").length;
  const cards = [
    ["Prediction accuracy", s.meanAccuracy != null ? Math.round(s.meanAccuracy * 100) + "%" : "68%", "self-knowledge ↑"],
    ["Confidence–accuracy gap", s.confidenceAccuracyGap != null ? (s.confidenceAccuracyGap >= 0 ? "+" : "") + s.confidenceAccuracyGap.toFixed(2) : "+0.18", "toward zero"],
    ["Mean recognition level", s.meanRecognitionRank != null ? s.meanRecognitionRank.toFixed(2) : "1.33", "C0 → C3 ↑"],
    ["Anticipatory rate (C3)", "12%", "↑"],
    ["Mean surprise", s.meanSurprise ? s.meanSurprise.toFixed(1) : "3.6", "↓ as models calibrate"],
    ["Transfer (2+ surfaces)", `${s.modelsTransferred || 1} of ${s.modelsEngaged || 3}`, "↑"],
    ["Decisions in zone", `${inZone} of ${zones.length}`, "context"],
    ["Scaffolding required", "42%", "↓ without quality loss"],
  ];
  document.getElementById("trajectory-grid").innerHTML = cards.map(([l, v, d]) =>
    `<div class="traj-card"><span class="traj-label">${l}</span>
       <span class="traj-value">${v}</span><span class="traj-dir">${d}</span></div>`).join("");
}

// Situation cards, from the real data
document.getElementById("situations").innerHTML = SITUATIONS.map(s => `
  <li><a class="situation" href="#"
         ><span class="situation-label">${s.label}</span>
          <span class="situation-sub">${s.sub}</span></a></li>`).join("");
document.querySelectorAll("#situations .situation").forEach(a => {
  a.addEventListener("click", e => e.preventDefault());
});

// --- demo controls ---
document.getElementById("d-steady").addEventListener("click", () => seed("steady"));
document.getElementById("d-breakdown").addEventListener("click", () => seed("breakdown"));
document.getElementById("d-distortion").addEventListener("click", () => seed("distortion"));

document.getElementById("d-probe").addEventListener("click", () => {
  const o = document.createElement("div");
  o.className = "quiz-overlay open";
  o.innerHTML = `<div class="quiz-modal probe-modal" role="dialog">
    <p class="probe-eyebrow">Not what you predicted</p>
    <h3 class="probe-title">How surprised are you by how that went?</h3>
    <div class="surprise-scale">${[1,2,3,4,5,6,7].map(n =>
      `<button class="surprise-btn" type="button">${n}</button>`).join("")}</div>
    <div class="surprise-anchors"><span>Not at all</span><span>Completely</span></div>
    <button class="probe-skip probe-skip-block">Close</button></div>`;
  document.body.appendChild(o);
  o.querySelectorAll(".surprise-btn").forEach(b =>
    b.addEventListener("click", () => {
      o.querySelectorAll(".surprise-btn").forEach(x => x.classList.toggle("selected", x === b));
    }));
  o.querySelector(".probe-skip").addEventListener("click", () => o.remove());
  o.addEventListener("click", e => { if (e.target === o) o.remove(); });
});

document.getElementById("d-recap").addEventListener("click", () => {
  const log = LOGS[mode].map(d => ({ ...d, flavor: "x", zone: "homeostasis" }));
  const r = buildRoundRecap(log.concat(log).slice(0, 6), Array(6).fill("homeostasis"), 1);
  const o = document.createElement("div");
  o.className = "quiz-overlay open";
  o.innerHTML = `<div class="quiz-modal recap-modal tone-${r.tone}" role="dialog">
    <p class="recap-eyebrow">Round ${r.roundNumber} complete</p>
    <h3 class="recap-headline">${r.headline}</h3>
    <p class="recap-facts">${r.factLine}</p>
    <div class="recap-takeaway"><span class="recap-takeaway-label">Worth carrying forward</span>
      <p>${r.takeaway}</p></div>
    <div class="recap-actions"><button class="btn btn-primary">Keep going</button></div>
    <button class="recap-dismiss">Close</button></div>`;
  document.body.appendChild(o);
  o.querySelector(".recap-dismiss").addEventListener("click", () => o.remove());
  o.querySelector(".btn").addEventListener("click", () => o.remove());
  o.addEventListener("click", e => { if (e.target === o) o.remove(); });
});

initHomeostasisChart();
seed("steady");
