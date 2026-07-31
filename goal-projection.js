// "If I saved $X a month, when would I hit this?" — the simplest honest
// version of a financial what-if: real arithmetic on the goal's own
// numbers (see goals.js for the {targetAmount, savedAmount} shape), not a
// forecast dressed up as a prediction. No market assumptions, no interest,
// just remaining amount divided by monthly pace.
function projectGoalCompletion(goal, monthlyAmount, now) {
  if (!goal || !(goal.targetAmount > 0)) return null;
  if (!(monthlyAmount > 0)) return null;
  const remaining = goal.targetAmount - (goal.savedAmount || 0);
  const base = now ? new Date(now) : new Date();
  if (remaining <= 0) return { monthsToGoal: 0, remaining: 0, projectedDate: base };
  const monthsToGoal = Math.ceil(remaining / monthlyAmount);
  const projectedDate = new Date(base.getFullYear(), base.getMonth() + monthsToGoal, base.getDate());
  return { monthsToGoal, remaining, projectedDate };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { projectGoalCompletion };
}
