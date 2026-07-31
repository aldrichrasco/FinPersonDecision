(function () {
  const content = document.getElementById("achievements-content");
  const status = document.getElementById("achievements-status");

  // freshIds get a one-time unlock flourish (scale + glow) instead of just
  // appearing already-flipped — the one place on this page a badge going
  // from locked to earned is a rare, first-time moment worth a small
  // celebration rather than a plain re-render.
  function render(unlockedIds, freshIds) {
    const unlocked = new Set(unlockedIds);
    const fresh = new Set(freshIds || []);
    status.style.display = "none";
    content.innerHTML = `
      <p class="chart-title">${unlocked.size} of ${ACHIEVEMENTS.length} unlocked</p>
      <div class="learn-grid">
        ${ACHIEVEMENTS.map(a => {
          const done = unlocked.has(a.id);
          return `
            <div class="learn-axis-card ${done ? "is-strength" : ""} ${fresh.has(a.id) ? "is-newly-unlocked" : ""}" style="${done ? "" : "opacity:.55;"}">
              <span class="learn-axis-tag">${done ? "Unlocked" : "Locked"}</span>
              <h3>${done ? a.icon : "🔒"} ${esc(a.title)}</h3>
              <p class="learn-axis-blurb">${esc(a.description)}</p>
            </div>`;
        }).join("")}
      </div>
    `;
  }

  // Render immediately from whatever's local, then refresh after the full
  // check-and-sync pass resolves — this must re-render regardless of
  // whether anything was NEWLY earned, since a server merge alone (e.g. on
  // a fresh device) changes what should show as unlocked without any
  // achievement being "new" in this session.
  render(loadLocalUnlocked());
  runAchievementCheck((newly) => {
    if (newly.length && typeof toast === "function") {
      toast(`Unlocked: ${newly.map(a => a.title).join(", ")}`, { tone: "good", duration: 4500 });
    }
  }).then(({ unlocked, newlyUnlocked }) => render(unlocked, newlyUnlocked));
})();
