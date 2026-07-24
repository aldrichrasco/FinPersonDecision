(async function () {
  const status = document.getElementById("admin-status");
  const content = document.getElementById("admin-content");
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { credentials: "include" });
    if (res.status === 403) {
      status.textContent = "You don't have admin access, or you're not signed in as an admin.";
      return;
    }
    if (!res.ok) throw new Error();
    const s = await res.json();
    const rows = (s.by_persona || []).map(p =>
      `<div class="log-row"><span class="log-choice">${esc(p.persona || "—")}</span><span class="log-delta">${p.count}</span></div>`
    ).join("");
    const h = s.homeostasis || {};
    const zoneBlock = h.zoned_total
      ? `
      <p class="chart-title" style="margin-top:26px;">PIPE homeostasis telemetry</p>
      <div class="metric-grid" style="margin:12px 0;">
        <div class="metric-card"><span class="metric-label">Decisions in zone</span><span class="metric-value">${h.in_zone_pct}%</span></div>
        <div class="metric-card"><span class="metric-label">Breakdown</span><span class="metric-value">${h.breakdown}</span></div>
        <div class="metric-card"><span class="metric-label">Distortion</span><span class="metric-value">${h.distortion}</span></div>
        <div class="metric-card"><span class="metric-label">PIPE triggers</span><span class="metric-value">${h.triggers}</span></div>
        <div class="metric-card"><span class="metric-label">Characteristic drift</span><span class="metric-value">${h.characteristic_drift}</span></div>
        <div class="metric-card"><span class="metric-label">Avg wellbeing</span><span class="metric-value">${h.avg_wellbeing ?? "—"}</span></div>
        <div class="metric-card"><span class="metric-label">Avg person–archetype gap</span><span class="metric-value">${h.avg_gap ?? "—"}</span></div>
      </div>`
      : `<p class="chart-title" style="margin-top:26px;">PIPE homeostasis telemetry</p>
         <p class="log-empty">No homeostasis data recorded yet. It appears once players make sandbox decisions.</p>`;

    const axisRows = (s.by_axis || []).map(a =>
      `<div class="log-row"><span class="log-choice">${esc(a.axis || "—")}</span><span class="log-delta">${a.count} decisions, avg wellbeing ${a.avg_wellbeing ?? "—"}</span></div>`
    ).join("");
    const axisBlock = (s.by_axis || []).length
      ? `<p class="chart-title" style="margin-top:26px;">Decisions by FBM axis</p>
         <div class="change-log">${axisRows}</div>`
      : `<p class="chart-title" style="margin-top:26px;">Decisions by FBM axis</p>
         <p class="log-empty">No axis-tagged decisions yet.</p>`;

    const qad = s.quiz_archetype_distance || {};
    const quizDistanceBlock = `
      <p class="chart-title" style="margin-top:26px;">Quiz-profile archetype distance</p>
      <div class="metric-grid" style="margin:12px 0;">
        <div class="metric-card"><span class="metric-label">Quiz snapshots</span><span class="metric-value">${qad.snapshot_count ?? 0}</span></div>
        <div class="metric-card"><span class="metric-label">Avg archetype closeness</span><span class="metric-value">${qad.avg_closeness_pct != null ? qad.avg_closeness_pct + "%" : "—"}</span></div>
      </div>`;

    content.innerHTML = `
      <h1 style="font-family:var(--font-display);font-weight:500;">Overview</h1>
      <div class="metric-grid" style="margin:20px 0;">
        <div class="metric-card"><span class="metric-label">Total users</span><span class="metric-value">${s.total_users}</span></div>
        <div class="metric-card"><span class="metric-label">Total decisions</span><span class="metric-value">${s.total_choices}</span></div>
        <div class="metric-card"><span class="metric-label">Decisions (24h)</span><span class="metric-value">${s.choices_24h}</span></div>
        <div class="metric-card"><span class="metric-label">Active sandboxes</span><span class="metric-value">${s.active_sandboxes}</span></div>
      </div>
      ${zoneBlock}
      ${axisBlock}
      ${quizDistanceBlock}
      <p class="chart-title">Decisions by persona</p>
      <div class="change-log">${rows || '<p class="log-empty">No data yet.</p>'}</div>
    `;
  } catch (e) {
    status.textContent = "Couldn't load admin stats. Is the backend running?";
  }
})();
