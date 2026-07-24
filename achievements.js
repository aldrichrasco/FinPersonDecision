// Achievements — unlockable badges for milestones already tracked elsewhere
// in the app. Static definitions + check functions, no server calls of their
// own; the calling page supplies a `ctx` snapshot of already-available state
// (quiz profile, Learn progress, IDM calibration, goal diary, sandbox
// wellbeing history) and gets back which achievements are newly earned.

const VISITED_MODEL_KEY = "finperson_visited_model";

const ACHIEVEMENTS = [
  {
    id: "first_steps",
    title: "First Steps",
    description: "Took the 30-second quiz.",
    icon: "🌱",
    check: (ctx) => !!ctx.profile,
  },
  {
    id: "into_the_sandbox",
    title: "Into the Sandbox",
    description: "Made your first practice decision.",
    icon: "🧭",
    check: (ctx) => ctx.wellbeingHistory.length >= 1,
  },
  {
    id: "streak_starter",
    title: "Streak Starter",
    description: "Kept a 3-day Learn streak going.",
    icon: "🔥",
    check: (ctx) => (ctx.learn && ctx.learn.streak >= 3),
  },
  {
    id: "saw_it_coming",
    title: "Saw It Coming",
    description: "Recognized a pattern before acting on it — anticipatory calibration (C3).",
    icon: "🔮",
    check: (ctx) => Object.values(ctx.idm || {}).some(m => m.bestC === "C3"),
  },
  {
    id: "goal_setter",
    title: "Goal Setter",
    description: "Wrote down your first financial goal.",
    icon: "🎯",
    check: (ctx) => (ctx.goals || []).length >= 1,
  },
  {
    id: "goal_getter",
    title: "Goal Getter",
    description: "Completed a goal.",
    icon: "✅",
    check: (ctx) => (ctx.goals || []).some(g => g.done),
  },
  {
    id: "in_the_zone",
    title: "In the Zone",
    description: "Landed inside the homeostasis zone 5 times.",
    icon: "🟢",
    check: (ctx) => ctx.wellbeingHistory.filter(h => h.zone === "homeostasis").length >= 5,
  },
  {
    id: "full_course",
    title: "Full Course",
    description: "Completed every lesson for one Learn axis.",
    icon: "📘",
    check: (ctx) => {
      if (!ctx.learn || !Array.isArray(ctx.learn.completed) || typeof LEARN_CONTENT === "undefined") return false;
      return Object.keys(LEARN_CONTENT).some(axis => {
        const total = LEARN_CONTENT[axis].lessons.length;
        const done = ctx.learn.completed.filter(k => k.startsWith(`${axis}:`)).length;
        return total > 0 && done >= total;
      });
    },
  },
  {
    id: "know_thyself",
    title: "Know Thyself",
    description: "Read about the model behind FinPerson.",
    icon: "🔎",
    check: (ctx) => ctx.visitedModel,
  },
  {
    id: "belief_tested",
    title: "Belief Tested",
    description: "Engaged 3 different money beliefs in the sandbox.",
    icon: "🧩",
    check: (ctx) => Object.values(ctx.idm || {}).filter(m => m.encounters > 0).length >= 3,
  },
];

const ACHIEVEMENTS_LOCAL_KEY = "finperson_achievements";

function loadLocalUnlocked() {
  try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_LOCAL_KEY)) || []; } catch (e) { return []; }
}
function saveLocalUnlocked(ids) {
  try { localStorage.setItem(ACHIEVEMENTS_LOCAL_KEY, JSON.stringify(ids)); } catch (e) {}
}

function loadGoalsAcrossPersonas() {
  try {
    const diary = JSON.parse(localStorage.getItem("finperson_goal_diary")) || {};
    const all = [];
    Object.values(diary).forEach(entries => (entries || []).forEach(e => all.push(e)));
    return all;
  } catch (e) {
    return [];
  }
}

function buildAchievementCtx(wellbeingHistory) {
  return {
    profile: typeof getProfile === "function" ? getProfile() : null,
    learn: (() => {
      try { return JSON.parse(localStorage.getItem("finperson_learn_progress")); } catch (e) { return null; }
    })(),
    idm: typeof loadIDM === "function" ? loadIDM() : {},
    goals: loadGoalsAcrossPersonas(),
    wellbeingHistory: wellbeingHistory || [],
    visitedModel: (() => {
      try { return localStorage.getItem(VISITED_MODEL_KEY) === "1"; } catch (e) { return false; }
    })(),
  };
}

// Runs the full check-and-sync pass: merges local+server unlocked ids,
// evaluates all achievements against current state, persists anything newly
// earned both locally and to the server. Call from any page; `onUnlocked`
// (optional) receives the newly-earned achievement objects for a toast.
async function runAchievementCheck(onUnlocked) {
  const [serverUnlocked, wellbeingHistory] = await Promise.all([
    typeof fetchAchievements === "function" ? fetchAchievements() : Promise.resolve([]),
    typeof fetchWellbeingHistory === "function" ? fetchWellbeingHistory() : Promise.resolve([]),
  ]);
  const local = loadLocalUnlocked();
  const merged = [...new Set([...local, ...serverUnlocked])];
  const ctx = buildAchievementCtx(wellbeingHistory);
  const { unlocked, newlyUnlocked } = evaluateAchievements(ctx, merged);

  if (newlyUnlocked.length || unlocked.length !== local.length) {
    saveLocalUnlocked(unlocked);
    if (typeof saveAchievements === "function") saveAchievements(unlocked);
  }
  if (newlyUnlocked.length && typeof onUnlocked === "function") {
    onUnlocked(ACHIEVEMENTS.filter(a => newlyUnlocked.includes(a.id)));
  }
  return { unlocked, newlyUnlocked };
}

// Returns { unlocked: string[], newlyUnlocked: string[] } given a ctx and the
// set of ids already known to be unlocked (from local + server merge).
function evaluateAchievements(ctx, alreadyUnlocked) {
  const already = new Set(alreadyUnlocked || []);
  const unlocked = new Set(already);
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (already.has(a.id)) return;
    try {
      if (a.check(ctx)) {
        unlocked.add(a.id);
        newlyUnlocked.push(a.id);
      }
    } catch (e) { /* a missing ctx field just means "not earned yet" */ }
  });
  return { unlocked: [...unlocked], newlyUnlocked };
}
