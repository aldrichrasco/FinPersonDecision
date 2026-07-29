// Goals are the user's own — not scoped to whichever sandbox persona
// happens to be selected. Storage key is unchanged from the old per-persona
// shape ({ [persona]: [goal, ...] }) so existing data migrates in place the
// first time this loads, flattened into one list.
const GOAL_DIARY_KEY = "finperson_goal_diary";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function loadGoals() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(GOAL_DIARY_KEY)); } catch (e) { raw = null; }
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const flat = [];
    Object.values(raw).forEach(entries => (entries || []).forEach(e => flat.push(e)));
    saveGoals(flat);
    return flat;
  }
  return [];
}

function saveGoals(list) {
  try { localStorage.setItem(GOAL_DIARY_KEY, JSON.stringify(list)); } catch (e) {}
}

function addGoal({ title, note, targetAmount }) {
  const list = loadGoals();
  list.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    note: note || "",
    targetAmount: targetAmount || null,
    savedAmount: 0,
    done: false,
  });
  saveGoals(list);
  if (typeof logGoalEvent === "function") logGoalEvent(title, false);
  return list;
}

function logGoalProgress(id, amount) {
  const list = loadGoals();
  const goal = list.find(g => g.id === id);
  if (goal) {
    goal.savedAmount = Math.max(0, (goal.savedAmount || 0) + amount);
    if (goal.targetAmount && goal.savedAmount >= goal.targetAmount && !goal.done) {
      goal.done = true;
      if (typeof logGoalEvent === "function") logGoalEvent(goal.title, true);
    }
  }
  saveGoals(list);
  return list;
}

function toggleGoalDone(id, done) {
  const list = loadGoals();
  const goal = list.find(g => g.id === id);
  if (goal) goal.done = done;
  saveGoals(list);
  if (goal && typeof logGoalEvent === "function") logGoalEvent(goal.title, done);
  return list;
}

function removeGoalById(id) {
  saveGoals(loadGoals().filter(g => g.id !== id));
}
