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
  const showLabels = opts.showLabels !== false;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320, cssH = cssW;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const styles = getComputedStyle(document.body);
  const teal = styles.getPropertyValue("--teal").trim() || "#0F5C55";
  const line = styles.getPropertyValue("--line").trim() || "rgba(0,0,0,0.14)";
  const slate = styles.getPropertyValue("--slate").trim() || "#6B6F76";

  const cx = cssW / 2, cy = cssH / 2;
  // Labels wrap to two lines (see below), so the reserved margin only needs
  // to fit the wider of two short words, not a whole two-word label — 56px
  // was previously 34px, which was nowhere near enough for the longest
  // labels ("Financial Attentiveness") and left them clipped by the canvas
  // edge entirely on one side of the chart.
  const radius = Math.min(cssW, cssH) / 2 - (showLabels ? 56 : 8);
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
  // line itself.
  if (showLabels) {
    ctx.font = "9px 'IBM Plex Mono', monospace";
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

  // Axis labels — skipped in compact mode (e.g. the persona-chip tooltip),
  // where there isn't room for six full labels to stay legible. Every FBM
  // label is exactly two words ("Risk Disposition", "Financial Self-
  // Efficacy") — wrapped onto two lines instead of one so each line is
  // short enough to fit inside the margin above, rather than running off
  // the edge of the canvas as a single long line did before.
  if (showLabels) {
    ctx.font = "10.5px 'IBM Plex Sans', sans-serif";
    ctx.fillStyle = slate;
    keys.forEach((k, i) => {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * (radius + 14), y = cy + Math.sin(a) * (radius + 14);
      ctx.textAlign = Math.cos(a) > 0.3 ? "left" : Math.cos(a) < -0.3 ? "right" : "center";
      const words = AXES[k].label.split(" ");
      const line1 = words[0], line2 = words.slice(1).join(" ");
      ctx.fillText(line1, x, y + 3);
      ctx.fillText(line2, x, y + 15);
    });
  }
}
