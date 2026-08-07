// The Full Assessment flow — see assessment-items.js for the instrument
// itself and the scoring math. Presented in six sections (one per axis,
// five statements each) rather than one long scroll or one item per
// screen: a whole axis at once is a natural unit to complete, and six
// short sections read as progress instead of thirty individual hurdles.
(function () {
  const content = document.getElementById("assessment-content");
  if (!content) return;

  const AXIS_ORDER = typeof AXIS_KEYS !== "undefined" ? AXIS_KEYS
    : [...new Set(ASSESSMENT_ITEMS.map(i => i.axis))];
  let sectionIndex = -1; // -1 = intro
  const responses = {};

  function itemsForAxis(axis) {
    return ASSESSMENT_ITEMS.filter(i => i.axis === axis);
  }

  function renderIntro() {
    content.innerHTML = `
      <p class="scenario-eyebrow">A closer look</p>
      <h1 style="font-family:var(--font-display);font-weight:500;margin:0 0 10px;">The full assessment</h1>
      <p class="lede" style="font-size:16px;max-width:60ch;">
        The quick quiz gives you a fast first read. This is the longer, more careful version —
        ${ASSESSMENT_ITEMS.length} statements, five per axis, rated on how much you agree with each one.
        It replaces your quiz result with a more precise version of the same six numbers, not a
        second, separate profile.
      </p>
      <p class="report-meta" style="margin:12px 0 24px;">Takes about 5 minutes. Some statements are worded in opposite directions on purpose — that's a standard survey-design check, not a trick.</p>
      <button class="btn btn-primary" id="assess-start" type="button">Start the assessment</button>
      <a class="btn btn-secondary" href="progress.html" style="margin-left:8px;">Not now</a>
    `;
    document.getElementById("assess-start").addEventListener("click", () => {
      sectionIndex = 0;
      renderSection();
    });
  }

  function renderSection() {
    const axis = AXIS_ORDER[sectionIndex];
    const meta = AXES[axis];
    const items = itemsForAxis(axis);
    const answeredHere = items.filter(i => typeof responses[i.id] === "number").length;

    content.innerHTML = `
      <p class="scenario-eyebrow">Section ${sectionIndex + 1} of ${AXIS_ORDER.length}</p>
      <h2 style="font-family:var(--font-display);font-weight:500;margin:0 0 4px;">${esc(meta.label)}</h2>
      <p class="report-meta" style="margin:0 0 22px;">${esc(meta.sub)}</p>
      <div class="assess-items">
        ${items.map(item => assessItemHtml(item)).join("")}
      </div>
      <div class="recap-actions" style="margin-top:8px;">
        <button class="btn btn-primary" id="assess-continue" type="button" ${answeredHere < items.length ? "disabled" : ""}>
          ${sectionIndex + 1 < AXIS_ORDER.length ? "Continue" : "See your result"}
        </button>
        ${sectionIndex > 0 ? `<button class="btn btn-secondary" id="assess-back" type="button">Back</button>` : ""}
      </div>
    `;

    items.forEach(item => {
      content.querySelectorAll(`[data-item="${item.id}"] .assess-scale-btn`).forEach(btn => {
        btn.addEventListener("click", () => {
          responses[item.id] = Number(btn.dataset.value);
          content.querySelectorAll(`[data-item="${item.id}"] .assess-scale-btn`).forEach(b => {
            b.classList.toggle("selected", b === btn);
            b.setAttribute("aria-pressed", b === btn ? "true" : "false");
          });
          const continueBtn = document.getElementById("assess-continue");
          const allAnswered = items.every(i => typeof responses[i.id] === "number");
          continueBtn.disabled = !allAnswered;
        });
      });
    });

    document.getElementById("assess-continue").addEventListener("click", () => {
      if (sectionIndex + 1 < AXIS_ORDER.length) {
        sectionIndex += 1;
        renderSection();
      } else {
        renderResult();
      }
    });
    document.getElementById("assess-back")?.addEventListener("click", () => {
      sectionIndex -= 1;
      renderSection();
    });
    window.scrollTo(0, 0);
  }

  function assessItemHtml(item) {
    const current = responses[item.id];
    return `
      <div class="assess-item" data-item="${esc(item.id)}">
        <p class="assess-item-text">${esc(item.text)}</p>
        <div class="assess-scale" role="group" aria-label="${esc(item.text)}">
          ${ASSESSMENT_SCALE.map(s => `
            <button class="assess-scale-btn${current === s.value ? " selected" : ""}" type="button"
                    data-value="${s.value}" title="${esc(s.label)}" aria-label="${esc(s.label)}"
                    aria-pressed="${current === s.value ? "true" : "false"}">${s.value}</button>
          `).join("")}
        </div>
        <div class="assess-scale-labels"><span>Strongly disagree</span><span>Strongly agree</span></div>
      </div>`;
  }

  function renderResult() {
    const profile = scoreAssessmentResponses(responses);
    const archetype = matchArchetype(profile);
    const capability = capabilityIndex(profile);
    const persona = PERSONAS.find(p => p.slug === archetype);
    const answered = assessmentAnsweredCount(responses);

    saveProfile(profile, archetype, capability);
    savePersona(archetype);
    if (typeof archetypeCloseness === "function" && typeof logProfileSnapshot === "function") {
      const closeness = archetypeCloseness(profile, archetype);
      if (closeness !== null) logProfileSnapshot(profile, archetype, closeness / 100);
    }

    content.innerHTML = `
      <p class="scenario-eyebrow">Assessment complete</p>
      <h1 style="font-family:var(--font-display);font-weight:500;margin:0 0 10px;">${esc(persona ? persona.name : "Your archetype")}</h1>
      <p class="report-body" style="font-size:16px;">${esc(persona ? persona.trait : "")}</p>
      <p class="report-meta" style="margin:10px 0 20px;">Based on ${answered} of ${ASSESSMENT_ITEMS.length} statements answered — this has replaced your quiz profile with this more precise read.</p>
      <div class="recap-actions">
        <a class="btn btn-primary" href="report.html">See your full report &rarr;</a>
        <a class="btn btn-secondary" href="progress.html">Back to progress</a>
      </div>
    `;
  }

  renderIntro();
})();
