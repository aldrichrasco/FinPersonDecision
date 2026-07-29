(function () {
  const content = document.getElementById("learn-content");
  const status = document.getElementById("learn-status");
  const saved = getProfile();

  if (!saved) {
    status.innerHTML = `You haven't taken the quiz yet. <a href="index.html">Take the 30-second quiz</a> to see your profile here.`;
    return;
  }

  const LOCAL_KEY = "finperson_learn_progress";

  function loadLocalProgress() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveLocalProgress(p) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)); } catch (e) {}
  }

  const DAILY_XP_GOAL = 30;

  function normalizeProgress(p) {
    return {
      completed: Array.isArray(p && p.completed) ? p.completed : [],
      xp: (p && typeof p.xp === "number") ? p.xp : 0,
      streak: (p && typeof p.streak === "number") ? p.streak : 0,
      lastActivityDate: (p && p.lastActivityDate) || null,
      todayXp: (p && typeof p.todayXp === "number") ? p.todayXp : 0,
      todayXpDate: (p && p.todayXpDate) || null,
    };
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function bumpStreak(progress) {
    const today = todayStr();
    if (progress.lastActivityDate === today) return progress; // already counted today
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    progress.streak = progress.lastActivityDate === yesterday ? progress.streak + 1 : 1;
    progress.lastActivityDate = today;
    return progress;
  }

  // Separate from all-time xp — Duolingo's "daily goal" concept, resets
  // at midnight rather than accumulating forever, so there's always a
  // fresh, achievable target instead of one that gets harder to feel
  // relative to the longer someone's been using this.
  function bumpDailyXp(progress, delta) {
    const today = todayStr();
    if (progress.todayXpDate !== today) {
      progress.todayXp = 0;
      progress.todayXpDate = today;
    }
    progress.todayXp = Math.max(0, progress.todayXp + delta);
    return progress;
  }

  let progress = normalizeProgress(loadLocalProgress());

  render();

  // Try the signed-in server copy; if it has more info than local, prefer it.
  fetchLearnProgress().then(serverProgress => {
    if (serverProgress && Array.isArray(serverProgress.completed) && serverProgress.completed.length >= progress.completed.length) {
      progress = normalizeProgress(serverProgress);
      saveLocalProgress(progress);
      render();
    }
  });

  function persist() {
    saveLocalProgress(progress);
    saveLearnProgress(progress); // no-op if not signed in
  }

  function lessonKey(axis, idx) {
    return `${axis}:${idx}`;
  }

  function toggleLesson(axis, idx) {
    const key = lessonKey(axis, idx);
    const at = progress.completed.indexOf(key);
    if (at === -1) {
      const beforeLevel = xpForNextLevel(progress.xp).level;
      const beforeGoalMet = progress.todayXpDate === todayStr() && progress.todayXp >= DAILY_XP_GOAL;

      progress.completed.push(key);
      progress.xp += 10;
      bumpStreak(progress);
      bumpDailyXp(progress, 10);

      const afterLevel = xpForNextLevel(progress.xp).level;
      const afterGoalMet = progress.todayXp >= DAILY_XP_GOAL;
      celebrateCompletion({ leveledUp: afterLevel > beforeLevel, level: afterLevel, goalJustMet: afterGoalMet && !beforeGoalMet });
    } else {
      progress.completed.splice(at, 1);
      progress.xp = Math.max(0, progress.xp - 10);
      bumpDailyXp(progress, -10);
    }
    persist();
    render();
  }

  // One celebratory moment per completed lesson, prioritizing the biggest
  // news: a level-up beats the daily goal beats a plain "+10 XP" — Duolingo
  // never stacks more than one of these at once either, since piling on
  // congratulations for the same click reads as noise, not encouragement.
  const ENCOURAGEMENTS = ["Nice!", "Great work!", "Keep it up!", "Solid.", "That's the habit."];
  function celebrateCompletion({ leveledUp, level, goalJustMet }) {
    if (typeof toast !== "function") return;
    if (leveledUp) {
      toast(`Level up! You're now Level ${level}.`, { tone: "good", duration: 3200 });
    } else if (goalJustMet) {
      toast(`Daily goal reached — ${DAILY_XP_GOAL} XP today.`, { tone: "good", duration: 3200 });
    } else {
      const line = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      toast(`${line} +10 XP`, { tone: "good", duration: 2000 });
    }
  }

  function xpForNextLevel(xp) {
    const level = Math.floor(xp / 50);
    const into = xp - level * 50;
    return { level: level + 1, into, pct: Math.round((into / 50) * 100) };
  }

  function render() {
    const { level, into, pct } = xpForNextLevel(progress.xp);

    // How far the person's raw quiz profile sits from their own matched
    // archetype's typical pattern. Per-axis gap magnitude ranks which
    // modules are the real weaknesses to surface first — a bigger gap on an
    // axis means that axis is furthest from what this archetype "should"
    // look like, independent of whether the raw score alone reads as low.
    const gaps = (typeof axisGapsToArchetype === "function")
      ? axisGapsToArchetype(saved.profile, saved.archetype) : {};
    const closeness = (typeof archetypeCloseness === "function")
      ? archetypeCloseness(saved.profile, saved.archetype) : null;

    const orderedAxes = LEARN_AXIS_ORDER.slice().sort((a, b) =>
      Math.abs(gaps[b] ?? 0) - Math.abs(gaps[a] ?? 0));

    const axisCards = orderedAxes.map(axis => {
      const value = saved.profile[axis] ?? 50;
      const axisStatus = learnStatusForAxis(axis, value);
      const meta = AXES[axis];
      const c = LEARN_CONTENT[axis];
      const blurb = axisStatus === "growth" ? c.growth_blurb
        : axisStatus === "strength" ? c.strength_blurb
        : c.growth_blurb;
      const gap = gaps[axis];
      const gapNote = (typeof gap === "number" && Math.abs(gap) >= 8)
        ? `<span class="learn-axis-gap">${Math.round(Math.abs(gap))} pts ${gap > 0 ? "above" : "below"} the ${esc(PERSONAS.find(p => p.slug === saved.archetype)?.name || "archetype")} pattern</span>`
        : "";

      // A path, not a plain list — each lesson a node on a connecting
      // line (drawn behind the nodes, see .learn-lessons::before), the
      // signature Duolingo "unit map" shape. The next not-yet-done
      // lesson gets a pulsing ring so there's always one obvious next
      // step, rather than a flat list of equally-weighted rows.
      let nextShown = false;
      const lessonsHtml = c.lessons.map((lesson, idx) => {
        const key = lessonKey(axis, idx);
        const done = progress.completed.includes(key);
        const isNext = !done && !nextShown;
        if (isNext) nextShown = true;
        return `
          <div class="learn-lesson ${done ? "is-done" : ""} ${isNext ? "is-next" : ""}" data-axis="${esc(axis)}" data-idx="${idx}">
            <div class="learn-lesson-head" data-toggle-open>
              <span class="learn-lesson-check" data-toggle-done title="${done ? "Mark not done" : "Mark done"}">${done ? "✓" : ""}</span>
              <span class="learn-lesson-title" style="flex:1;">${esc(lesson.title)}</span>
              <span class="learn-lesson-meta">${lesson.minutes} min</span>
            </div>
            <div class="learn-lesson-body">${esc(lesson.body)}</div>
          </div>`;
      }).join("");

      const resourcesHtml = c.resources.map(r => `
        <a class="learn-resource-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
          ${esc(r.name)} <span class="learn-resource-note">— ${esc(r.note)}</span>
        </a>`).join("");

      const videoHtml = (c.videos || []).map(v => `
        <a class="learn-resource-link learn-resource-video" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">
          ▶ ${esc(v.name)} <span class="learn-resource-note">— ${esc(v.note)}</span>
        </a>`).join("");

      // Per-axis completion rollup — before this, a card only showed
      // individual lesson checkmarks with no sense of "how much of this
      // axis is done." A finished axis now also gets a small "Complete"
      // badge on the card itself, not just checked-off rows inside it.
      const doneCount = c.lessons.filter((_, idx) => progress.completed.includes(lessonKey(axis, idx))).length;
      const totalCount = c.lessons.length;
      const axisComplete = doneCount === totalCount;
      const completionHtml = `
        <div class="learn-axis-progress">
          <div class="learn-xp-track learn-axis-progress-track"><div class="learn-xp-fill" style="width:${Math.round((doneCount / totalCount) * 100)}%"></div></div>
          <span class="learn-axis-progress-label">${doneCount} of ${totalCount} lessons</span>
        </div>`;

      return `
        <div class="learn-axis-card ${axisStatus === "growth" ? "is-growth" : axisStatus === "strength" ? "is-strength" : ""}">
          <span class="learn-axis-tag">${axisStatus === "growth" ? "Growth area" : axisStatus === "strength" ? "Strength" : meta.label}</span>
          ${axisComplete ? `<span class="learn-axis-complete-badge" title="All lessons done">✓ Complete</span>` : ""}
          <h3>${esc(meta.label)}</h3>
          <p class="learn-axis-blurb">${esc(blurb)}</p>
          ${gapNote}
          ${completionHtml}
          <div class="learn-lessons">${lessonsHtml}</div>
          <div class="learn-resources">
            <p class="learn-resources-title">Learn more</p>
            ${videoHtml}
            ${resourcesHtml}
          </div>
          ${c.research ? `<p class="learn-axis-research">${esc(c.research)}</p>` : ""}
        </div>`;
    });

    // Show the 3 biggest weaknesses by default (orderedAxes is already
    // sorted by gap-to-archetype magnitude) and tuck the rest behind a
    // disclosure — six full cards at once was the single longest scroll
    // on the site, and most of the time only 1-3 axes are what actually
    // need attention.
    const primaryCards = axisCards.slice(0, 3).join("");
    const restCards = axisCards.slice(3).join("");

    const closenessHtml = (typeof closeness === "number") ? `
      <div class="learn-closeness">
        <span class="learn-closeness-label">Match to your archetype's typical pattern</span>
        <div class="learn-xp-track"><div class="learn-xp-fill" style="width:${closeness}%"></div></div>
        <span class="learn-closeness-pct">${closeness}%</span>
      </div>` : "";

    const todayXp = (progress.todayXpDate === todayStr()) ? progress.todayXp : 0;
    const goalPct = Math.min(100, Math.round((todayXp / DAILY_XP_GOAL) * 100));
    const goalMet = todayXp >= DAILY_XP_GOAL;

    content.innerHTML = `
      <div class="learn-streak-row">
        <div class="learn-streak"><span class="learn-streak-flame">🔥</span> ${progress.streak}-day streak</div>
        <div class="learn-xp-track"><div class="learn-xp-fill" style="width:${pct}%"></div></div>
        <span class="learn-xp-label">Level ${level} · ${into}/50 XP</span>
      </div>
      <div class="learn-daily-goal ${goalMet ? "is-met" : ""}">
        <span class="learn-daily-goal-label">${goalMet ? "Daily goal reached" : "Daily goal"}</span>
        <div class="learn-xp-track learn-daily-goal-track"><div class="learn-xp-fill" style="width:${goalPct}%"></div></div>
        <span class="learn-daily-goal-count">${Math.min(todayXp, DAILY_XP_GOAL)}/${DAILY_XP_GOAL} XP${goalMet ? " ✓" : ""}</span>
      </div>
      ${closenessHtml}
      <div class="learn-grid">${primaryCards}</div>
      ${restCards ? `
        <details class="learn-show-all">
          <summary>Show all six axes</summary>
          <div class="learn-grid" style="margin-top:14px;">${restCards}</div>
        </details>` : ""}
    `;

    content.querySelectorAll(".learn-lesson-head").forEach(head => {
      head.addEventListener("click", (e) => {
        if (e.target.hasAttribute("data-toggle-done")) return;
        head.closest(".learn-lesson").classList.toggle("is-open");
      });
    });
    content.querySelectorAll("[data-toggle-done]").forEach(box => {
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        const row = box.closest(".learn-lesson");
        toggleLesson(row.dataset.axis, Number(row.dataset.idx));
      });
    });
  }
})();

if (typeof runAchievementCheck === "function") {
  runAchievementCheck((newly) => {
    if (newly.length && typeof toast === "function") {
      toast(`Unlocked: ${newly.map(a => a.title).join(", ")}`, { tone: "good", duration: 4500 });
    }
  });
}
