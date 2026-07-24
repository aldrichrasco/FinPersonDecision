(function () {
  const C_ORDER = ["C0", "C1", "C2", "C3"];

  function renderCalibration() {
    const el = document.getElementById("tab-calibration");
    const levelsHtml = C_ORDER.map((k, i) => {
      const c = C_LEVELS_PLAIN[k];
      return `
        <div class="model-clevel">
          <span class="model-clevel-rank">${i + 1}</span>
          <div>
            <p class="model-clevel-label">${esc(c.title)}</p>
            <p class="model-clevel-detail">${esc(c.detail)}</p>
          </div>
        </div>`;
    }).join("");

    const modelsHtml = MODEL_KEYS.map(key => {
      const m = DECISION_MODELS[key];
      const axes = (m.relatedAxes || []).map(a => AXES[a] ? AXES[a].label : a).join(", ");
      return `
        <div class="model-belief-card">
          <h3>${esc(m.label)}</h3>
          <p class="model-belief-stance"><strong>The stance:</strong> ${esc(m.stance)}</p>
          <p class="model-belief-counter"><strong>What contradicts it:</strong> ${esc(m.counter)}</p>
          <p class="model-belief-axes">Related axes: ${esc(axes)}</p>
        </div>`;
    }).join("");

    el.innerHTML = `
      <p class="lede" style="font-size:15px;">Everyone starts at step 1 — that's normal, not a bad sign. The goal isn't to feel bad about a pattern, it's to catch it a little earlier each time. Here's the progression, in order:</p>
      <div class="model-clevel-list">${levelsHtml}</div>
      <p class="pattern-body" style="font-size:13px;color:var(--slate);margin:14px 0 0;">In short: steps 1 and 2 are the pattern getting named for you or explained after you acted. Step 3 is you spotting it yourself, still after the fact. Step 4 — seeing it coming before you act — is the one that actually changes the decision, not just how you feel about it afterward.</p>
      <p class="chart-title" style="margin-top:30px;">The beliefs being tested</p>
      <p class="lede" style="font-size:14px;">Each sandbox scenario quietly probes one of these common money beliefs — not because it's wrong, but because it's a stance worth checking against what actually happens.</p>
      <div class="learn-grid">${modelsHtml}</div>
    `;
  }

  function renderAxes() {
    const el = document.getElementById("tab-axes");
    const rows = AXIS_KEYS.map(k => {
      const a = AXES[k];
      return `
        <div class="model-axis-row">
          <h3>${esc(a.label)}</h3>
          <p class="learn-axis-blurb">${esc(a.sub)}</p>
          <div class="model-axis-poles">
            <span>${esc(a.low)}</span>
            <div class="axis-track" style="flex:1;"><div class="axis-fill" style="width:50%"></div></div>
            <span>${esc(a.high)}</span>
          </div>
        </div>`;
    }).join("");
    el.innerHTML = `
      <p class="lede" style="font-size:15px;">Six bipolar dimensions. Nobody sits at one pole — everyone is somewhere along each line, and where you sit isn't good or bad, just a description.</p>
      <div class="learn-grid">${rows}</div>
    `;
  }

  function renderArchetypes() {
    const el = document.getElementById("tab-archetypes");
    const cards = PERSONAS.map(p => {
      const gap = ARCHETYPE_GAPS[p.slug];
      const gapHtml = gap ? `
          <p class="model-archetype-row"><strong>Typically:</strong> ${esc(gap.baseline)}</p>
          <p class="model-archetype-row"><strong>Under pressure:</strong> ${esc(gap.observed)}</p>
          <p class="model-archetype-row"><strong>Characteristic risk:</strong> ${esc(gap.gap)} (drifts toward ${esc(gap.drift)})</p>
        ` : "";
      return `
        <div class="learn-axis-card">
          <span class="learn-axis-tag">${esc(p.group)}</span>
          <h3>${esc(p.name)}</h3>
          <p class="learn-axis-blurb">${esc(p.trait)}</p>
          ${gapHtml}
        </div>`;
    }).join("");
    el.innerHTML = `
      <p class="lede" style="font-size:15px;">Eleven archetypes, each with its own typical pattern and its own characteristic way that pattern can tip into a problem.</p>
      <div class="learn-grid">${cards}</div>
    `;
  }

  const TABS = ["calibration", "axes", "archetypes"];
  function showTab(name) {
    TABS.forEach(t => {
      document.getElementById(`tab-${t}`).hidden = t !== name;
      document.getElementById(`tabbtn-${t}`).classList.toggle("active", t === name);
    });
    if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  }

  TABS.forEach(t => {
    document.getElementById(`tabbtn-${t}`).addEventListener("click", () => showTab(t));
  });

  renderCalibration();
  renderAxes();
  renderArchetypes();

  const initial = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "calibration";
  showTab(initial);
})();
