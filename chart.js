// Homeostasis chart renderer.
//
// Canvas draws the plot (zone band, thresholds, three trajectories, markers).
// An HTML overlay carries the trigger callouts and the inspection tooltip so
// their text is real DOM — selectable, translatable, and reachable by assistive
// technology, which canvas-painted text never is.
//
// Accessibility model: the canvas is role="img" with a live-updating summary
// label; a visually-hidden table mirrors every plotted point; and the plot is
// keyboard-navigable (arrow keys move a cursor across decisions, announced via
// an aria-live region).

const CHART = {
  height: 240,
  padL: 46,
  padR: 16,
  padT: 22,
  padB: 40,
};

let chartCursor = -1;      // keyboard/hover inspection index; -1 = none
let chartData = null;      // last rendered dataset, for re-render on resize/theme
// 'simple' = what a learner sees (band only, no model vocabulary).
// 'research' = the full instrument, for the researcher view.
let chartMode = 'simple';
function setChartMode(m) { chartMode = m; }

function chartGeometry(canvas) {
  const w = canvas.clientWidth || 820;
  const h = CHART.height;
  const plotW = w - CHART.padL - CHART.padR;
  const plotH = h - CHART.padT - CHART.padB;
  return {
    w, h, plotW, plotH,
    yFor: v => CHART.padT + plotH - (v / 100) * plotH,
    xFor: (i, n) => CHART.padL + (n <= 1 ? plotW / 2 : (plotW / (n - 1)) * i),
  };
}

function tokens() {
  const s = getComputedStyle(document.body);
  const v = (name, fallback) => s.getPropertyValue(name).trim() || fallback;
  return {
    teal: v("--teal", "#0F5C55"),
    brick: v("--brick", "#B5482A"),
    plum: v("--plum", "#5A4B81"),
    ink: v("--ink", "#1B2A4A"),
    slate: v("--slate", "#6B6F76"),
    line: v("--line", "rgba(27,42,74,0.14)"),
  };
}

// ---------------------------------------------------------------- drawing

function renderHomeostasisChart(data, opts = {}) {
  const cursorOnly = opts.cursorOnly === true;
  chartData = data;
  const canvas = document.getElementById("homeostasis-chart");
  if (!canvas) return;

  const { observed = [], archetype = [], recalibrated = [], triggers = [] } = data || {};
  const g = chartGeometry(canvas);
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== g.w * dpr || canvas.height !== g.h * dpr) {
    canvas.width = g.w * dpr;
    canvas.height = g.h * dpr;
    canvas.style.height = g.h + "px";
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, g.w, g.h);

  const t = tokens();
  const n = observed.length;

  drawZoneAndThresholds(ctx, g, t);
  drawAxes(ctx, g, t);

  if (n === 0) {
    drawEmptyState(ctx, g, t);
    if (!cursorOnly) { updateChartAccessibility(data, g); positionCallouts([], g, n); }
    return;
  }

  if (chartMode === 'research') {
    drawTrack(ctx, g, archetype, n, t.plum, { dashed: true, width: 1.5, alpha: 0.85 });
    drawTrack(ctx, g, recalibrated, n, t.plum, { width: 2 });
  }
  drawTrack(ctx, g, observed, n, t.teal, { width: 2.5 });
  drawPoints(ctx, g, observed, n, t.teal);
  if (chartMode === 'research') {
    drawGapAnnotation(ctx, g, observed, archetype, n, t);
    drawTriggerMarkers(ctx, g, observed, n, triggers, t);
  }
  if (chartCursor >= 0 && chartCursor < n) drawCursor(ctx, g, observed, n, chartCursor, t);

  // Callouts and the a11y mirror only change when the data changes; skipping
  // them during pointer scrubbing avoids needless DOM churn on every frame.
  if (!cursorOnly) {
    positionCallouts(chartMode === 'research' ? triggers : [], g, n);
    updateChartAccessibility(data, g);
  }
}

function drawZoneAndThresholds(ctx, g, t) {
  const yUp = g.yFor(HOMEOSTASIS.upper);
  const yLo = g.yFor(HOMEOSTASIS.lower);

  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.fillStyle = t.teal;
  ctx.fillRect(CHART.padL, yUp, g.plotW, yLo - yUp);
  ctx.restore();

  // Zone boundary rules (solid, subtle)
  ctx.strokeStyle = t.teal;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  [yUp, yLo].forEach(y => {
    ctx.beginPath(); ctx.moveTo(CHART.padL, y); ctx.lineTo(g.w - CHART.padR, y); ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Threshold lines — dashed, brick, above/below the zone
  ctx.strokeStyle = t.brick;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.25;
  [HOMEOSTASIS.upper, HOMEOSTASIS.lower].forEach(v => {
    const y = g.yFor(v);
    ctx.beginPath(); ctx.moveTo(CHART.padL, y); ctx.lineTo(g.w - CHART.padR, y); ctx.stroke();
  });
  ctx.setLineDash([]);

  if (chartMode !== 'research') {
    // Learner view: the band is shown, but never named or numbered.
    if (yLo - yUp > 26) {
      ctx.fillStyle = t.teal;
      ctx.font = "500 10.5px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("comfortable range", CHART.padL + 8, (yUp + yLo) / 2 + 3);
    }
    return;
  }

  // In-band label, only when the band is tall enough to hold it
  if (yLo - yUp > 30) {
    ctx.fillStyle = t.teal;
    ctx.font = "600 11px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Financial Homeostasis Zone", CHART.padL + 8, (yUp + yLo) / 2 - 2);
    ctx.fillStyle = t.slate;
    ctx.font = "10px 'IBM Plex Sans', sans-serif";
    ctx.fillText("viable range of financial wellbeing", CHART.padL + 8, (yUp + yLo) / 2 + 12);
  }

  // Threshold captions
  ctx.fillStyle = t.brick;
  ctx.font = "500 9.5px 'IBM Plex Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("UPPER DISTORTION", CHART.padL + 8, g.yFor(HOMEOSTASIS.upper) - 6);
  ctx.fillText("LOWER BREAKDOWN", CHART.padL + 8, g.yFor(HOMEOSTASIS.lower) + 14);
}

function drawAxes(ctx, g, t) {
  if (chartMode === 'research') {
    ctx.fillStyle = t.slate;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "right";
    [0, 50, 100].forEach(v => ctx.fillText(String(v), CHART.padL - 8, g.yFor(v) + 3));
  } else {
    // Learners get direction, not a scale.
    ctx.fillStyle = t.slate;
    ctx.font = "9.5px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("more put by", CHART.padL - 8, CHART.padT + 8);
    ctx.fillText("less put by", CHART.padL - 8, CHART.padT + g.plotH);
  }

  // Y axis title (rotated)
  ctx.save();
  ctx.translate(13, CHART.padT + g.plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = t.slate;
  ctx.font = "500 10px 'IBM Plex Sans', sans-serif";
  ctx.fillText(chartMode === "research" ? "Financial wellbeing" : "", 0, 0);
  ctx.restore();

  // X axis title
  ctx.textAlign = "center";
  ctx.fillStyle = t.slate;
  ctx.font = "500 10px 'IBM Plex Sans', sans-serif";
  ctx.fillText("Repeated decisions →", CHART.padL + g.plotW / 2, g.h - 8);
}

function drawEmptyState(ctx, g, t) {
  ctx.fillStyle = t.slate;
  ctx.font = "13px 'IBM Plex Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "Your trajectory appears here as you decide.",
    CHART.padL + g.plotW / 2,
    CHART.padT + g.plotH / 2 + 34
  );
}

function drawTrack(ctx, g, track, n, color, opts = {}) {
  if (!track || track.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.width || 2;
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (opts.dashed) ctx.setLineDash([6, 4]);
  track.forEach((v, i) => {
    const x = g.xFor(i, n), y = g.yFor(v);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawPoints(ctx, g, track, n, color) {
  ctx.fillStyle = color;
  track.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(g.xFor(i, n), g.yFor(v), 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// The diagram's "Person-Archetype Gap dynamic" — a measured double-headed
// arrow at the widest divergence between observed and archetype-expected.
function drawGapAnnotation(ctx, g, observed, archetype, n, t) {
  if (n < 3 || !archetype || archetype.length < n) return;
  let bestI = -1, bestGap = 0;
  for (let i = 0; i < n; i++) {
    const gap = Math.abs(observed[i] - archetype[i]);
    if (gap > bestGap) { bestGap = gap; bestI = i; }
  }
  if (bestI < 0 || bestGap < 12) return; // not worth annotating a hairline

  const x = g.xFor(bestI, n);
  const y1 = g.yFor(observed[bestI]);
  const y2 = g.yFor(archetype[bestI]);

  ctx.save();
  ctx.strokeStyle = t.ink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  const head = (yTip, dir) => {
    ctx.beginPath();
    ctx.moveTo(x, yTip);
    ctx.lineTo(x - 3.5, yTip + 5 * dir);
    ctx.lineTo(x + 3.5, yTip + 5 * dir);
    ctx.closePath();
    ctx.fillStyle = t.ink;
    ctx.fill();
  };
  head(Math.min(y1, y2), 1);
  head(Math.max(y1, y2), -1);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = t.ink;
  ctx.globalAlpha = 0.72;
  ctx.font = "500 9.5px 'IBM Plex Sans', sans-serif";
  const midY = (y1 + y2) / 2;
  const label = "Person–archetype gap";
  const tw = ctx.measureText(label).width;
  // Flip the label inboard when near the right edge.
  const flip = x + 10 + tw > g.w - CHART.padR;
  ctx.textAlign = flip ? "right" : "left";
  ctx.fillText(label, flip ? x - 8 : x + 8, midY + 3);
  ctx.restore();
}

function drawTriggerMarkers(ctx, g, observed, n, triggers, t) {
  const annotated = triggers.slice(-2);
  triggers.forEach(tr => {
    if (tr.index >= n) return;
    const x = g.xFor(tr.index, n), y = g.yFor(observed[tr.index]);

    // Dotted leader from the marker toward its callout (only the annotated ones)
    if (annotated.includes(tr)) {
      const targetY = tr.kind === "distortion" ? CHART.padT + g.plotH * 0.10 : CHART.padT + g.plotH * 0.72;
      ctx.save();
      ctx.strokeStyle = t.brick;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + (targetY > y ? 7 : -7));
      ctx.lineTo(x, targetY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.strokeStyle = t.brick; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = t.brick; ctx.fill();
    ctx.restore();
  });
}

function drawCursor(ctx, g, observed, n, i, t) {
  const x = g.xFor(i, n), y = g.yFor(observed[i]);
  ctx.save();
  ctx.strokeStyle = t.ink;
  ctx.globalAlpha = 0.25;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, CHART.padT);
  ctx.lineTo(x, CHART.padT + g.plotH);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = t.teal; ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- overlay

// Trigger callouts as positioned HTML — real text, not painted pixels.
function positionCallouts(triggers, g, n) {
  const layer = document.getElementById("chart-callouts");
  if (!layer) return;
  if (!triggers.length) { layer.innerHTML = ""; return; }

  // Only annotate the two most recent triggers; more than that is noise.
  const recent = triggers.slice(-2);
  layer.innerHTML = recent.map(tr => {
    const x = g.xFor(tr.index, n);
    const isUpper = tr.kind === "distortion";
    const leftPct = (x / g.w) * 100;
    const side = leftPct > 62 ? "left" : "right";
    return `
      <div class="chart-callout chart-callout-${esc(tr.kind)} side-${side}"
           style="left:${leftPct}%; top:${isUpper ? 6 : 62}%;">
        <span class="callout-kind">PIPE trigger</span>
        <span class="callout-text">${isUpper ? "Upper deviation from homeostasis" : "Lower deviation from homeostasis"}</span>
      </div>`;
  }).join("");
}

function showTooltip(i) {
  const tip = document.getElementById("chart-tooltip");
  const canvas = document.getElementById("homeostasis-chart");
  if (!tip || !canvas || !chartData) return;
  const { observed = [], archetype = [], triggers = [] } = chartData;
  if (i < 0 || i >= observed.length) { hideTooltip(); return; }

  const g = chartGeometry(canvas);
  const n = observed.length;
  const x = g.xFor(i, n), y = g.yFor(observed[i]);
  const status = zoneStatus(observed[i]);
  const gap = archetype[i] != null ? observed[i] - archetype[i] : null;
  const trigger = triggers.find(t => t.index === i);

  tip.innerHTML = chartMode === 'research' ? `
    <p class="tip-head">Decision ${i}${i === 0 ? " (start)" : ""}</p>
    <p class="tip-row"><span>Wellbeing</span><strong>${observed[i]}/100</strong></p>
    <p class="tip-row"><span>Zone</span><strong class="tip-${esc(status)}">${status === "homeostasis" ? "In zone" : status === "breakdown" ? "Breakdown" : "Distortion"}</strong></p>
    ${gap !== null ? `<p class="tip-row"><span>vs archetype</span><strong>${gap > 0 ? "+" : ""}${gap}</strong></p>` : ""}
    ${trigger ? `<p class="tip-trigger">PIPE trigger fired here</p>` : ""}
  ` : `
    <p class="tip-head">${i === 0 ? "Where you started" : `Decision ${i}`}</p>
    <p class="tip-plain">${status === "homeostasis" ? "Comfortable here."
      : status === "breakdown" ? "Running thin at this point."
      : "Holding more than you were using."}</p>
  `;
  tip.hidden = false;

  // Keep the tooltip inside the plot; flip when close to the right edge.
  const flip = x / g.w > 0.6;
  tip.style.left = `${(x / g.w) * 100}%`;
  tip.style.top = `${(y / g.h) * 100}%`;
  tip.dataset.flip = flip ? "true" : "false";
}

function hideTooltip() {
  const tip = document.getElementById("chart-tooltip");
  if (tip) tip.hidden = true;
}

// ---------------------------------------------------------------- a11y

// Canvas is opaque to assistive tech, so we maintain (a) a descriptive label
// summarising the trajectory and (b) a hidden table mirroring every point.
function updateChartAccessibility(data, g) {
  const canvas = document.getElementById("homeostasis-chart");
  const table = document.getElementById("chart-data-table");
  if (!canvas) return;

  const { observed = [], archetype = [], triggers = [] } = data || {};
  if (!observed.length) {
    canvas.setAttribute("aria-label", "Financial wellbeing chart. No decisions recorded yet.");
    if (table) table.innerHTML = "";
    return;
  }

  const latest = observed[observed.length - 1];
  const status = zoneStatus(latest);
  const inZone = observed.filter(v => zoneStatus(v) === "homeostasis").length;
  const statusWord = status === "homeostasis" ? "within the homeostasis zone"
    : status === "breakdown" ? "below the breakdown threshold"
    : "above the distortion threshold";

  if (chartMode !== 'research') {
    canvas.setAttribute("aria-label",
      `How you're tracking across ${observed.length} decision${observed.length === 1 ? "" : "s"}. ` +
      `Right now you are ${statusWord === "within the homeostasis zone" ? "in a comfortable range"
        : statusWord === "below the breakdown threshold" ? "running thin"
        : "holding more than you're using"}. ` +
      `Use arrow keys to step through each decision.`);
  } else {
  canvas.setAttribute(
    "aria-label",
    `Financial wellbeing over ${observed.length} decisions. ` +
    `Current wellbeing ${latest} out of 100, ${statusWord}. ` +
    `${inZone} of ${observed.length} decisions stayed in the viable zone. ` +
    `${triggers.length} PIPE trigger${triggers.length === 1 ? "" : "s"} fired. ` +
    `The homeostasis zone spans ${HOMEOSTASIS.lower} to ${HOMEOSTASIS.upper}. ` +
    `Use arrow keys to inspect each decision.`
  );
  }

  if (table) {
    const rows = observed.map((v, i) => {
      const tr = triggers.find(t => t.index === i);
      return `<tr>
        <td>${i}</td>
        <td>${v}</td>
        <td>${archetype[i] ?? "—"}</td>
        <td>${zoneStatus(v)}</td>
        <td>${tr ? tr.kind : "—"}</td>
      </tr>`;
    }).join("");
    table.innerHTML = `
      <caption>Financial wellbeing by decision</caption>
      <thead><tr>
        <th scope="col">Decision</th><th scope="col">Wellbeing</th>
        <th scope="col">Archetype-expected</th><th scope="col">Zone</th><th scope="col">Trigger</th>
      </tr></thead>
      <tbody>${rows}</tbody>`;
  }
}

function announceCursor(i) {
  const live = document.getElementById("chart-live");
  if (!live || !chartData) return;
  const { observed = [], archetype = [], triggers = [] } = chartData;
  if (i < 0 || i >= observed.length) return;
  const status = zoneStatus(observed[i]);
  const gap = archetype[i] != null ? observed[i] - archetype[i] : null;
  const tr = triggers.find(t => t.index === i);
  live.textContent =
    `Decision ${i}. Wellbeing ${observed[i]}. ` +
    `${status === "homeostasis" ? "In zone" : status === "breakdown" ? "Below breakdown threshold" : "Above distortion threshold"}. ` +
    (gap !== null ? `${Math.abs(gap)} points ${gap >= 0 ? "above" : "below"} archetype-expected. ` : "") +
    (tr ? "PIPE trigger fired here." : "");
}

// ---------------------------------------------------------------- events

function moveCursor(delta) {
  if (!chartData || !chartData.observed.length) return;
  const n = chartData.observed.length;
  const next = chartCursor < 0
    ? (delta > 0 ? 0 : n - 1)
    : Math.max(0, Math.min(n - 1, chartCursor + delta));
  chartCursor = next;
  renderHomeostasisChart(chartData, { cursorOnly: true });
  showTooltip(chartCursor);
  announceCursor(chartCursor);
}

function clearCursor() {
  if (chartCursor === -1) return;
  chartCursor = -1;
  hideTooltip();
  if (chartData) renderHomeostasisChart(chartData, { cursorOnly: true });
}

function initHomeostasisChart() {
  const canvas = document.getElementById("homeostasis-chart");
  if (!canvas) return;

  canvas.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); moveCursor(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); moveCursor(-1); }
    else if (e.key === "Home") { e.preventDefault(); chartCursor = 0; moveCursor(0); }
    else if (e.key === "End" && chartData) { e.preventDefault(); chartCursor = chartData.observed.length - 1; moveCursor(0); }
    else if (e.key === "Escape") { clearCursor(); }
  });
  canvas.addEventListener("blur", clearCursor);

  // Pointer inspection — snap to the nearest decision.
  canvas.addEventListener("pointermove", e => {
    if (!chartData || !chartData.observed.length) return;
    const rect = canvas.getBoundingClientRect();
    const g = chartGeometry(canvas);
    const n = chartData.observed.length;
    const rel = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((rel - CHART.padL) / (g.plotW / (n - 1)));
    const clamped = Math.max(0, Math.min(n - 1, i));
    if (clamped !== chartCursor) {
      chartCursor = clamped;
      renderHomeostasisChart(chartData, { cursorOnly: true });
      showTooltip(chartCursor);
    }
  });
  canvas.addEventListener("pointerleave", clearCursor);
  // Touch does not always emit pointerleave; these guarantee cleanup so a
  // tooltip can never be stranded on screen after a tap.
  canvas.addEventListener("pointercancel", clearCursor);
  canvas.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") clearCursor(); });

  // Re-render on theme flip and on resize (debounced).
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (chartData) renderHomeostasisChart(chartData);
  });
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (chartData) renderHomeostasisChart(chartData); }, 120);
  });
}
