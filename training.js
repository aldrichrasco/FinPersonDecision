// Spaced-repetition engine for Behavioral Training (training.html). Same
// split as roadmap.js: pure, DOM-free functions at the top (unit-tested
// in tests-js/training.test.js), stateful localStorage/server wiring
// below. A SEPARATE progress store (training_progress) from both
// learning_progress and roadmap_progress — this one tracks per-level
// REPETITION state (how many times, when's the next review due), a
// different shape than either "completed once" list.
//
// Interval ladder is a simplified SM-2-style schedule, not the full
// algorithm (no per-item ease factor, no failure handling beyond just
// redoing it) — proportionate to what this app actually needs: nudge
// someone back to a real exercise after a few days, then longer, not a
// full flashcard-scheduling system.
const TRAINING_REVIEW_INTERVALS_DAYS = [3, 7, 14, 30];

function normalizeTrainingProgress(p) {
  return (p && typeof p === "object" && !Array.isArray(p)) ? p : {};
}

// repCountAfter is 1 for the first completion, 2 for the second, etc. —
// the interval grows each time, capping at the ladder's last (longest)
// step rather than growing forever.
function nextTrainingDueAt(repCountAfter, nowMs) {
  const idx = Math.min(Math.max(repCountAfter, 1), TRAINING_REVIEW_INTERVALS_DAYS.length) - 1;
  return nowMs + TRAINING_REVIEW_INTERVALS_DAYS[idx] * 86400000;
}

function isTrainingDue(entry, nowMs) {
  return !entry || typeof entry.dueAt !== "number" || entry.dueAt <= nowMs;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TRAINING_REVIEW_INTERVALS_DAYS, normalizeTrainingProgress, nextTrainingDueAt, isTrainingDue,
  };
}

if (typeof window !== "undefined") {
(function (global) {
  const LOCAL_KEY = "finperson_training_progress";

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveLocal(p) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)); } catch (e) {}
  }

  let progress = normalizeTrainingProgress(loadLocal());
  let syncedOnce = false;

  function persist() {
    saveLocal(progress);
    if (typeof saveTrainingProgress === "function") saveTrainingProgress(progress); // no-op if not signed in
  }

  function syncFromServer() {
    if (syncedOnce || typeof fetchTrainingProgress !== "function") return Promise.resolve(progress);
    syncedOnce = true;
    return fetchTrainingProgress().then(serverProgress => {
      const normalized = normalizeTrainingProgress(serverProgress);
      // Merge rather than replace: keep whichever entry per level has
      // seen more reps, in case local and server drifted (e.g. used
      // anonymously on two devices before ever signing in on either).
      Object.keys(normalized).forEach(levelId => {
        const local = progress[levelId];
        const server = normalized[levelId];
        if (!local || (server.repCount || 0) >= (local.repCount || 0)) progress[levelId] = server;
      });
      saveLocal(progress);
      return progress;
    }).catch(() => progress);
  }

  // Always advances the schedule, unlike roadmap.js's markRoadmapLevelComplete
  // (idempotent, "have you EVER done this") — a review is a review every
  // time, not just the first. No-ops for levels not in the training
  // rotation at all (see training-data.js's LEVEL_AXIS_TAGS).
  function markRep(levelId) {
    const tags = (typeof LEVEL_AXIS_TAGS !== "undefined") ? LEVEL_AXIS_TAGS[levelId] : null;
    if (!tags) return false;
    const prev = progress[levelId] || { repCount: 0 };
    const repCount = (prev.repCount || 0) + 1;
    const dueAt = nextTrainingDueAt(repCount, Date.now());
    progress[levelId] = { repCount, dueAt, lastCompletedAt: Date.now() };
    persist();
    return true;
  }

  global.markTrainingRep = markRep;
  global.getTrainingProgress = () => progress;
  global.trainingSyncFromServer = syncFromServer;
})(window);
}
