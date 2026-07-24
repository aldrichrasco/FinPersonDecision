// Six-spoke radar of the FBM axes. Spoke length is the quiz score (0-100);
// spoke opacity reflects decision *consistency* on that axis — how much
// wellbeing swings among the person's own sandbox decisions tagged with
// that axis (see db.py get_axis_consistency). A short, faded spoke reads
// differently from a short, solid one: the first is "low and erratic," the
// second is "low but at least steady."
//
// Same canvas conventions as chart.js: theme colors read from CSS custom
// properties, devicePixelRatio scaling for crisp lines on any display.
function drawRadarChart(canvas, axisValues, consistencyByAxis) {
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
  const radius = Math.min(cssW, cssH) / 2 - 34;
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

  // Axis labels.
  ctx.font = "11px 'IBM Plex Sans', sans-serif";
  ctx.fillStyle = slate;
  keys.forEach((k, i) => {
    const a = angleFor(i);
    const x = cx + Math.cos(a) * (radius + 18), y = cy + Math.sin(a) * (radius + 18);
    ctx.textAlign = Math.cos(a) > 0.3 ? "left" : Math.cos(a) < -0.3 ? "right" : "center";
    ctx.fillText(AXES[k].label, x, y + 4);
  });
}
