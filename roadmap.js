// Shared roadmap progress engine — included on every page that has an
// instrumented level, plus roadmap.html itself. Same XP/level/streak
// mechanic as learn-page.js's Learn-topic gamification (50 XP per level,
// streak bumps once per calendar day), kept as a SEPARATE progress store
// (roadmap_progress, not learning_progress) so that already-working code
// never has to change — roadmap.html additively combines both totals for
// one displayed level. See db.py's ddl_roadmap_progress comment.
//
// Pure, DOM-free functions live at the top (unit-tested in
// tests-js/roadmap.test.js). The stateful part below — localStorage,
// server sync, toast celebrations — is browser-only, same split as
// turtle-sim.js / pro-turtle-page.js.

function normalizeRoadmapProgress(p) {
  return {
    completed: Array.isArray(p && p.completed) ? p.completed : [],
    xp: (p && typeof p.xp === "number") ? p.xp : 0,
    streak: (p && typeof p.streak === "number") ? p.streak : 0,
    lastActivityDate: (p && p.lastActivityDate) || null,
  };
}

// 50 XP per level, same convention as learn-page.js's xpForNextLevel —
// kept identical so "Level N" means the same thing whichever page a
// person sees it on, even though the two XP pools are tracked separately.
function roadmapXpForLevel(xp) {
  const level = Math.floor(xp / 50);
  const into = xp - level * 50;
  return { level: level + 1, into, pct: Math.round((into / 50) * 100) };
}

function bumpRoadmapStreak(progress, todayStr, yesterdayStr) {
  if (progress.lastActivityDate === todayStr) return progress; // already counted today
  progress.streak = progress.lastActivityDate === yesterdayStr ? progress.streak + 1 : 1;
  progress.lastActivityDate = todayStr;
  return progress;
}

// How many of a tier's levels are done, and whether the tier before it
// is done enough to unlock this one — tier 1 is always unlocked; each
// later tier unlocks once EVERY level in the previous tier is completed
// (the "hybrid" gating: locked between tiers, free within one).
function roadmapTierStatus(tiers, completed) {
  const completedSet = new Set(completed);
  let previousTierDone = true;
  return tiers.map(tier => {
    const total = tier.levels.length;
    const done = tier.levels.filter(l => completedSet.has(l.id)).length;
    const unlocked = previousTierDone;
    previousTierDone = previousTierDone && done === total;
    return { tier, done, total, unlocked, complete: done === total };
  });
}

function levelXpFromTiers(tiers, levelId) {
  for (const tier of tiers) {
    const lvl = tier.levels.find(l => l.id === levelId);
    if (lvl) return lvl.xp || 10;
  }
  return 10;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeRoadmapProgress, roadmapXpForLevel, bumpRoadmapStreak, roadmapTierStatus, levelXpFromTiers,
  };
}

if (typeof window !== "undefined") {
(function (global) {
  const LOCAL_KEY = "finperson_roadmap_progress";

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveLocal(p) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function yesterdayStr() { return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }

  let progress = normalizeRoadmapProgress(loadLocal());
  let syncedOnce = false;

  function persist() {
    saveLocal(progress);
    if (typeof saveRoadmapProgress === "function") saveRoadmapProgress(progress); // no-op if not signed in
  }

  function syncFromServer() {
    if (syncedOnce || typeof fetchRoadmapProgress !== "function") return Promise.resolve(progress);
    syncedOnce = true;
    return fetchRoadmapProgress().then(serverProgress => {
      if (serverProgress && Array.isArray(serverProgress.completed) && serverProgress.completed.length >= progress.completed.length) {
        progress = normalizeRoadmapProgress(serverProgress);
        saveLocal(progress);
      }
      return progress;
    }).catch(() => progress);
  }

  const ENCOURAGEMENTS = ["Nice!", "Great work!", "Keep it up!", "Solid.", "That's the habit."];

  function markComplete(levelId) {
    if (progress.completed.includes(levelId)) return false;
    const tiers = typeof ROADMAP_TIERS !== "undefined" ? ROADMAP_TIERS : [];
    const xpGain = levelXpFromTiers(tiers, levelId);
    const beforeLevel = roadmapXpForLevel(progress.xp).level;

    progress.completed.push(levelId);
    progress.xp += xpGain;
    bumpRoadmapStreak(progress, todayStr(), yesterdayStr());
    persist();

    const afterLevel = roadmapXpForLevel(progress.xp).level;
    if (typeof toast === "function") {
      if (afterLevel > beforeLevel) {
        toast(`Level up! You're now Level ${afterLevel}.`, { tone: "good", duration: 3200 });
      } else {
        const line = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
        toast(`${line} +${xpGain} XP`, { tone: "good", duration: 2000 });
      }
    }
    return true;
  }

  global.markRoadmapLevelComplete = markComplete;
  global.getRoadmapProgress = () => progress;
  global.roadmapSyncFromServer = syncFromServer;
})(window);
}
