// Six-spoke radar of the FBM axes. Spoke length is the quiz score (0-100);
// spoke opacity reflects decision *consistency* on that axis — how much
// wellbeing swings among the person's own sandbox decisions tagged with
// that axis (see db.py get_axis_consistency). A short, faded spoke reads
// differently from a short, solid one: the first is "low and erratic," the
// second is "low but at least steady."
//
// Same canvas conventions as chart.js: theme colors read from CSS custom
// properties, devicePixelRatio scaling for crisp lines on any display.
function drawRadarChart(canvas, axisValues, consistencyByAxis, opts = {}) {
  // Three label modes: true (full two-line axis names + ring values, for the
  // main Progress-page chart where there's room), "compact" (one-word
  // abbreviation only, no ring values — for small card contexts that still
  // need SOME sense of what each spoke means), false (no labels at all).
  const showLabels = opts.showLabels === undefined ? true : opts.showLabels;
  const compact = showLabels === "compact";
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320, cssH = cssW;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const styles = getComputedStyle(document.body);
  const teal = styles.getPropertyValue("--teal").trim() || "#0B4A44";
  const line = styles.getPropertyValue("--line").trim() || "rgba(0,0,0,0.14)";
  const slate = styles.getPropertyValue("--slate").trim() || "#5B5E66";

  const cx = cssW / 2, cy = cssH / 2;
  // Labels wrap to two lines (see below), so the reserved margin only needs
  // to fit the wider of two short words, not a whole two-word label — 56px
  // was previously 34px, which was nowhere near enough for the longest
  // labels ("Financial Attentiveness") and left them clipped by the canvas
  // edge entirely on one side of the chart. Compact mode's single short
  // word needs less room than that, but still more than the label-less 8px.
  const radius = Math.min(cssW, cssH) / 2 - (showLabels ? (compact ? 36 : 60) : 8);
  const keys = AXIS_KEYS;
  const n = keys.length;
  const angleFor = i => (Math.PI * 2 * i) / n - Math.PI / 2;

  // Grid rings (25/50/75/100%) and axis spokes.
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    ctx.beginPath();
    keys.forEach((_, i) => {
      const a = angleFor(i), r = radius * frac;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  });

  // Ring value labels, so the radial axis reads as a measured scale rather
  // than unlabeled decoration — placed up the top spoke (straight up from
  // center), offset slightly right so they don't sit on top of the spoke
  // line itself. Skipped in compact mode: a card-sized chart doesn't have
  // room for both ring numbers and axis names without both turning to noise,
  // and the axis names are the more useful of the two at that size.
  if (showLabels === true) {
    ctx.font = "600 11px 'IBM Plex Mono', monospace";
    ctx.fillStyle = slate;
    ctx.textAlign = "left";
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      const y = cy - radius * frac;
      ctx.fillText(String(Math.round(frac * 100)), cx + 4, y + 3);
    });
  }
  keys.forEach((_, i) => {
    const a = angleFor(i);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.stroke();
  });

  // The data polygon.
  ctx.beginPath();
  keys.forEach((k, i) => {
    const v = axisValues[k] ?? 50;
    const a = angleFor(i), r = radius * (v / 100);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = teal; ctx.globalAlpha = 0.18; ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = teal; ctx.lineWidth = 2; ctx.stroke();

  // Per-axis point, opacity driven by consistency (low variance = solid).
  keys.forEach((k, i) => {
    const v = axisValues[k] ?? 50;
    const a = angleFor(i), r = radius * (v / 100);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const c = consistencyByAxis && consistencyByAxis[k];
    const opacity = c ? Math.max(0.35, Math.min(1, 1 - c.variance / 500)) : 1;
    ctx.beginPath();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = teal;
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Axis labels — skipped entirely when showLabels is false (e.g. the
  // persona-chip hover preview), where there isn't room for six labels of
  // any kind to stay legible. Both modes now draw a single-line
  // AXES[k].short label (full mode just at a bigger font) — the two-line
  // wrapped full label used to sit close enough to the top axis's ring
  // value that "Regulation" (its second line) landed right on top of the
  // "100" mark, a real collision, not just a tight-but-fine layout.
  if (showLabels) {
    ctx.font = compact ? "500 10.5px 'IBM Plex Sans', sans-serif" : "500 12px 'IBM Plex Sans', sans-serif";
    ctx.fillStyle = slate;
    keys.forEach((k, i) => {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * (radius + 14), y = cy + Math.sin(a) * (radius + 14);
      // Compact mode always centers the label on its anchor point rather
      // than left/right-aligning like full mode does — at this small a
      // radius, right-aligning the left-side labels (as full mode does)
      // pushes most of a word's width off the canvas's left edge entirely,
      // which is exactly why "Self-Eff." was rendering half-invisible.
      ctx.textAlign = compact ? "center" : (Math.cos(a) > 0.3 ? "left" : Math.cos(a) < -0.3 ? "right" : "center");
      ctx.fillText(AXES[k].short, x, y + 3);
    });
  }
}

// Grows each spoke from the center out to its real score instead of
// snapping straight to the final shape — same ease-out cubic and timing
// convention as dashboard.js's animateMetric, so the two "number moves"
// in the app feel like one motion language rather than two. Used for the
// Progress page's first paint only; the persona-chip hover preview in
// dashboard.js stays instant since a hover shouldn't cost 700ms to read.
function animateRadarChart(canvas, axisValues, consistencyByAxis, opts = {}) {
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    drawRadarChart(canvas, axisValues, consistencyByAxis, opts);
    return;
  }
  const duration = 700;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const interpolated = {};
    AXIS_KEYS.forEach(k => { interpolated[k] = (axisValues[k] ?? 50) * eased; });
    drawRadarChart(canvas, interpolated, consistencyByAxis, opts);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
