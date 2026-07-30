// Renders into #goals-content on progress.html. One flat list — goals used
// to be grouped per sandbox persona here, which made the same goal seem to
// disappear depending on which persona you'd last practiced with. See
// goals.js for the shared storage layer and the one-time migration off that
// shape.
function render() {
  const content = document.getElementById("goals-content");
  const goals = loadGoals();

  const listHtml = goals.length ? goals.map(g => {
    const hasTarget = !!g.targetAmount;
    const pct = hasTarget ? Math.max(0, Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100))) : 0;
    return `
      <li class="goal-entry ${g.done ? "goal-done" : ""}" data-goal-id="${esc(g.id)}">
        ${hasTarget
          ? `<p class="goal-title-row">${esc(g.title)}</p>`
          : `<label><input type="checkbox" data-goal-toggle ${g.done ? "checked" : ""}><span>${esc(g.title)}</span></label>`}
        ${g.note ? `<p class="goal-note-text">${esc(g.note)}</p>` : ""}
        ${hasTarget ? `
          <div class="goal-progress-track"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
          <p class="goal-progress-label">${fmt(g.savedAmount)} of ${fmt(g.targetAmount)} saved (${pct}%)${g.done ? " — reached" : ""}</p>
          <form class="goal-progress-form" data-goal-progress-form>
            <input type="number" min="1" step="1" class="goal-progress-input" placeholder="Add amount saved" aria-label="Add to amount saved for ${esc(g.title)}">
            <button class="btn btn-secondary" type="submit">Add</button>
          </form>` : ""}
        <button class="goal-remove" type="button" data-goal-remove aria-label="Remove goal">&times;</button>
      </li>`;
  }).join("") : `<li class="goal-empty">No goals yet — add one below.</li>`;

  content.innerHTML = `
    <p class="lede" style="font-size:14px;">Financial goals you're working toward — these are yours, not tied to any sandbox persona.</p>
    <form class="goal-form" id="goals-add-form">
      <input id="goals-title-input" class="goal-input" maxlength="120" required placeholder="A financial goal you want to work toward" aria-label="Financial goal">
      <input id="goals-target-input" class="goal-input" type="number" min="1" step="1" placeholder="Target amount (optional)" aria-label="Target amount">
      <textarea id="goals-note-input" class="goal-note" maxlength="400" rows="2" placeholder="Why this matters to you (optional)" aria-label="Why this goal matters"></textarea>
      <button class="btn btn-primary" type="submit">Add goal</button>
    </form>
    <ul class="goal-list">${listHtml}</ul>
  `;

  document.getElementById("goals-add-form").addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("goals-title-input").value.trim();
    const targetRaw = document.getElementById("goals-target-input").value;
    const note = document.getElementById("goals-note-input").value.trim();
    if (!title) return;
    addGoal({ title, note, targetAmount: targetRaw ? Number(targetRaw) : null });
    render();
  });

  content.querySelectorAll("[data-goal-toggle]").forEach(input => {
    input.addEventListener("change", () => {
      toggleGoalDone(input.closest("[data-goal-id]").dataset.goalId, input.checked);
      render();
    });
  });
  content.querySelectorAll("[data-goal-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      removeGoalById(btn.closest("[data-goal-id]").dataset.goalId);
      render();
    });
  });
  content.querySelectorAll("[data-goal-progress-form]").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const id = form.closest("[data-goal-id]").dataset.goalId;
      const input = form.querySelector(".goal-progress-input");
      const amount = Number(input.value);
      if (!amount) return;
      logGoalProgress(id, amount);
      render();
    });
  });
}

render();
if (typeof syncGoalsFromServer === "function") syncGoalsFromServer().then(render);
