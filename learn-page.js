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

  function normalizeProgress(p) {
    return {
      completed: Array.isArray(p && p.completed) ? p.completed : [],
      xp: (p && typeof p.xp === "number") ? p.xp : 0,
      streak: (p && typeof p.streak === "number") ? p.streak : 0,
      lastActivityDate: (p && p.lastActivityDate) || null,
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
      progress.completed.push(key);
      progress.xp += 10;
      bumpStreak(progress);
    } else {
      progress.completed.splice(at, 1);
      progress.xp = Math.max(0, progress.xp - 10);
    }
    persist();
    render();
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

      const lessonsHtml = c.lessons.map((lesson, idx) => {
        const key = lessonKey(axis, idx);
        const done = progress.completed.includes(key);
        return `
          <div class="learn-lesson ${done ? "is-done" : ""}" data-axis="${esc(axis)}" data-idx="${idx}">
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

      const videoHtml = c.video ? `
        <a class="learn-resource-link learn-resource-video" href="${esc(c.video.url)}" target="_blank" rel="noopener noreferrer">
          ▶ ${esc(c.video.name)} <span class="learn-resource-note">— ${esc(c.video.note)}</span>
        </a>` : "";

      return `
        <div class="learn-axis-card ${axisStatus === "growth" ? "is-growth" : axisStatus === "strength" ? "is-strength" : ""}">
          <span class="learn-axis-tag">${axisStatus === "growth" ? "Growth area" : axisStatus === "strength" ? "Strength" : meta.label}</span>
          <h3>${esc(meta.label)}</h3>
          <p class="learn-axis-blurb">${esc(blurb)}</p>
          ${gapNote}
          ${lessonsHtml}
          <div class="learn-resources">
            <p class="learn-resources-title">Learn more</p>
            ${videoHtml}
            ${resourcesHtml}
          </div>
        </div>`;
    }).join("");

    const closenessHtml = (typeof closeness === "number") ? `
      <div class="learn-closeness">
        <span class="learn-closeness-label">Match to your archetype's typical pattern</span>
        <div class="learn-xp-track"><div class="learn-xp-fill" style="width:${closeness}%"></div></div>
        <span class="learn-closeness-pct">${closeness}%</span>
      </div>` : "";

    content.innerHTML = `
      <div class="learn-streak-row">
        <div class="learn-streak"><span class="learn-streak-flame">🔥</span> ${progress.streak}-day streak</div>
        <div class="learn-xp-track"><div class="learn-xp-fill" style="width:${pct}%"></div></div>
        <span class="learn-xp-label">Level ${level} · ${into}/50 XP</span>
      </div>
      ${closenessHtml}
      <div class="learn-grid">${axisCards}</div>
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
