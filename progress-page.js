(async function () {
  const content = document.getElementById("progress-content");
  const status = document.getElementById("progress-status");
  const saved = await syncProfileFromServer();
  const history = getCapabilityHistory();
  const nudgeEntries = typeof fetchProfileNudgeLog === "function" ? await fetchProfileNudgeLog() : [];

  if (!saved) {
    status.innerHTML = `You haven't taken the quiz yet. <a href="index.html">Take the quick quiz</a> to set your baseline.`;
    return;
  }

  if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete("progress-review");

  const primary = PERSONAS.find(p => p.slug === saved.archetype);
  const first = history.length ? history[0].capability : saved.capability;
  const latest = saved.capability;
  const change = latest - first;
  const changeLabel = change > 0 ? `+${change}` : `${change}`;
  const changeClass = change > 0 ? "status-good" : change < 0 ? "status-bad" : "status-watch";

  const daysTracked = history.length > 1
    ? Math.max(1, Math.round((history[history.length - 1].at - history[0].at) / 86400000))
    : 0;

  const trendWord = change > 3 ? "been moving in a good direction"
    : change < -3 ? "drifted a bit"
    : "held fairly steady";

  // Calibration summary (idm.js). Was localStorage-only; now merges the
  // server's copy first (syncIDMFromServer) so a signed-in user sees their
  // real calibration even on a new device. Rendered into its own slot so it
  // can be refreshed once the (async) sync resolves, without rebuilding the
  // whole page.
  const C_ORDER = ["C0", "C1", "C2", "C3"];
  function nearestCLevel(rank) {
    const r = Math.round(Math.max(0, Math.min(3, rank)));
    return C_ORDER[r];
  }
  function calibrationHtmlFor(cal) {
    return cal ? `
      <p class="chart-title">Catching it before it happens</p>
      <div class="pattern-panel tone-neutral">
        <p class="pattern-body" style="font-size:15px;color:var(--ink);">
          You've engaged ${cal.modelsEngaged} money belief(s) in the sandbox. Right now, on average, you're at:
          <strong>${esc(C_LEVELS_PLAIN[nearestCLevel(cal.meanRecognitionRank)].title)}</strong>${cal.modelsTransferred ? ` — and ${cal.modelsTransferred} of these held up across different situations, not just one` : ""}.
        </p>
        <p class="pattern-body" style="font-size:13px;color:var(--slate);margin-top:8px;">
          <a href="model.html#calibration">What do these stages mean? &rarr;</a>
        </p>
      </div>` : `
      <p class="chart-title">Catching it before it happens</p>
      <div class="pattern-panel tone-neutral">
        <p class="pattern-body" style="font-size:14px;color:var(--slate);">Make a few more sandbox decisions with predictions to see this here. <a href="model.html#calibration">What is this? &rarr;</a></p>
      </div>`;
  }
  const cal = typeof calibrationSummary === "function" ? calibrationSummary() : null;
  // A short summary here, not the full list — the Goals tab (goals-page.js)
  // is the real, editable home for these now. Goals are the user's own, not
  // scoped to any sandbox persona; see goals.js for the shared storage.
  const goals = typeof loadGoals === "function" ? loadGoals() : [];
  const goalsHtml = goals.length ? `
    <p class="chart-title">Your goals</p>
    <div class="pattern-panel tone-neutral">
      <p class="pattern-body" style="font-size:15px;color:var(--ink);">
        ${goals.filter(g => g.done).length} of ${goals.length} goal(s) done.
      </p>
      <p class="pattern-body" style="font-size:13px;color:var(--slate);margin-top:8px;">
        <a href="#" data-open-goals-tab>Open your goals &rarr;</a>
      </p>
    </div>` : "";

  // A small, honest "living twin" read of real tracked trend data — see
  // companion.js for why it only speaks in specifics it can actually back
  // with data, and why a dip is framed as "worth a look" rather than a
  // failure. Rendered from the quiz-profile portrait already used elsewhere
  // (archetype-portraits.js), not a new art asset.
  function companionCardHtml(state) {
    if (!state) return "";
    const portrait = (primary && typeof archetypePortraitSvg === "function")
      ? archetypePortraitSvg(primary.slug, primary.group) : "";
    return `
      <div class="companion-card companion-glow-${esc(state.glow)}">
        <div class="companion-portrait-wrap"><div class="companion-portrait">${portrait}</div></div>
        <div class="companion-copy">
          <span class="companion-badge companion-badge-${esc(state.glow)}">${esc(state.badge)}</span>
          <p class="companion-headline">${esc(state.headline)}</p>
          <p class="companion-detail">${esc(state.detail)}</p>
        </div>
      </div>`;
  }
  const companionState = typeof computeCompanionState === "function"
    ? computeCompanionState({ history, currentArchetype: saved.archetype }) : null;

  // Classroom games can nudge a signed-in user's own axis scores (see
  // nudgeAxis() in classroom-page.js) — this gives that "tentative" note a
  // permanent home instead of a one-time toast that vanishes on navigation.
  const nudgeHtml = nudgeEntries.length ? `
    <p class="chart-title">Recent adjustments</p>
    <div class="pattern-panel tone-neutral">
      ${nudgeEntries.slice(0, 5).map(n => {
        const label = (typeof AXES !== "undefined" && AXES[n.axis]) ? AXES[n.axis].label : n.axis;
        const sign = n.delta >= 0 ? "+" : "";
        const when = new Date(n.created_at * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return `<p class="pattern-body" style="font-size:13.5px;color:var(--ink);margin:4px 0;">${esc(label)} ${sign}${n.delta} <span style="color:var(--slate);">— ${when}, from a classroom game</span></p>`;
      }).join("")}
      <p class="pattern-body" style="font-size:12.5px;color:var(--slate);margin-top:8px;">Each one's tentative — a single game, not a full re-test.</p>
    </div>` : "";

  // A bento grid instead of one long single-column stack — the trend
  // chart (the thing most worth a second look) gets the largest tile,
  // everything else sizes to how much room it actually needs rather than
  // all being full-width regardless of content.
  content.innerHTML = `
    <div class="bento-grid">
      <div class="bento-tile bento-trend">
        <p class="chart-title">How you've been tracking</p>
        <p class="chart-sub" style="margin:-6px 0 12px;font-size:13px;color:var(--slate);">Your capability score (0-100) each time you've answered the questions.</p>
        <canvas id="cap-chart" width="820" height="160" style="width:100%;height:160px;"></canvas>
      </div>

      <div class="bento-tile bento-headline pattern-panel tone-${change >= 0 ? "good" : "watch"}">
        <p class="pattern-headline">Since you started, you've ${trendWord}.</p>
        <p class="pattern-body">${
          history.length > 1
            ? "That's based on how you've answered over time — retake the questions whenever you like and it'll update."
            : "Come back and answer the questions again after some practice, and you'll see how this shifts."
        }</p>
      </div>

      <div class="bento-tile bento-radar">
        <p class="chart-title">Your six axes</p>
        <p class="chart-sub" style="margin:-6px 0 12px;font-size:13px;color:var(--slate);">A faded point means less consistent sandbox decisions on that axis.</p>
        <canvas id="radar-chart" width="360" height="360" style="width:100%;max-width:280px;height:auto;aspect-ratio:1;display:block;margin:0 auto;"></canvas>
      </div>

      <div class="bento-tile bento-character">
        <p class="chart-title">What I picked up about you</p>
        <p class="pattern-body" style="font-size:14.5px;color:var(--ink);">${esc(characterise(saved.profile, saved.archetype))}</p>
      </div>

      <div class="bento-tile bento-companion" id="companion-slot">${companionCardHtml(companionState)}</div>

      <div class="bento-tile bento-wellbeing">
        <p class="chart-title">Your real sandbox trajectory</p>
        <p class="chart-sub" style="margin:-6px 0 12px;font-size:13px;color:var(--slate);">Your illustrative wellbeing score (0-100) after each real decision you've made — not a real balance, just the trend.</p>
        <p class="scenario-empty-body" id="wellbeing-chart-status" style="font-size:13px;">Loading your sandbox history…</p>
        <canvas id="wellbeing-chart" width="820" height="160" style="width:100%;height:160px;display:none;"></canvas>
      </div>

      <div class="bento-tile bento-calibration" id="calibration-slot">${calibrationHtmlFor(cal)}</div>

      <div class="bento-tile pattern-panel tone-neutral">
        <p class="pattern-headline" style="font-size:16px;">See it all in one place</p>
        <p class="pattern-body">Your archetype, six axes, calibration progress, and badges — synthesized into one report you can save or print.</p>
        <p class="pattern-body" style="margin-top:8px;"><a href="report.html">Open your full report &rarr;</a></p>
      </div>

      ${goalsHtml ? `<div class="bento-tile bento-goals">${goalsHtml}</div>` : ""}

      ${nudgeHtml ? `<div class="bento-tile bento-nudges">${nudgeHtml}</div>` : ""}

      <div class="bento-tile bento-cta sandbox-card">
        <div>
          <h3 style="font-family:var(--font-display);font-weight:500;margin:0 0 6px;">Answer them again?</h3>
          <p style="margin:0;color:#C7CEDB;font-size:14px;">People change. Re-answering is how you see whether you have. Or take the <a href="assessment.html" style="color:inherit;">full assessment</a> for a more precise read.</p>
        </div>
        <a class="btn btn-primary" href="index.html" style="background:var(--marigold);color:var(--marigold-contrast);">Retake</a>
      </div>
    </div>
  `;
  content.querySelector("[data-open-goals-tab]")?.addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("progress-tabbtn-goals")?.click();
  });

  // Draw the capability trend.
  const canvas = document.getElementById("cap-chart");
  const pts = history.length ? history.map(h => h.capability) : [latest];
  drawTrend(canvas, pts, "Take the quiz again later to see your trend.");

  // Radar: draw immediately from the quiz profile alone, then redraw once
  // per-axis consistency (signed-in only) resolves.
  const radarCanvas = document.getElementById("radar-chart");
  if (radarCanvas && typeof drawRadarChart === "function") {
    const animate = typeof animateRadarChart === "function" ? animateRadarChart : drawRadarChart;
    animate(radarCanvas, saved.profile, {});
    fetchAxisConsistency().then(byAxis => {
      drawRadarChart(radarCanvas, saved.profile, byAxis);
      const slot = document.getElementById("companion-slot");
      if (slot && typeof computeCompanionState === "function") {
        slot.innerHTML = companionCardHtml(computeCompanionState({
          history, axisConsistency: byAxis, currentArchetype: saved.archetype,
        }));
      }
    });
  }

  // Fetch and draw the real sandbox wellbeing trajectory (signed-in users
  // only — anonymous gets an empty array back and a clear explanation).
  fetchWellbeingHistory().then(wellbeingHistory => {
    const wStatus = document.getElementById("wellbeing-chart-status");
    const wCanvas = document.getElementById("wellbeing-chart");
    if (!wellbeingHistory.length) {
      wStatus.textContent = "Sign in and make a few sandbox decisions to see your real trajectory here.";
      return;
    }
    wStatus.style.display = "none";
    wCanvas.style.display = "";
    drawTrend(wCanvas, wellbeingHistory.map(h => h.wellbeing), "Make a few more decisions to see your trend.");
  });

  // Merge the server's IDM copy in, then refresh just the calibration slot —
  // covers the case where this is a new device with no local IDM history.
  if (typeof syncIDMFromServer === "function") {
    syncIDMFromServer().then(() => {
      const freshCal = typeof calibrationSummary === "function" ? calibrationSummary() : null;
      const slot = document.getElementById("calibration-slot");
      if (slot) slot.innerHTML = calibrationHtmlFor(freshCal);
    });
  }

  function drawTrend(canvas, values, emptyMessage) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 820, cssH = 160;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const styles = getComputedStyle(document.body);
    const line = styles.getPropertyValue("--teal").trim() || "#0B4A44";
    const grid = styles.getPropertyValue("--line").trim() || "rgba(0,0,0,0.1)";
    const muted = styles.getPropertyValue("--slate").trim() || "#666";
    const pad = 28, w = cssW, h = cssH;
    ctx.clearRect(0, 0, w, h);
    // capability/wellbeing are both 0-100, fixed scale
    const yFor = v => h - pad - (v / 100) * (h - pad * 2);
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    [0, 50, 100].forEach(v => {
      const y = yFor(v);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
      ctx.fillStyle = muted; ctx.font = "600 11.5px 'IBM Plex Mono', monospace";
      ctx.fillText(String(v), 4, y + 3);
    });
    if (values.length < 2) {
      ctx.fillStyle = muted; ctx.font = "14px 'IBM Plex Sans', sans-serif";
      ctx.fillText(emptyMessage || "", pad + 30, h / 2);
      // still plot the single point
    }
    const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    ctx.beginPath(); ctx.strokeStyle = line; ctx.lineWidth = 2;
    values.forEach((v, i) => {
      const x = pad + stepX * i, y = yFor(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = line;
    values.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(pad + stepX * i, yFor(v), 3.5, 0, Math.PI * 2); ctx.fill();
    });
  }
})();

// Trends/Milestones/Goals tabs — same show/hide pattern as model-page.js's
// showTab() and the sandbox drawer. Kept independent of the block above so
// switching still works even in the "haven't taken the quiz yet" state.
(function () {
  const PROGRESS_TABS = ["trends", "milestones", "goals"];
  function showProgressTab(name) {
    PROGRESS_TABS.forEach(t => {
      const panel = document.getElementById(`progress-tab-${t}`);
      const btn = document.getElementById(`progress-tabbtn-${t}`);
      if (panel) panel.hidden = t !== name;
      if (btn) btn.classList.toggle("active", t === name);
    });
  }
  PROGRESS_TABS.forEach(t => {
    const btn = document.getElementById(`progress-tabbtn-${t}`);
    if (btn) btn.addEventListener("click", () => showProgressTab(t));
  });
  const initial = PROGRESS_TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "trends";
  if (initial !== "trends") showProgressTab(initial);
})();
