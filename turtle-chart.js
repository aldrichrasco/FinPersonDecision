// Price-series canvas for the Turtle Trading simulation. Reuses chart.js's
// generic drawTrack/drawPoints/tokens() (they only need a geometry object
// with xFor/yFor, nothing homeostasis-specific) — chart.js must load before
// this file. The one thing chart.js doesn't offer is a dynamic-range
// geometry: its chartGeometry() hardcodes a 0-100 domain (see chart.js:35),
// which a price series doesn't have, so this file supplies its own.
function turtleChartGeometry(canvas, minVal, maxVal) {
  const w = canvas.clientWidth || 640;
  const h = 220;
  const padL = 54, padR = 16, padT = 16, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const span = Math.max(1e-6, maxVal - minVal);
  return {
    w, h, plotW, plotH,
    yFor: v => padT + plotH - ((v - minVal) / span) * plotH,
    xFor: (i, n) => padL + (n <= 1 ? plotW / 2 : (plotW / (n - 1)) * i),
  };
}

// Draws the price line up to `uptoIndex` (inclusive), plus a marker on the
// current point colored by the Donchian signal there (buy/sell/hold).
function drawTurtleChart(canvas, prices, uptoIndex, signal) {
  const visible = prices.slice(0, uptoIndex + 1);
  const minVal = Math.min(...visible);
  const maxVal = Math.max(...visible);
  const pad = (maxVal - minVal) * 0.08 || 1;
  const g = turtleChartGeometry(canvas, minVal - pad, maxVal + pad);
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
  const n = visible.length;
  drawTrack(ctx, g, visible, n, t.ink, { width: 2 });
  drawPoints(ctx, g, [visible[n - 1]], n === 1 ? 1 : n, t.ink);

  const markerColor = signal === "buy" ? t.teal : signal === "sell" ? t.brick : t.slate;
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = markerColor;
  ctx.arc(g.xFor(n - 1, n), g.yFor(visible[n - 1]), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Small dual-line equity-curve chart — same geometry approach, always
// starts both curves at 1.0 so the domain is [min(both curves), max(both)].
function drawEquityCurves(canvas, ruleCurve, playerCurve) {
  const all = ruleCurve.concat(playerCurve);
  const minVal = Math.min(...all);
  const maxVal = Math.max(...all);
  const pad = (maxVal - minVal) * 0.1 || 0.05;
  const g = turtleChartGeometry(canvas, minVal - pad, maxVal + pad);
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
  const n = ruleCurve.length;
  drawTrack(ctx, g, ruleCurve, n, t.slate, { width: 2, dashed: true });
  drawTrack(ctx, g, playerCurve, n, t.teal, { width: 2.5 });
}
