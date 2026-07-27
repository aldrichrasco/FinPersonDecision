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

  // The academic grounding behind each axis — not because a citation makes
  // the app more authoritative than it is (it's still an educational tool,
  // not a validated instrument), but because "why this axis" deserves a
  // real answer rather than an invented-sounding label. Each axis maps to
  // the closest-fitting established construct; where the fit is close but
  // not exact, the blurb says so rather than overclaiming a 1:1 match.
  const AXIS_RESEARCH = {
    impulse_regulation: {
      blurb: "Rooted in the classic study of delayed gratification, and in how people mentally separate a “spend now” account from a “save for later” one.",
      citation: "Mischel & Ebbesen (1970); Thaler (1985)",
    },
    risk_disposition: {
      blurb: "Comfort with financial risk isn't just numeracy — personality traits measurably shift how much uncertainty and potential loss someone will tolerate.",
      citation: "Pinjisakikool (2018)",
    },
    temporal_orientation: {
      blurb: "Drawn from the Consideration of Future Consequences scale — how much weight a decision-maker gives to outcomes that are still years away.",
      citation: "Strathman et al. (1994)",
    },
    financial_attentiveness: {
      blurb: "People selectively look away from their own numbers when things look bad — attention itself (logins, balance checks) is measurable and predicts outcomes independent of literacy.",
      citation: "Sicherman, Loewenstein, Seppi & Utkus (2016); related: Lusardi & Mitchell (2014) on financial literacy",
    },
    financial_self_efficacy: {
      blurb: "Adapted from Bandura's general self-efficacy work into a financial-specific scale: how much control and capability someone feels over their own situation, distinct from how capable they actually are.",
      citation: "Lown (2011)",
    },
    prosocial_orientation: {
      blurb: "Spending directed at other people's welfare rather than one's own consumption is its own measurable dimension of financial behavior, not simply generosity-as-personality.",
      citation: "Dunn, Aknin & Norton (2008)",
    },
  };

  function renderAxes() {
    const el = document.getElementById("tab-axes");
    const rows = AXIS_KEYS.map(k => {
      const a = AXES[k];
      const r = AXIS_RESEARCH[k];
      return `
        <div class="model-axis-row">
          <h3>${esc(a.label)}</h3>
          <p class="learn-axis-blurb">${esc(a.sub)}</p>
          <div class="model-axis-poles">
            <span>${esc(a.low)}</span>
            <div class="axis-track" style="flex:1;"><div class="axis-fill" style="width:50%"></div></div>
            <span>${esc(a.high)}</span>
          </div>
          ${r ? `
          <p class="model-axis-research">${esc(r.blurb)}</p>
          <p class="model-axis-citation">${esc(r.citation)}</p>` : ""}
        </div>`;
    }).join("");
    el.innerHTML = `
      <p class="lede" style="font-size:15px;">Six bipolar dimensions. Nobody sits at one pole — everyone is somewhere along each line, and where you sit isn't good or bad, just a description.</p>
      <div class="learn-grid">${rows}</div>
      <p class="pattern-body" style="font-size:12.5px;color:var(--slate);margin-top:18px;">These are FinPerson's own synthesized axes, not a single validated instrument — each is grounded in the closest-fitting research above, adapted rather than reproduced verbatim.</p>
    `;
  }

  // Archetype cards — a tilting, foil-highlight card per archetype (mouse
  // position drives a subtle 3D rotation plus a moving glow, like a
  // trading-card holo effect), which now also flips in place on click/tap
  // like a trading card: an abstract "portrait" (an icon in the group's
  // color, not a photo — this app has no image assets to pull a literal
  // stock photo from) on the front, the six-axis radar and the gap
  // narrative on the back. Built from scratch for FinPerson's own
  // palette/typography — inspired by the concept of an aceternity.com
  // "comet card," not its source.
  const GROUP_LABELS = {
    conservative: "Conservative", growth: "Growth", impulsive: "Impulsive",
    uncertain: "Uncertain", generous: "Generous",
  };
  const ARCHETYPE_ICON = {
    steady_saver: "●", cautious_guardian: "▣", conscious_spender: "◐",
    ambitious_builder: "▲", strategic_risk_taker: "◆", overconfident_navigator: "▶",
    status_seeker: "★", impulsive_spender: "✦", anxious_avoider: "◌",
    passive_drifter: "∿", purposeful_giver: "✚",
  };
  // Who each archetype tends to describe, and what it's most worth reading
  // up on — reference material for the curious, not something the app
  // scores you against. Same slugs as PERSONAS/ARCHETYPE_PROFILES.
  const ARCHETYPE_AUDIENCE = {
    steady_saver: { users: "People who want consistent, long-term savings habits without overwhelm.", topics: "Emergency funds, inflation-proof savings, and retirement planning" },
    conscious_spender: { users: "People who enjoy spending but want better budgeting and control.", topics: "Budgeting, discretionary vs. essential spending, digital wallets" },
    ambitious_builder: { users: "Goal-oriented individuals seeking financial independence or long-term wealth.", topics: "Investment strategy, portfolio growth, compound interest" },
    anxious_avoider: { users: "Those who feel overwhelmed, intimidated, or stressed by money topics.", topics: "Financial basics, money mindset, step-by-step planning" },
    purposeful_giver: { users: "Generous people who want to give meaningfully without harming their own finances.", topics: "Charitable giving, values-based budgeting, and giving boundaries" },
    strategic_risk_taker: { users: "People open to taking risks but want to do so with strategy and control.", topics: "Diversification, risk profiling, and advanced investing tools" },
    cautious_guardian: { users: "Security-seekers who want to feel safe while still making smart money decisions.", topics: "Insurance, low-risk savings, secure retirement products" },
    impulsive_spender: { users: "Individuals prone to emotional spending or quick money decisions.", topics: "Spending triggers, accountability tools, and spending detox plans" },
    overconfident_navigator: { users: "People who are confident with money may overlook blind spots or risks.", topics: "Risk calibration, second opinions, behavioural investing" },
    status_seeker: { users: "Those who tie financial success to self-worth or external image.", topics: "Values alignment, financial identity, anti-consumerism mindset" },
    passive_drifter: { users: "People who are disengaged, indifferent, or who rely too heavily on others financially.", topics: "Motivation, basic planning, setting & tracking simple goals" },
  };

  function renderArchetypes() {
    const el = document.getElementById("tab-archetypes");
    const cards = PERSONAS.map(p => archetypeCardHtml(p)).join("");
    const audienceRows = PERSONAS.map(p => {
      const a = ARCHETYPE_AUDIENCE[p.slug];
      if (!a) return "";
      return `<tr><th scope="row">${esc(p.name)}</th><td>${esc(a.users)}</td><td>${esc(a.topics)}</td></tr>`;
    }).join("");
    el.innerHTML = `
      <p class="lede" style="font-size:15px;">Eleven archetypes, each with its own typical pattern and its own characteristic way that pattern can tip into a problem. Tap a card to see the stats behind it.</p>
      <div class="archetype-wall">${cards}</div>
      <p class="chart-title" style="margin-top:34px;">Who each archetype tends to describe</p>
      <div class="archetype-audience-table-wrap">
        <table class="archetype-audience-table">
          <caption class="sr-only">Archetype, the people it tends to describe, and topics most relevant to them</caption>
          <thead><tr><th scope="col">Archetype</th><th scope="col">Relevant users</th><th scope="col">Relevant topics</th></tr></thead>
          <tbody>${audienceRows}</tbody>
        </table>
      </div>
    `;
    el.querySelectorAll(".archetype-card").forEach(card => {
      const canvas = card.querySelector("canvas");
      const profile = ARCHETYPE_PROFILES[card.dataset.slug];
      if (canvas && profile && typeof drawRadarChart === "function") drawRadarChart(canvas, profile, {}, { showLabels: "compact" });
      card.addEventListener("click", () => toggleArchetypeFlip(card));
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleArchetypeFlip(card); }
      });
      card.querySelectorAll(".archetype-card-expand").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          openArchetypeExpand(card.dataset.slug);
        });
      });
    });
    initCardTilt(el.querySelectorAll(".archetype-card"));
  }

  // A second, bigger look at one archetype — the card itself (front or
  // flipped-back) is deliberately grid-sized and cramped by design; this
  // is for someone who wants the radar's real labels and ring values,
  // not just the compact single-word ones the small card has room for.
  function openArchetypeExpand(slug) {
    const p = PERSONAS.find(x => x.slug === slug);
    if (!p) return;
    let overlay = document.getElementById("archetype-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "quiz-overlay";
      overlay.id = "archetype-overlay";
      overlay.innerHTML = `
        <div class="quiz-modal archetype-expand-modal" role="dialog" aria-modal="true" aria-labelledby="archetype-expand-title">
          <div class="quiz-modal-head">
            <span id="archetype-expand-title">Archetype</span>
            <button class="quiz-close" id="archetype-expand-close" aria-label="Close">&times;</button>
          </div>
          <div id="archetype-expand-body"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", e => { if (e.target === overlay) closeArchetypeExpand(); });
      overlay.querySelector("#archetype-expand-close").addEventListener("click", closeArchetypeExpand);
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && overlay.classList.contains("open")) closeArchetypeExpand();
      });
    }
    const gap = ARCHETYPE_GAPS[p.slug];
    const gapHtml = gap ? `
      <p class="archetype-card-row"><strong>Typically:</strong> ${esc(gap.baseline)}</p>
      <p class="archetype-card-row"><strong>Under pressure:</strong> ${esc(gap.observed)}</p>
      <p class="archetype-card-row"><strong>Characteristic risk:</strong> ${esc(gap.gap)} (drifts toward ${esc(gap.drift)})</p>
    ` : "";
    document.getElementById("archetype-expand-title").textContent = p.name;
    const body = document.getElementById("archetype-expand-body");
    body.className = "archetype-card";
    body.setAttribute("data-group", p.group);
    body.innerHTML = `
      <div class="archetype-card-portrait" aria-hidden="true"><span>${ARCHETYPE_ICON[p.slug] || "●"}</span></div>
      <span class="archetype-card-type">${esc(GROUP_LABELS[p.group] || p.group)}</span>
      <h3>${esc(p.name)}</h3>
      <p class="archetype-card-trait">${esc(p.trait)}</p>
      <canvas class="archetype-card-stats" width="320" height="320" style="max-width:320px;"></canvas>
      <div class="archetype-card-detail">${gapHtml}</div>
    `;
    const canvas = body.querySelector("canvas");
    const profile = ARCHETYPE_PROFILES[slug];
    if (canvas && profile && typeof drawRadarChart === "function") drawRadarChart(canvas, profile, {});
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    document.getElementById("archetype-expand-close").focus();
  }

  function closeArchetypeExpand() {
    const overlay = document.getElementById("archetype-overlay");
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  function toggleArchetypeFlip(card) {
    const flipped = card.classList.toggle("is-flipped");
    card.setAttribute("aria-pressed", String(flipped));
    card.querySelector(".archetype-card-front").setAttribute("aria-hidden", String(flipped));
    card.querySelector(".archetype-card-back").setAttribute("aria-hidden", String(!flipped));
  }

  function archetypeCardHtml(p) {
    const gap = ARCHETYPE_GAPS[p.slug];
    const gapHtml = gap ? `
      <p class="archetype-card-row"><strong>Typically:</strong> ${esc(gap.baseline)}</p>
      <p class="archetype-card-row"><strong>Under pressure:</strong> ${esc(gap.observed)}</p>
      <p class="archetype-card-row"><strong>Characteristic risk:</strong> ${esc(gap.gap)} (drifts toward ${esc(gap.drift)})</p>
    ` : "";
    const typeBadge = `<span class="archetype-card-type">${esc(GROUP_LABELS[p.group] || p.group)}</span>`;
    return `
      <div class="archetype-card" data-slug="${esc(p.slug)}" data-group="${esc(p.group)}"
           tabindex="0" role="button" aria-pressed="false" aria-label="${esc(p.name)}. Tap to see the stats.">
        <div class="archetype-card-inner">
          <div class="archetype-card-face archetype-card-front">
            <button class="archetype-card-expand" type="button" aria-label="View ${esc(p.name)} larger">&#10530;</button>
            ${typeBadge}
            <div class="archetype-card-portrait" aria-hidden="true"><span>${ARCHETYPE_ICON[p.slug] || "●"}</span></div>
            <h3>${esc(p.name)}</h3>
            <p class="archetype-card-trait">${esc(p.trait)}</p>
            <p class="archetype-card-hint">Tap to see the stats &rarr;</p>
          </div>
          <div class="archetype-card-face archetype-card-back" aria-hidden="true">
            <button class="archetype-card-expand" type="button" aria-label="View ${esc(p.name)} larger">&#10530;</button>
            ${typeBadge}
            <h3>${esc(p.name)}</h3>
            <canvas class="archetype-card-stats" width="220" height="220"></canvas>
            <div class="archetype-card-detail">${gapHtml}</div>
          </div>
        </div>
      </div>`;
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
