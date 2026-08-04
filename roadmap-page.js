// Roadmap page controller. Two of the levels ("quiz", "learn-topic") are
// DERIVED from state that already exists elsewhere (the saved quiz
// profile, Learn's own progress) rather than requiring a separate click
// — if you've already done the thing, the roadmap notices rather than
// asking you to do it again just to get credit.
(function () {
  const content = document.getElementById("roadmap-content");
  const header = document.getElementById("roadmap-header");

  async function backfillDerivedLevels() {
    const roadmap = getRoadmapProgress();
    if (!roadmap.completed.includes("quiz") && typeof getProfile === "function" && getProfile()) {
      markRoadmapLevelComplete("quiz");
    }
    if (!roadmap.completed.includes("learn-topic")) {
      const learnProgress = await (typeof fetchLearnProgress === "function" ? fetchLearnProgress() : Promise.resolve(null));
      const localLearn = (() => {
        try { return JSON.parse(localStorage.getItem("finperson_learn_progress")); } catch (e) { return null; }
      })();
      const learnCompletedCount = Math.max(
        Array.isArray(learnProgress && learnProgress.completed) ? learnProgress.completed.length : 0,
        Array.isArray(localLearn && localLearn.completed) ? localLearn.completed.length : 0
      );
      if (learnCompletedCount > 0) markRoadmapLevelComplete("learn-topic");
    }
  }

  function renderHeader(combinedXp) {
    const { level, into, pct } = roadmapXpForLevel(combinedXp);
    const roadmap = getRoadmapProgress();
    header.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;margin-bottom:10px;">
        <span style="font-family:var(--font-display);font-weight:500;font-size:26px;">Level ${level}</span>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--slate);">${into}/50 XP to next level</span>
        ${roadmap.streak > 0 ? `<span style="font-family:var(--font-mono);font-size:13px;color:var(--marigold-ink);">${roadmap.streak} day streak</span>` : ""}
      </div>
      <div style="height:8px;border-radius:999px;background:var(--slate-tint);overflow:hidden;">
        <div style="height:100%;background:var(--teal);width:${pct}%;transition:width .2s ease;"></div>
      </div>
    `;
  }

  function levelRow(level, done, clickable) {
    return `
      <a href="${clickable ? level.href : "#"}" class="scenario-card" style="
        display:flex;align-items:center;gap:14px;padding:14px 18px;text-decoration:none;color:inherit;
        opacity:${clickable ? "1" : ".45"};cursor:${clickable ? "pointer" : "default"};margin-bottom:8px;
        ${clickable ? "" : "pointer-events:none;"}
      ">
        <span style="
          width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
          font-family:var(--font-mono);font-size:12px;
          background:${done ? "var(--teal)" : "var(--slate-tint)"};color:${done ? "var(--paper-raised)" : "var(--slate)"};
        ">${done ? "&check;" : ""}</span>
        <span style="flex:1;min-width:0;">
          <span style="display:block;font-weight:600;font-size:14.5px;">${level.name}</span>
          <span style="display:block;font-size:12.5px;color:var(--slate);margin-top:2px;">${level.blurb}</span>
        </span>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--slate);flex-shrink:0;">+${level.xp} XP</span>
      </a>
    `;
  }

  function render() {
    const roadmap = getRoadmapProgress();
    const tierStatus = roadmapTierStatus(ROADMAP_TIERS, roadmap.completed);

    content.innerHTML = tierStatus.map(({ tier, done, total, unlocked, complete }) => `
      <section style="margin-bottom:28px;">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px;flex-wrap:wrap;">
          <p class="scenario-eyebrow" style="margin:0;">${tier.name}</p>
          <span style="font-family:var(--font-mono);font-size:12px;color:${complete ? "var(--teal)" : "var(--slate)"};">${done}/${total} done</span>
        </div>
        <p style="font-size:13.5px;color:var(--slate);margin:0 0 12px;">${tier.blurb}</p>
        ${!unlocked ? `<p style="font-size:13px;color:var(--brick);margin:0 0 10px;">Complete the previous tier to unlock this one.</p>` : ""}
        ${tier.levels.map(level => levelRow(level, roadmap.completed.includes(level.id), unlocked)).join("")}
      </section>
    `).join("");
  }

  async function init() {
    await roadmapSyncFromServer();
    await backfillDerivedLevels();

    const learnProgress = typeof fetchLearnProgress === "function" ? await fetchLearnProgress() : null;
    const localLearn = (() => {
      try { return JSON.parse(localStorage.getItem("finperson_learn_progress")); } catch (e) { return null; }
    })();
    const learnXp = Math.max(
      (learnProgress && typeof learnProgress.xp === "number") ? learnProgress.xp : 0,
      (localLearn && typeof localLearn.xp === "number") ? localLearn.xp : 0
    );

    const roadmap = getRoadmapProgress();
    renderHeader(roadmap.xp + learnXp);
    render();
  }

  init();
})();
