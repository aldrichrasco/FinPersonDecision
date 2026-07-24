// Goals used to live only inside dashboard.html's per-persona drawer — leave
// the sandbox and they were effectively invisible. Same storage/shape
// (finperson_goal_diary, GOAL_DIARY_KEY from dashboard.js), just rendered
// across every persona at once so nothing disappears.
const GOAL_DIARY_KEY = "finperson_goal_diary";

function loadGoalDiary() {
  try { return JSON.parse(localStorage.getItem(GOAL_DIARY_KEY)) || {}; } catch (e) { return {}; }
}
function saveGoalDiary(data) {
  try { localStorage.setItem(GOAL_DIARY_KEY, JSON.stringify(data)); } catch (e) {}
}
function updateGoal(persona, id, changes) {
  const diary = loadGoalDiary();
  diary[persona] = (diary[persona] || []).map(entry => entry.id === id ? { ...entry, ...changes } : entry);
  saveGoalDiary(diary);
  render();
}
function removeGoal(persona, id) {
  const diary = loadGoalDiary();
  diary[persona] = (diary[persona] || []).filter(entry => entry.id !== id);
  saveGoalDiary(diary);
  render();
}
function addGoal(persona, title, note) {
  const diary = loadGoalDiary();
  const entries = diary[persona] || [];
  entries.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, note, done: false });
  diary[persona] = entries;
  saveGoalDiary(diary);
  if (typeof logGoalEvent === "function") logGoalEvent(title, false);
  render();
}

function personaLabel(slug) {
  const p = PERSONAS.find(x => x.slug === slug);
  return p ? p.name : slug;
}

function render() {
  const content = document.getElementById("goals-content");
  const diary = loadGoalDiary();
  const personaSlugs = Object.keys(diary).filter(slug => (diary[slug] || []).length > 0);

  const activeSlug = (typeof getProfile === "function" && getProfile()) ? getProfile().archetype : null;
  const groupSlugs = personaSlugs.includes(activeSlug) || !activeSlug
    ? personaSlugs
    : [activeSlug, ...personaSlugs];
  const uniqueSlugs = groupSlugs.length ? [...new Set(groupSlugs)] : (activeSlug ? [activeSlug] : []);

  if (!uniqueSlugs.length) {
    content.innerHTML = `<p class="scenario-empty-body">No goals yet. <a href="dashboard.html">Open the sandbox</a> and add one from any persona — it'll show up here.</p>`;
    return;
  }

  content.innerHTML = uniqueSlugs.map(slug => {
    const entries = diary[slug] || [];
    const listHtml = entries.length
      ? entries.map(e => `
        <li class="goal-entry ${e.done ? "goal-done" : ""}">
          <label><input type="checkbox" data-goal-id="${esc(e.id)}" data-persona="${esc(slug)}" ${e.done ? "checked" : ""}><span>${esc(e.title)}</span></label>
          ${e.note ? `<p>${esc(e.note)}</p>` : ""}
          <button class="goal-remove" type="button" data-goal-remove="${esc(e.id)}" data-persona="${esc(slug)}" aria-label="Remove goal">&times;</button>
        </li>`).join("")
      : `<li class="goal-empty">No goals yet for this persona.</li>`;

    return `
      <section class="goal-diary" style="margin-bottom:22px;" aria-labelledby="goal-title-${esc(slug)}">
        <p class="scenario-eyebrow">${esc(personaLabel(slug))}</p>
        <h3 id="goal-title-${esc(slug)}">Goals and notes</h3>
        <form class="goal-form" data-persona-form="${esc(slug)}">
          <input class="goal-input" maxlength="120" required placeholder="A financial goal you want to work toward" aria-label="Financial goal">
          <textarea class="goal-note" maxlength="400" rows="2" placeholder="Why this matters to you (optional)" aria-label="Why this goal matters"></textarea>
          <button class="btn btn-primary" type="submit">Add goal</button>
        </form>
        <ul class="goal-list">${listHtml}</ul>
      </section>`;
  }).join("");

  content.querySelectorAll("[data-goal-id]").forEach(input => {
    input.addEventListener("change", () => updateGoal(input.dataset.persona, input.dataset.goalId, { done: input.checked }));
  });
  content.querySelectorAll("[data-goal-remove]").forEach(button => {
    button.addEventListener("click", () => removeGoal(button.dataset.persona, button.dataset.goalRemove));
  });
  content.querySelectorAll("[data-persona-form]").forEach(form => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = form.querySelector(".goal-input").value.trim();
      const note = form.querySelector(".goal-note").value.trim();
      if (!title) return;
      addGoal(form.dataset.personaForm, title, note);
    });
  });
}

render();
