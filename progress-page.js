(function () {
  const content = document.getElementById("progress-content");
  const status = document.getElementById("progress-status");
  const saved = getProfile();
  const history = getCapabilityHistory();

  if (!saved) {
    status.innerHTML = `You haven't taken the quiz yet. <a href="index.html">Take the 30-second quiz</a> to set your baseline.`;
    return;
  }

  const primary = PERSONAS.find(p => p.slug === saved.archetype);
  const first = history.length ? history[0].capability : saved.capability;
  const latest = saved.capability;
  const change = latest - first;
  const changeLabel = change > 0 ? `+${change}` : `${change}`;
  const changeClass = change > 0 ? "status-good" : change < 0 ? "status-bad" : "status-watch";

  const axisRows = AXIS_KEYS.map(k => {
    const v = saved.profile[k] ?? 50;
    return `
      <div class="axis-row">
        <div class="axis-top">
          <span class="axis-label">${esc(AXES[k].label)}<span class="axis-sub">${esc(AXES[k].sub)}</span></span>
          <span class="axis-read">${esc(describeAxis(k, v))}</span>
        </div>
        <div class="axis-track"><div class="axis-fill" style="width:${v}%"></div></div>
      </div>`;
  }).join("");

  const daysTracked = history.length > 1
    ? Math.max(1, Math.round((history[history.length - 1].at - history[0].at) / 86400000))
    : 0;

  const trendWord = change > 3 ? "moving in a good direction"
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
      <div class="pattern-panel tone-neutral" style="margin-bottom:26px;">
        <p class="pattern-body" style="font-size:15px;color:var(--ink);">
          You've engaged ${cal.modelsEngaged} money belief(s) in the sandbox. Right now, on average, you're at:
          <strong>${esc(C_LEVELS_PLAIN[nearestCLevel(cal.meanRecognitionRank)].title)}</strong>${cal.modelsTransferred ? ` — and ${cal.modelsTransferred} of these held up across different situations, not just one` : ""}.
        </p>
        <p class="pattern-body" style="font-size:13px;color:var(--slate);margin-top:8px;">
          <a href="model.html#calibration">What do these stages mean? &rarr;</a>
        </p>
      </div>` : `
      <p class="chart-title">Catching it before it happens</p>
      <div class="pattern-panel tone-neutral" style="margin-bottom:26px;">
        <p class="pattern-body" style="font-size:14px;color:var(--slate);">Make a few more sandbox decisions with predictions to see this here. <a href="model.html#calibration">What is this? &rarr;</a></p>
      </div>`;
  }
  const cal = typeof calibrationSummary === "function" ? calibrationSummary() : null;
  // Personal finance diary (dashboard.js's goal-diary) — currently
  // localStorage-only and scoped per-persona, never surfaced outside the
  // sandbox. Pull it together here across every persona the person has used.
  function loadGoalDiaryAcrossPersonas() {
    try {
      const diary = JSON.parse(localStorage.getItem("finperson_goal_diary")) || {};
      const all = [];
      Object.entries(diary).forEach(([slug, entries]) => {
        (entries || []).forEach(e => all.push({ ...e, persona: slug }));
      });
      return all;
    } catch (e) {
      return [];
    }
  }
  const goals = loadGoalDiaryAcrossPersonas();
  const goalsHtml = goals.length ? `
    <p class="chart-title">Your personal finance diary</p>
    <div class="pattern-panel tone-neutral" style="margin-bottom:26px;">
      <p class="pattern-body" style="font-size:13px;color:var(--slate);margin:0 0 10px;">
        ${goals.filter(g => g.done).length} of ${goals.length} goal(s) done, across every persona you've practiced with.
      </p>
      <ul class="goal-list" style="margin:0;">
        ${goals.map(g => `<li class="goal-entry ${g.done ? "goal-done" : ""}"><label><input type="checkbox" disabled ${g.done ? "checked" : ""}><span>${esc(g.title)}</span></label>${g.note ? `<p>${esc(g.note)}</p>` : ""}</li>`).join("")}
      </ul>
    </div>` : "";

  content.innerHTML = `
    <div class="pattern-panel tone-${change >= 0 ? "good" : "watch"}" style="margin-bottom:26px;">
      <p class="pattern-headline">Since you started, you've ${trendWord}.</p>
      <p class="pattern-body">${
        history.length > 1
          ? "That's based on how you've answered over time — retake the questions whenever you like and it'll update."
          : "Come back and answer the questions again after some practice, and you'll see how this shifts."
      }</p>
    </div>

    <p class="chart-title">How you've been tracking</p>
    <canvas id="cap-chart" width="820" height="160" style="width:100%;height:160px;margin-bottom:28px;"></canvas>

    <p class="chart-title">Your real sandbox trajectory</p>
    <p class="scenario-empty-body" id="wellbeing-chart-status" style="font-size:13px;">Loading your sandbox history…</p>
    <canvas id="wellbeing-chart" width="820" height="160" style="width:100%;height:160px;margin-bottom:28px;display:none;"></canvas>

    <div id="calibration-slot">${calibrationHtmlFor(cal)}</div>

    ${goalsHtml}

    <p class="chart-title">What I picked up about you</p>
    <div class="pattern-panel tone-neutral" style="margin-bottom:26px;">
      <p class="pattern-body" style="font-size:15px;color:var(--ink);">${esc(characterise(saved.profile, saved.archetype))}</p>
    </div>

    <div class="sandbox-card" style="border-radius:16px;">
      <div>
        <h3 style="font-family:var(--font-display);font-weight:500;margin:0 0 6px;">Answer them again?</h3>
        <p style="margin:0;color:#C7CEDB;font-size:14px;">People change. Re-answering is how you see whether you have.</p>
      </div>
      <a class="btn btn-primary" href="index.html" style="background:var(--marigold);color:var(--marigold-ink);">Retake</a>
    </div>
  `;

  // Draw the capability trend.
  const canvas = document.getElementById("cap-chart");
  const pts = history.length ? history.map(h => h.capability) : [latest];
  drawTrend(canvas, pts, "Take the quiz again later to see your trend.");

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
    const line = styles.getPropertyValue("--teal").trim() || "#0F5C55";
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
      ctx.fillStyle = muted; ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillText(String(v), 4, y + 3);
    });
    if (values.length < 2) {
      ctx.fillStyle = muted; ctx.font = "13px 'IBM Plex Sans', sans-serif";
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
