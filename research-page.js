(async function () {
  const status = document.getElementById("research-status");
  const body = document.getElementById("research-body");

  // Gated behind the same admin check as the admin dashboard.
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { credentials: "include" });
    if (res.status === 403) {
      status.textContent = "Research view is restricted. Sign in as an admin to view model internals.";
      return;
    }
    if (!res.ok) throw new Error();
    const stats = await res.json();
    const h = stats.homeostasis || {};

    body.innerHTML = `
      <p class="chart-title">Homeostasis model</p>
      <div class="metric-grid" style="margin:12px 0 26px;">
        <div class="metric-card"><span class="metric-label">Zone bounds</span><span class="metric-value">${HOMEOSTASIS.lower}–${HOMEOSTASIS.upper}</span></div>
        <div class="metric-card"><span class="metric-label">Midpoint</span><span class="metric-value">${HOMEOSTASIS.mid}</span></div>
        <div class="metric-card"><span class="metric-label">In-zone rate</span><span class="metric-value">${h.in_zone_pct ?? "—"}%</span></div>
        <div class="metric-card"><span class="metric-label">Triggers</span><span class="metric-value">${h.triggers ?? 0}</span></div>
        <div class="metric-card"><span class="metric-label">Characteristic drift</span><span class="metric-value">${h.characteristic_drift ?? 0}</span></div>
        <div class="metric-card"><span class="metric-label">Mean wellbeing</span><span class="metric-value">${h.avg_wellbeing ?? "—"}</span></div>
        <div class="metric-card"><span class="metric-label">Mean gap</span><span class="metric-value">${h.avg_gap ?? "—"}</span></div>
      </div>

      <p class="chart-title">Instrumented trajectory (sample)</p>
      <figure class="chart-block" style="margin-top:10px;">
        <div class="chart-stage">
          <canvas id="homeostasis-chart" role="img" tabindex="0" aria-label="Instrumented trajectory"></canvas>
          <div class="chart-overlay" aria-hidden="true">
            <div id="chart-callouts"></div>
            <div class="chart-tooltip" id="chart-tooltip" hidden></div>
          </div>
        </div>
        <div class="chart-legend">
          <span class="lg lg-observed">Observed</span>
          <span class="lg lg-archetype">Archetype-expected</span>
          <span class="lg lg-recal">Recalibrated</span>
          <span class="lg lg-trigger">PIPE trigger</span>
        </div>
        <div class="sr-only" id="chart-live" aria-live="polite"></div>
        <details class="chart-data-toggle">
          <summary>Data table</summary>
          <div class="chart-table-wrap"><table id="chart-data-table"></table></div>
        </details>
      </figure>

      <p class="chart-title" style="margin-top:26px;">Archetype expected positions</p>
      <div class="axis-block" id="arch-positions"></div>

      <p class="chart-title" style="margin-top:32px;">Capability trajectory</p>
      <p class="trajectory-note">The dependent variables for the calibration claim.
      Financial outcomes are secondary — capability is measured as calibration
      relocating from post-hoc to anticipatory.</p>
      <div class="trajectory-grid" id="trajectory-grid">
        <div class="traj-card"><span class="traj-label">Prediction accuracy</span>
          <span class="traj-value" id="tj-acc">—</span>
          <span class="traj-dir">self-knowledge ↑</span></div>
        <div class="traj-card"><span class="traj-label">Confidence–accuracy gap</span>
          <span class="traj-value" id="tj-gap">—</span>
          <span class="traj-dir">toward zero</span></div>
        <div class="traj-card"><span class="traj-label">Mean recognition level</span>
          <span class="traj-value" id="tj-c">—</span>
          <span class="traj-dir">C0 → C3 ↑</span></div>
        <div class="traj-card"><span class="traj-label">Anticipatory rate (C3)</span>
          <span class="traj-value" id="tj-c3">—</span>
          <span class="traj-dir">↑</span></div>
        <div class="traj-card"><span class="traj-label">Mean surprise</span>
          <span class="traj-value" id="tj-sur">—</span>
          <span class="traj-dir">↓ as models calibrate</span></div>
        <div class="traj-card"><span class="traj-label">Transfer (2+ surfaces)</span>
          <span class="traj-value" id="tj-tr">—</span>
          <span class="traj-dir">↑</span></div>
        <div class="traj-card"><span class="traj-label">Scaffolding required</span>
          <span class="traj-value" id="tj-scaf">—</span>
          <span class="traj-dir">↓ without quality loss</span></div>
        <div class="traj-card"><span class="traj-label">Decisions probed</span>
          <span class="traj-value" id="tj-probed">—</span>
          <span class="traj-dir">DLO-selected</span></div>
      </div>

      <p class="chart-title" style="margin-top:26px;">Study recruitment</p>
      <div id="study-panel"><p class="log-empty">Loading…</p></div>

      <p class="chart-title" style="margin-top:26px;">Data export</p>
      <div class="export-row">
        <a class="btn btn-secondary" href="${API_BASE_URL}/api/study/export/participants">Participants</a>
        <a class="btn btn-secondary" href="${API_BASE_URL}/api/study/export/events">Events</a>
        <a class="btn btn-secondary" href="${API_BASE_URL}/api/study/export/responses">Instrument responses</a>
        <a class="btn btn-secondary" href="${API_BASE_URL}/api/study/export/decisions">Decisions</a>
        <a class="btn btn-secondary" href="${API_BASE_URL}/api/study/export/calibration">Calibration</a>
      </div>
      <p class="export-note">CSV, pseudonymised by study code. Arm is joined in so
      analysis can be run without a separate allocation file.</p>

      <details class="pipe-rail" style="margin-top:26px;">
        <summary>
          <span class="pipe-rail-title">PIPE tenets</span>
          <span class="pipe-rail-hint">4</span>
        </summary>
        <ul class="pipe-tenets">
          <li><strong>Persuasion</strong><span>Guides meaning and choice framing</span></li>
          <li><strong>Immersion</strong><span>Makes pressure experientially felt</span></li>
          <li><strong>Personalisation</strong><span>Connects feedback to tendencies</span></li>
          <li><strong>Evolution</strong><span>Supports adjustment over repeated decisions</span></li>
        </ul>
      </details>
    `;

    // Render each archetype's expected position on the wellbeing axis.
    document.getElementById("arch-positions").innerHTML = Object.keys(ARCHETYPE_PROFILES).map(slug => {
      const pos = archetypeExpectedScore(ARCHETYPE_PROFILES[slug], slug);
      const g = ARCHETYPE_GAPS[slug];
      return `<div class="axis-row">
        <div class="axis-top">
          <span class="axis-label">${esc(slug.replace(/_/g, " "))}<span class="axis-sub">drifts toward ${esc(g.drift)}</span></span>
          <span class="axis-read">${pos}</span>
        </div>
        <div class="axis-track"><div class="axis-fill" style="width:${pos}%"></div></div>
      </div>`;
    }).join("");

    // Illustrative trajectory so the instrument is legible without live data.
    setChartMode("research");
    initHomeostasisChart();
    const observed = [52, 48, 41, 33, 28, 36, 44, 50, 58, 63];
    const archetype = observed.map(() => 45);
    const recalibrated = observed.map(v => recalibrate(v));
    const trig = [];
    for (let i = 1; i < observed.length; i++) {
      const t = detectTrigger(observed[i - 1], observed[i]);
      if (t) trig.push({ index: i, ...t });
    }
    renderHomeostasisChart({ observed, archetype, recalibrated, triggers: trig });

    // Capability trajectory from the calibration export
    try {
      const cres = await fetch(`${API_BASE_URL}/api/study/export/calibration`, { credentials: "include" });
      if (cres.ok) {
        const rows = (await cres.text()).trim().split("\n").slice(1)
          .map(l => l.split(",")).filter(r => r.length > 12);
        if (rows.length) {
          const num = (r, i) => { const v = parseFloat(r[i]); return isNaN(v) ? null : v; };
          const correct = rows.filter(r => r[9] === "1").length;
          const withPred = rows.filter(r => r[9] === "1" || r[9] === "0").length;
          const confs = rows.map(r => num(r, 10)).filter(v => v !== null);
          const surs = rows.map(r => num(r, 11)).filter(v => v !== null);
          const cs = rows.map(r => r[12]).filter(v => /^C[0-3]$/.test(v));
          const cRank = cs.map(v => +v[1]);
          const acc = withPred ? correct / withPred : null;
          const meanConf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
          const principles = {};
          rows.forEach(r => { (principles[r[3]] = principles[r[3]] || new Set()).add(r[4]); });
          const transferred = Object.values(principles).filter(s => s.size >= 2).length;
          const scaffolded = rows.filter(r => r[12] === "C0" || r[12] === "C1").length;

          const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
          set("tj-acc", acc === null ? "—" : `${Math.round(acc * 100)}%`);
          set("tj-gap", (meanConf === null || acc === null) ? "—" : (meanConf - acc >= 0 ? "+" : "") + (meanConf - acc).toFixed(2));
          set("tj-c", cRank.length ? (cRank.reduce((a, b) => a + b, 0) / cRank.length).toFixed(2) : "—");
          set("tj-c3", cs.length ? `${Math.round(cs.filter(v => v === "C3").length / cs.length * 100)}%` : "—");
          set("tj-sur", surs.length ? (surs.reduce((a, b) => a + b, 0) / surs.length).toFixed(1) : "—");
          set("tj-tr", `${transferred} of ${Object.keys(principles).length}`);
          set("tj-scaf", cs.length ? `${Math.round(scaffolded / cs.length * 100)}%` : "—");
          set("tj-probed", `${withPred} of ${rows.length}`);
        }
      }
    } catch (e) { /* no calibration data yet */ }

    // Recruitment monitoring
    try {
      const sres = await fetch(`${API_BASE_URL}/api/study/summary`, { credentials: "include" });
      if (sres.ok) {
        const st = await sres.json();
        const arms = st.by_arm || {};
        document.getElementById("study-panel").innerHTML = `
          <div class="metric-grid" style="margin:12px 0;">
            <div class="metric-card"><span class="metric-label">Consented</span><span class="metric-value">${st.consented}</span></div>
            <div class="metric-card"><span class="metric-label">Full arm</span><span class="metric-value">${arms.full || 0}</span></div>
            <div class="metric-card"><span class="metric-label">Ablated arm</span><span class="metric-value">${arms.ablated || 0}</span></div>
            <div class="metric-card"><span class="metric-label">Control arm</span><span class="metric-value">${arms.control || 0}</span></div>
            <div class="metric-card"><span class="metric-label">Withdrawn</span><span class="metric-value">${st.withdrawn}</span></div>
            <div class="metric-card"><span class="metric-label">Events captured</span><span class="metric-value">${st.events}</span></div>
            <div class="metric-card"><span class="metric-label">Consent version</span><span class="metric-value">${st.consent_version}</span></div>
          </div>`;
      }
    } catch (e) { /* study tables may not be populated yet */ }
  } catch (e) {
    status.textContent = "Couldn't load model internals. Is the backend running?";
  }
})();
