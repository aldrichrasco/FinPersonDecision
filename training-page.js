// Behavioral Training — spaced repetition of exercises you've already
// done, targeted at your own weakest axis (fbm.js's axisGapsToArchetype +
// learn.js's learnStatusForAxis, the SAME "what needs work" logic
// learn-page.js already uses to order Learn topics, reused here rather
// than re-deriving a second opinion about what counts as weak).
(function () {
  const content = document.getElementById("training-content");
  const status = document.getElementById("training-status");
  const saved = getProfile();

  if (!saved) {
    status.innerHTML = `You haven't taken the quiz yet. <a href="index.html">Take the quick quiz</a> first — training is built around your own profile.`;
    return;
  }

  function findLevel(levelId) {
    for (const tier of ROADMAP_TIERS) {
      const lvl = tier.levels.find(l => l.id === levelId);
      if (lvl) return lvl;
    }
    return null;
  }

  function fmtDue(dueAt) {
    const days = Math.ceil((dueAt - Date.now()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  }

  function axisRow(axis, isPrimary) {
    const meta = AXES[axis];
    const roadmap = getRoadmapProgress();
    const training = getTrainingProgress();
    const taggedLevels = levelsForAxis(axis).map(findLevel).filter(Boolean);
    const triedLevels = taggedLevels.filter(l => roadmap.completed.includes(l.id));
    const untriedLevels = taggedLevels.filter(l => !roadmap.completed.includes(l.id));

    const rows = triedLevels.map(level => {
      const entry = training[level.id];
      const due = isTrainingDue(entry, Date.now());
      return `
        <a href="${level.href}" class="scenario-card" style="display:flex;align-items:center;gap:14px;padding:14px 18px;text-decoration:none;color:inherit;margin-bottom:8px;">
          <span style="flex:1;min-width:0;">
            <span style="display:block;font-weight:600;font-size:14.5px;">${level.name}</span>
            <span style="display:block;font-size:12.5px;color:var(--slate);margin-top:2px;">${level.blurb}</span>
          </span>
          <span style="font-family:var(--font-mono);font-size:11.5px;flex-shrink:0;color:${due ? "var(--teal)" : "var(--slate)"};">
            ${due ? "Due for review" : `Next review ${fmtDue(entry.dueAt)}`}
          </span>
        </a>
      `;
    }).join("");

    const startHere = !triedLevels.length && untriedLevels.length
      ? `<a href="${untriedLevels[0].href}" class="scenario-card" style="display:block;padding:14px 18px;text-decoration:none;color:inherit;margin-bottom:8px;">
           <span style="display:block;font-weight:600;font-size:14.5px;">Start here: ${untriedLevels[0].name}</span>
           <span style="display:block;font-size:12.5px;color:var(--slate);margin-top:2px;">${untriedLevels[0].blurb} — you haven't tried this one yet.</span>
         </a>`
      : "";

    return `
      <section style="margin-bottom:28px;">
        <p class="scenario-eyebrow" style="margin:0 0 4px;">${isPrimary ? "Focus area" : "Also worth practicing"} — ${meta.label}</p>
        <p style="font-size:13.5px;color:var(--slate);margin:0 0 12px;">${meta.sub}. Your profile currently reads toward "${meta.low}."</p>
        ${rows || startHere || `<p style="font-size:13.5px;color:var(--slate);">No exercises mapped to this axis yet.</p>`}
      </section>
    `;
  }

  async function init() {
    await Promise.all([
      typeof roadmapSyncFromServer === "function" ? roadmapSyncFromServer() : Promise.resolve(),
      typeof trainingSyncFromServer === "function" ? trainingSyncFromServer() : Promise.resolve(),
    ]);

    const gaps = axisGapsToArchetype(saved.profile, saved.archetype);
    const statuses = {};
    AXIS_KEYS.forEach(k => { statuses[k] = learnStatusForAxis(k, saved.profile[k] ?? 50); });
    const ranked = rankAxesByPriority(AXIS_KEYS, gaps, statuses);

    status.hidden = true;
    // Top 2 priority axes only — more than that stops reading as
    // "focused training" and starts reading as just the full axis list
    // again, which defeats the point of prioritizing at all.
    content.innerHTML = axisRow(ranked[0], true) + (ranked[1] ? axisRow(ranked[1], false) : "");
  }

  init();
})();
