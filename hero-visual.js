// The hero used to be text-only. Rather than add decorative illustration,
// this shows a real piece of the product — the same six-axis radar chart
// used on Progress and Theory — cycling through a few actual archetype
// profiles, so the shape-changes-per-person idea is demonstrated, not just
// claimed in copy.
(function () {
  const canvas = document.getElementById("hero-radar");
  const label = document.getElementById("hero-radar-label");
  if (!canvas || typeof drawRadarChart !== "function" || typeof ARCHETYPE_PROFILES === "undefined") return;

  const cycle = ["steady_saver", "ambitious_builder", "impulsive_spender", "anxious_avoider"];
  function nameFor(slug) {
    const p = typeof PERSONAS !== "undefined" ? PERSONAS.find(x => x.slug === slug) : null;
    return p ? p.name : slug;
  }

  let index = 0;
  const current = { ...ARCHETYPE_PROFILES[cycle[0]] };
  drawRadarChart(canvas, current, {}, { showLabels: false });
  if (label) label.textContent = nameFor(cycle[0]);

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function tweenTo(target, duration) {
    const start = { ...current };
    const startTime = performance.now();
    (function tick(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      AXIS_KEYS.forEach(k => { current[k] = start[k] + ((target[k] ?? 50) - start[k]) * eased; });
      drawRadarChart(canvas, current, {}, { showLabels: false });
      if (t < 1) requestAnimationFrame(tick);
    })(performance.now());
  }

  setInterval(() => {
    index = (index + 1) % cycle.length;
    const slug = cycle[index];
    if (label) {
      label.style.opacity = 0;
      setTimeout(() => { label.textContent = nameFor(slug); label.style.opacity = 1; }, 300);
    }
    tweenTo(ARCHETYPE_PROFILES[slug], 900);
  }, 3800);
})();
