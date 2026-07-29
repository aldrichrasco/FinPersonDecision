// Your Full Money Personality Report — synthesizes everything the app
// already knows (quiz profile, archetype match/gap, calibration progress,
// achievements) into one document worth printing or saving as a PDF.
// Deliberately not gated behind a fake paywall: this app never processes a
// payment itself (see donate.html), so the honest version of "monetize
// this" is to make the report itself excellent, then ask for support at
// the moment it's delivered the most value — not to fake-lock content a
// static site has no real way to unlock.
(function () {
  const content = document.getElementById("report-content");
  const saved = getProfile();

  if (!saved) {
    content.innerHTML = `<p class="scenario-empty-body">You haven't taken the quiz yet. <a href="index.html">Take the 30-second quiz</a> to generate your report.</p>`;
    return;
  }

  const persona = PERSONAS.find(p => p.slug === saved.archetype);
  const profile = saved.profile || {};
  const cal = typeof calibrationSummary === "function" ? calibrationSummary() : null;
  const gapInfo = (typeof ARCHETYPE_GAPS !== "undefined" && ARCHETYPE_GAPS[saved.archetype]) || null;
  const history = typeof getCapabilityHistory === "function" ? getCapabilityHistory() : [];
  const generatedDate = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const axisEntries = AXIS_KEYS.map(k => ({ key: k, value: Math.round(profile[k] ?? 50), meta: AXES[k] }));
  const strengths = axisEntries.filter(a => a.value >= 60).sort((a, b) => b.value - a.value);
  const growthAreas = axisEntries.filter(a => a.value <= 40).sort((a, b) => a.value - b.value);

  const C_ORDER = ["C0", "C1", "C2", "C3"];
  function nearestCLevel(rank) {
    return C_ORDER[Math.round(Math.max(0, Math.min(3, rank || 0)))];
  }

  const unlockedIds = (() => {
    try { return JSON.parse(localStorage.getItem("finperson_achievements")) || []; } catch (e) { return []; }
  })();
  const unlockedAchievements = (typeof ACHIEVEMENTS !== "undefined" ? ACHIEVEMENTS : []).filter(a => unlockedIds.includes(a.id));

  const axisRowHtml = axisEntries.map(a => `
    <div class="report-axis-row">
      <div class="report-axis-row-head">
        <span class="report-axis-dot" style="background:${a.value >= 60 ? "var(--teal)" : a.value <= 40 ? "var(--brick)" : "var(--slate)"}"></span>
        <span class="report-axis-label">${esc(a.meta.label)}</span>
        <span class="report-axis-value">${a.value}</span>
      </div>
      <div class="report-axis-poles">
        <span>${esc(a.meta.low)}</span>
        <div class="model-axis-scale" style="--axis-accent:${a.value >= 60 ? "var(--teal)" : a.value <= 40 ? "var(--brick)" : "var(--slate)"};">
          <span class="model-axis-marker" style="left:${a.value}%;pointer-events:none;"></span>
        </div>
        <span>${esc(a.meta.high)}</span>
      </div>
    </div>`).join("");

  const strengthsHtml = strengths.length
    ? strengths.map(a => `<li>${esc(a.meta.label)} <span class="report-inline-value">(${a.value})</span></li>`).join("")
    : `<li>No axis reads as a clear strength yet — that's normal early on, and shifts as you practice.</li>`;

  const growthHtml = growthAreas.length
    ? growthAreas.map(a => `<li><a href="learn.html#${esc(a.key)}">${esc(a.meta.label)}</a> <span class="report-inline-value">(${a.value})</span></li>`).join("")
    : `<li>Nothing reads as a clear growth area right now — every axis is at least moderate.</li>`;

  const gapHtml = gapInfo ? `
    <div class="report-gap">
      <p><strong>Typically:</strong> ${esc(gapInfo.baseline)}</p>
      <p><strong>Under pressure:</strong> ${esc(gapInfo.observed)}</p>
      <p><strong>Characteristic risk:</strong> ${esc(gapInfo.gap)} <span class="report-inline-value">(drifts toward ${esc(gapInfo.drift)})</span></p>
    </div>` : "";

  const calHtml = cal ? `
    <p class="report-body">You've engaged <strong>${cal.modelsEngaged}</strong> money belief${cal.modelsEngaged === 1 ? "" : "s"} in the sandbox. On average, you're currently at:</p>
    <p class="report-clevel-badge">${esc(C_LEVELS_PLAIN[nearestCLevel(cal.meanRecognitionRank)].title)}</p>
    <p class="report-body" style="color:var(--slate);font-size:14px;">${esc(C_LEVELS_PLAIN[nearestCLevel(cal.meanRecognitionRank)].detail)}</p>
    ${cal.modelsTransferred ? `<p class="report-body">${cal.modelsTransferred} of these held up across different situations, not just one — that's real transfer, not a one-off.</p>` : ""}
    <p class="report-body"><a href="model.html#calibration">What do these stages mean? &rarr;</a></p>
  ` : `<p class="scenario-empty-body">Make a few sandbox decisions with predictions to see your calibration progress here. <a href="dashboard.html">Open the sandbox &rarr;</a></p>`;

  const achievementsHtml = unlockedAchievements.length
    ? `<div class="report-badges">${unlockedAchievements.map(a => `<span class="report-badge" title="${esc(a.description)}">${a.icon} ${esc(a.title)}</span>`).join("")}</div>`
    : `<p class="scenario-empty-body">No badges yet — <a href="achievements.html">see what's available &rarr;</a></p>`;

  const trendLine = history.length > 1
    ? `Your capability score has moved from ${history[0].capability} to ${saved.capability} over ${history.length} check-ins.`
    : `This is your first recorded snapshot — retake the quiz later to see how it shifts.`;

  content.innerHTML = `
    <div class="report-header">
      <div class="report-portrait" id="report-portrait" aria-hidden="true"></div>
      <div>
        <p class="scenario-eyebrow">Your money personality report</p>
        <h1 style="font-family:var(--font-display);font-weight:500;margin:0 0 4px;">${esc(persona ? persona.name : "Your archetype")}</h1>
        <p class="lede" style="font-size:15px;margin:0;">${esc(persona ? persona.trait : "")}</p>
        <p class="report-meta">Generated ${generatedDate}</p>
      </div>
      <button class="btn btn-secondary report-print-btn" id="report-print-btn" type="button">Save / print report</button>
    </div>

    <section class="report-section">
      <p class="chart-title">The short version</p>
      <p class="report-body" style="font-size:16px;">${esc(characterise(profile, saved.archetype))}</p>
      <p class="report-body" style="color:var(--slate);font-size:14px;">${esc(trendLine)}</p>
    </section>

    <section class="report-section">
      <p class="chart-title">Your six axes</p>
      <div class="report-radar-wrap">
        <canvas id="report-radar" width="360" height="360" style="width:100%;max-width:260px;height:auto;aspect-ratio:1;display:block;margin:0 auto;"></canvas>
      </div>
      <div class="report-axes-list">${axisRowHtml}</div>
    </section>

    <section class="report-section report-columns">
      <div>
        <p class="chart-title">Strengths</p>
        <ul class="report-list">${strengthsHtml}</ul>
      </div>
      <div>
        <p class="chart-title">Growth areas</p>
        <ul class="report-list">${growthHtml}</ul>
      </div>
    </section>

    ${gapInfo ? `
    <section class="report-section">
      <p class="chart-title">Where you match the ${esc(persona.name)} pattern, and where you don't</p>
      ${gapHtml}
    </section>` : ""}

    <section class="report-section">
      <p class="chart-title">Catching it before it happens</p>
      ${calHtml}
    </section>

    <section class="report-section">
      <p class="chart-title">Badges earned</p>
      ${achievementsHtml}
    </section>

    <section class="report-section report-support no-print">
      <p class="chart-title">If this was useful</p>
      <p class="report-body">FinPerson is free, ad-free, and doesn't sell your data. If this report was worth having, the best way to help keep it that way is a small one-off or monthly show of support.</p>
      <a class="btn btn-primary" href="donate.html">Support FinPerson &rarr;</a>
    </section>
  `;

  document.getElementById("report-print-btn").addEventListener("click", () => window.print());

  const portraitEl = document.getElementById("report-portrait");
  if (persona && typeof archetypePortraitSvg === "function") {
    portraitEl.innerHTML = archetypePortraitSvg(persona.slug, persona.group);
  }

  const radarCanvas = document.getElementById("report-radar");
  if (radarCanvas && typeof animateRadarChart === "function") {
    animateRadarChart(radarCanvas, profile, {});
  }
})();
