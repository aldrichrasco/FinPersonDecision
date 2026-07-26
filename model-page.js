(function () {
  try { localStorage.setItem("finperson_visited_model", "1"); } catch (e) {}

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

  // Archetype cards — a tilting, foil-highlight card per archetype (mouse
  // position drives a subtle 3D rotation plus a moving glow, like a
  // trading-card holo effect) instead of a flat text list. Click one to
  // "zoom in": a bigger version of the same card with the full narrative
  // and a real-size radar of that archetype's six-axis profile. Built
  // from scratch for FinPerson's own palette/typography — inspired by
  // the concept of an aceternity.com "comet card," not its source.
  const GROUP_LABELS = {
    conservative: "Conservative", growth: "Growth", impulsive: "Impulsive",
    uncertain: "Uncertain", generous: "Generous",
  };

  function renderArchetypes() {
    const el = document.getElementById("tab-archetypes");
    const cards = PERSONAS.map(p => archetypeCardHtml(p, { compact: true })).join("");
    el.innerHTML = `
      <p class="lede" style="font-size:15px;">Eleven archetypes, each with its own typical pattern and its own characteristic way that pattern can tip into a problem. Tap a card for the full read.</p>
      <div class="archetype-wall">${cards}</div>
    `;
    el.querySelectorAll(".archetype-card").forEach(card => {
      card.querySelectorAll("canvas").forEach(canvas => {
        const profile = ARCHETYPE_PROFILES[card.dataset.slug];
        if (profile && typeof drawRadarChart === "function") drawRadarChart(canvas, profile, {}, { showLabels: false });
      });
      card.addEventListener("click", () => openArchetypeZoom(card.dataset.slug));
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openArchetypeZoom(card.dataset.slug); }
      });
    });
    initCardTilt(el.querySelectorAll(".archetype-card"));
  }

  function archetypeCardHtml(p, { compact }) {
    const gap = ARCHETYPE_GAPS[p.slug];
    const gapHtml = gap ? `
      <p class="archetype-card-row"><strong>Typically:</strong> ${esc(gap.baseline)}</p>
      <p class="archetype-card-row"><strong>Under pressure:</strong> ${esc(gap.observed)}</p>
      <p class="archetype-card-row"><strong>Characteristic risk:</strong> ${esc(gap.gap)} (drifts toward ${esc(gap.drift)})</p>
    ` : "";
    return `
      <div class="archetype-card${compact ? "" : " archetype-card-zoomed"}" data-slug="${esc(p.slug)}" data-group="${esc(p.group)}"
           ${compact ? 'tabindex="0" role="button" aria-label="See full detail for ' + esc(p.name) + '"' : ""}>
        <div class="archetype-card-inner">
          <span class="archetype-card-type">${esc(GROUP_LABELS[p.group] || p.group)}</span>
          <h3>${esc(p.name)}</h3>
          <p class="archetype-card-trait">${esc(p.trait)}</p>
          <canvas class="archetype-card-stats" width="${compact ? 200 : 300}" height="${compact ? 200 : 300}"></canvas>
          ${compact ? `<p class="archetype-card-hint">Tap for the full read &rarr;</p>` : `<div class="archetype-card-detail">${gapHtml}</div>`}
        </div>
      </div>`;
  }

  function openArchetypeZoom(slug) {
    const p = PERSONAS.find(x => x.slug === slug);
    if (!p) return;
    let overlay = document.getElementById("archetype-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "quiz-overlay";
      overlay.id = "archetype-overlay";
      overlay.innerHTML = `
        <div class="quiz-modal archetype-modal" role="dialog" aria-modal="true" aria-labelledby="archetype-zoom-title">
          <div class="quiz-modal-head">
            <span id="archetype-zoom-title">Archetype</span>
            <button class="quiz-close" id="archetype-zoom-close" aria-label="Close">&times;</button>
          </div>
          <div id="archetype-zoom-body"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", e => { if (e.target === overlay) closeArchetypeZoom(); });
      overlay.querySelector("#archetype-zoom-close").addEventListener("click", closeArchetypeZoom);
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && overlay.classList.contains("open")) closeArchetypeZoom();
      });
    }
    document.getElementById("archetype-zoom-title").textContent = p.name;
    const body = document.getElementById("archetype-zoom-body");
    body.innerHTML = archetypeCardHtml(p, { compact: false });
    const canvas = body.querySelector("canvas");
    const profile = ARCHETYPE_PROFILES[slug];
    if (canvas && profile && typeof drawRadarChart === "function") drawRadarChart(canvas, profile, {}, { showLabels: false });
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    document.getElementById("archetype-zoom-close").focus();
  }

  function closeArchetypeZoom() {
    const overlay = document.getElementById("archetype-overlay");
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  // Cursor-driven tilt + moving highlight. Skipped under reduced-motion —
  // click-to-zoom still works either way, this is purely decorative.
  function initCardTilt(cards) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cards.forEach(card => {
      card.addEventListener("mousemove", e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (0.5 - py) * 12;
        const ry = (px - 0.5) * 12;
        card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
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
