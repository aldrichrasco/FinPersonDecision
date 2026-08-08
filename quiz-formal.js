// The Financial MRI assessment, as a formal instrument.
//
// Previously this lived in a modal over the landing page. That framing
// undersold it: this assessment produces roughly the first 70% of the
// product's main deliverable, and a popup reads as something you dismiss.
//
// Three deliberate differences from the modal version:
//
//   A full page with a visible progress track, so the length is stated up
//   front rather than discovered one question at a time.
//
//   A midway check. Once enough answers exist to form a hypothesis, the
//   assessment says what it currently thinks and asks whether that lands.
//   Disagreeing routes into the tiebreaker rather than being ignored, which
//   is the difference between an instrument and a form.
//
//   It ends on the report, not on a result card. The report is the product.
(function () {
  const content = document.getElementById("quiz-content");
  const meta = document.getElementById("quiz-meta");
  const progressTrack = document.getElementById("quizf-track");
  const fill = document.getElementById("quizf-fill");
  if (!content) return;

  const TOTAL = QUIZ_QUESTIONS.length;
  // Far enough in for a provisional read to be worth stating, early enough
  // that correcting it still changes the remaining questions.
  const MIDWAY_AT = Math.floor(TOTAL * 0.55);

  let step = 0;
  let profile = neutralProfile();
  let midwayDone = false;

  renderIntro();

  function setProgress(fraction) {
    progressTrack.hidden = false;
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }

  // -------------------------------------------------------------- intro
  function renderIntro() {
    meta.textContent = `${TOTAL} questions`;
    content.innerHTML = `
      <p class="quizf-section">Before you start</p>
      <h1 class="mri-name" style="font-size:clamp(26px,4.6vw,36px);">What actually drives your money decisions?</h1>
      <p class="mri-lede" style="margin-bottom:22px;">
        ${TOTAL} forced-choice questions, about three minutes. There are no right answers, and nothing here asks about your real balances.
      </p>
      <div class="mri-complete" style="margin-bottom:26px;">
        <p class="mri-split-name" style="margin-bottom:10px;">What this gives you</p>
        <ul class="mri-complete-list">
          <li class="has">Your six tendencies and what they mean together</li>
          <li class="has">Your archetype, and what makes yours different from the typical one</li>
          <li class="has">Your behavioural fingerprint</li>
          <li class="missing">The conditions that change your behaviour need decisions, not answers</li>
          <li class="missing">So does the gap between what you say and what you do</li>
        </ul>
        <p class="mri-note" style="margin-top:14px;font-size:13px;color:var(--mri-ink-3);">
          That is roughly 70% of your Financial MRI. The rest is built in the sandbox, because no set of questions can tell you what you actually do under pressure.
        </p>
      </div>
      <button class="mri-btn" id="quizf-begin" type="button">Begin the assessment</button>`;
    document.getElementById("quizf-begin").addEventListener("click", () => { step = 0; renderQuestion(); });
  }

  // ----------------------------------------------------------- questions
  function renderQuestion() {
    if (step >= TOTAL) return finishQuestions();
    if (!midwayDone && step === MIDWAY_AT) return renderMidway();

    const q = QUIZ_QUESTIONS[step];
    meta.textContent = `Question ${step + 1} of ${TOTAL}`;
    setProgress(step / TOTAL);
    content.innerHTML = `
      <p class="quizf-section">Question ${step + 1}</p>
      <p class="quizf-q">${esc(q.q)}</p>
      <div class="quizf-opts">
        ${q.options.map((o, i) => `
          <button class="quizf-opt" data-i="${i}" type="button">
            <span class="quizf-opt-key">${i + 1}</span>
            <span>${esc(o.label)}</span>
          </button>`).join("")}
      </div>
      ${step > 0 ? `<button class="quizf-back" id="quizf-back" type="button">&larr; Previous question</button>` : ""}`;

    content.querySelectorAll(".quizf-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        applyAnswer(q.options[+btn.dataset.i]);
        step++;
        renderQuestion();
      });
    });
    // Going back cannot un-apply a delta without storing every answer, so it
    // re-asks rather than pretending the previous one was erased. Stated
    // plainly on the control instead of silently doing the wrong thing.
    document.getElementById("quizf-back")?.addEventListener("click", () => {
      step = Math.max(0, step - 1);
      renderQuestion();
    });
    content.querySelector(".quizf-opt")?.focus();
  }

  function applyAnswer(opt) {
    Object.entries(opt.d || {}).forEach(([axis, delta]) => {
      profile[axis] = clamp01to100((profile[axis] ?? 50) + delta);
    });
  }

  // ------------------------------------------------------------- midway
  // The instrument states its working hypothesis and invites contradiction.
  // Agreeing is not treated as evidence, since agreement with a flattering
  // description is cheap; disagreeing routes into the tiebreaker.
  function renderMidway() {
    midwayDone = true;
    const slug = matchArchetype(profile);
    const p = PERSONAS.find(x => x.slug === slug);
    const top = AXIS_KEYS.map(k => ({ k, v: profile[k] ?? 50 }))
      .sort((a, b) => Math.abs(b.v - 50) - Math.abs(a.v - 50))[0];
    const dir = top.v >= 50 ? "high" : "low";
    const axisName = (typeof mriAxisName === "function") ? mriAxisName(top.k) : AXES[top.k].short;

    meta.textContent = "Checking in";
    setProgress(step / TOTAL);
    content.innerHTML = `
      <p class="quizf-section">Halfway &middot; a quick check</p>
      <p class="quizf-q">So far you look like ${esc(p ? p.name : slug)}.</p>
      <p class="mri-note" style="margin-bottom:24px;">
        The clearest signal so far is <strong>${esc(dir)} ${esc(axisName)}</strong>. ${esc(p ? p.trait : "")}
        <br><br>This is provisional, and saying no is more useful to us than saying yes.
      </p>
      <div class="quizf-opts">
        <button class="quizf-opt" id="quizf-yes" type="button"><span class="quizf-opt-key">Y</span><span>That sounds about right</span></button>
        <button class="quizf-opt" id="quizf-no" type="button"><span class="quizf-opt-key">N</span><span>Not really, that is not me</span></button>
      </div>`;

    document.getElementById("quizf-yes").addEventListener("click", () => {
      if (typeof track === "function") track("quiz_midway", { agreed: true, archetype: slug });
      renderQuestion();
    });
    document.getElementById("quizf-no").addEventListener("click", () => {
      if (typeof track === "function") track("quiz_midway", { agreed: false, archetype: slug });
      renderMidwayFollowUp();
    });
  }

  // Disagreement is routed into the existing tiebreaker bank, targeted at the
  // axis that currently separates the two closest archetypes. That is exactly
  // the question most likely to move the answer.
  function renderMidwayFollowUp() {
    const ranked = Object.keys(ARCHETYPE_PROFILES)
      .map(slug => ({ slug, dist: distanceToArchetype(profile, slug) }))
      .sort((a, b) => a.dist - b.dist);
    const axes = AXIS_KEYS
      .map(k => ({ k, diff: Math.abs(ARCHETYPE_PROFILES[ranked[0].slug][k] - ARCHETYPE_PROFILES[ranked[1].slug][k]) }))
      .sort((a, b) => b.diff - a.diff);
    const tb = TIEBREAKER_QUESTIONS[axes[0].k];
    if (!tb) return renderQuestion();

    meta.textContent = "One clarifying question";
    content.innerHTML = `
      <p class="quizf-section">Let's narrow it down</p>
      <p class="quizf-q">${esc(tb.q)}</p>
      <p class="mri-note" style="margin-bottom:22px;font-size:13px;color:var(--mri-ink-3);">
        Asked because your answers so far sit between two patterns, and this is the question that separates them.
      </p>
      <div class="quizf-opts">
        ${tb.options.map((o, i) => `
          <button class="quizf-opt" data-i="${i}" type="button">
            <span class="quizf-opt-key">${i + 1}</span><span>${esc(o.label)}</span>
          </button>`).join("")}
      </div>`;
    content.querySelectorAll(".quizf-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        applyAnswer(tb.options[+btn.dataset.i]);
        renderQuestion();
      });
    });
  }

  // -------------------------------------------------------------- finish
  function finishQuestions() {
    setProgress(1);
    const slug = matchArchetype(profile);
    const capability = capabilityIndex(profile);
    saveProfile(profile, slug, capability);
    savePersona(slug);
    saveQuizPrediction(slug, profile, capability);
    if (typeof archetypeCloseness === "function" && typeof logProfileSnapshot === "function") {
      const c = archetypeCloseness(profile, slug);
      if (c !== null) logProfileSnapshot(profile, slug, c / 100);
    }
    if (typeof markRoadmapLevelComplete === "function") markRoadmapLevelComplete("quiz");
    if (typeof track === "function") track("quiz_completed", { archetype: slug, questions: TOTAL });

    const p = PERSONAS.find(x => x.slug === slug);
    meta.textContent = "Complete";
    content.innerHTML = `
      <p class="quizf-section">Assessment complete</p>
      <h1 class="mri-name" style="font-size:clamp(26px,4.6vw,36px);">${esc(p ? p.name : slug)}</h1>
      <p class="mri-lede" style="margin-bottom:26px;">${esc(p ? p.trait : "")}</p>
      <div class="mri-complete" style="margin-bottom:26px;">
        <div class="mri-complete-top">
          <span class="mri-split-name">Your Financial MRI</span>
          <span class="mri-complete-num">70%</span>
        </div>
        <div class="mri-complete-track">
          <span class="mri-complete-have" style="width:70%;"></span>
          <span class="mri-complete-gap" style="width:30%;"></span>
        </div>
        <p class="mri-note" style="font-size:13.5px;">
          Your tendencies, your fingerprint and what makes yours different are ready to read now.
          <strong>The remaining 30% is the part questions cannot answer:</strong> what you actually do when a decision is in front of you.
        </p>
      </div>
      <a class="mri-btn" href="report.html">Read your Financial MRI</a>
      <a class="mri-btn mri-btn-ghost" href="dashboard.html" style="margin-left:8px;">Fill the last 30%</a>`;
  }
})();
