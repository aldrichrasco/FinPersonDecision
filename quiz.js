// Renders a modal quiz that scores the six-axis Financial Behavioural
// Model (see fbm.js). Each answer nudges one or more axes; the resulting
// profile selects the closest archetype and seeds the learner's baseline
// capability index for tracking change over time (the Evolution tenet).
//
// Each option's `d` maps axis -> delta (applied to a profile that starts
// at all-50). Deltas are additive and clamped to 0-100 at the end.

const QUIZ_QUESTIONS = [
  {
    q: "Unexpected money lands in your account. First move?",
    options: [
      { label: "Straight into savings", d: { impulse_regulation: +18, temporal_orientation: +12 } },
      { label: "Research the best way to grow it", d: { risk_disposition: +15, temporal_orientation: +15, financial_attentiveness: +10 } },
      { label: "Treat yourself, plan later", d: { impulse_regulation: -20, temporal_orientation: -12 } },
      { label: "Let it sit — deal with it eventually", d: { financial_attentiveness: -18, temporal_orientation: -8 } },
      { label: "Think about who needs it more than you", d: { prosocial_orientation: +22 } },
    ],
  },
  {
    q: "How do you feel checking your bank balance?",
    options: [
      { label: "Calm — I already know roughly what's there", d: { financial_self_efficacy: +18, financial_attentiveness: +15 } },
      { label: "Curious how it's tracking against my goals", d: { financial_attentiveness: +18, temporal_orientation: +10 } },
      { label: "Fine, as long as I don't look too closely", d: { financial_attentiveness: -12, impulse_regulation: -8 } },
      { label: "Anxious — I put it off as long as I can", d: { financial_self_efficacy: -22, financial_attentiveness: -18 } },
      { label: "Fine — I care more about what I can do for others", d: { prosocial_orientation: +15, financial_self_efficacy: +6 } },
    ],
  },
  {
    q: "A big purchase decision usually comes down to...",
    options: [
      { label: "Whether I can afford it without touching savings", d: { impulse_regulation: +18, temporal_orientation: +10 } },
      { label: "Whether it grows my income or skills long-term", d: { temporal_orientation: +18, risk_disposition: +8 } },
      { label: "How much I want it right now", d: { impulse_regulation: -22, temporal_orientation: -12 } },
      { label: "I rarely make it that far before deciding", d: { financial_attentiveness: -15, impulse_regulation: -10 } },
      { label: "Whether it means I can give less elsewhere", d: { prosocial_orientation: +18 } },
    ],
  },
  {
    q: "Your ideal financial plan sounds like...",
    options: [
      { label: "Predictable, boring, and safe", d: { risk_disposition: -18, impulse_regulation: +10 } },
      { label: "Ambitious, with real upside", d: { risk_disposition: +18, temporal_orientation: +12 } },
      { label: "Flexible — plans stress me out", d: { temporal_orientation: -15, financial_self_efficacy: -8 } },
      { label: "I don't really have one", d: { temporal_orientation: -18, financial_attentiveness: -12 } },
      { label: "One that supports people and causes I care about", d: { prosocial_orientation: +20, temporal_orientation: +6 } },
    ],
  },
  {
    q: "When something in your budget goes wrong, you...",
    options: [
      { label: "Already have a buffer for exactly this", d: { temporal_orientation: +15, financial_self_efficacy: +15 } },
      { label: "Treat it as a problem to optimize around", d: { financial_attentiveness: +15, financial_self_efficacy: +12 } },
      { label: "Deal with it later, somehow it works out", d: { impulse_regulation: -12, financial_attentiveness: -10 } },
      { label: "Feel a wave of stress and avoid looking", d: { financial_self_efficacy: -20, financial_attentiveness: -15 } },
      { label: "Adjust my giving before anything else", d: { prosocial_orientation: +15 } },
    ],
  },
  {
    q: "Taking a financial risk with real upside makes you...",
    options: [
      { label: "Uneasy — I'd rather protect what I have", d: { risk_disposition: -20, financial_self_efficacy: -5 } },
      { label: "Energized — that's where growth happens", d: { risk_disposition: +22, financial_self_efficacy: +10 } },
      { label: "Confident I can read it by instinct", d: { risk_disposition: +15, financial_self_efficacy: +18, financial_attentiveness: -8 } },
      { label: "Overwhelmed — I'd avoid the decision", d: { financial_attentiveness: -15, financial_self_efficacy: -15 } },
    ],
  },
  {
    q: "How far ahead do you actually plan your money?",
    options: [
      { label: "Years out — I think in decades", d: { temporal_orientation: +22 } },
      { label: "A few months at a time", d: { temporal_orientation: +5 } },
      { label: "This week, mostly", d: { temporal_orientation: -15 } },
      { label: "I don't really plan", d: { temporal_orientation: -22, financial_attentiveness: -10 } },
    ],
  },
  {
    q: "Which sounds most like you?",
    options: [
      { label: "I track my money closely and feel in control", d: { financial_attentiveness: +18, financial_self_efficacy: +15 } },
      { label: "I spend to enjoy life now", d: { impulse_regulation: -18, temporal_orientation: -10 } },
      { label: "I'd rather not think about money at all", d: { financial_attentiveness: -20, financial_self_efficacy: -12 } },
      { label: "Giving to others is part of my identity", d: { prosocial_orientation: +22 } },
    ],
  },
];

let quizStep = 0;
let quizProfile = null; // built up during the quiz
let quizTriggerEl = null;

function openQuiz() {
  quizStep = 0;
  quizProfile = neutralProfile();
  quizTriggerEl = document.activeElement;
  const overlay = document.getElementById("quiz-overlay");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  renderQuizStep();
  document.addEventListener("keydown", onQuizKeydown);
}

function closeQuiz() {
  document.getElementById("quiz-overlay").classList.remove("open");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onQuizKeydown);
  if (quizTriggerEl) quizTriggerEl.focus();
}

function onQuizKeydown(e) {
  if (e.key === "Escape") {
    closeQuiz();
    return;
  }
  if (e.key !== "Tab") return;
  const modal = document.querySelector(".quiz-modal");
  const focusable = modal.querySelectorAll("button, a[href]");
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function renderQuizStep() {
  const body = document.getElementById("quiz-body");
  const progress = document.getElementById("quiz-progress");
  progress.textContent = `Question ${quizStep + 1} of ${QUIZ_QUESTIONS.length}`;
  const step = QUIZ_QUESTIONS[quizStep];
  body.innerHTML = `
    <p class="quiz-q">${esc(step.q)}</p>
    <div class="quiz-options">
      ${step.options.map((o, i) => `<button class="quiz-option" data-i="${i}">${esc(o.label)}</button>`).join("")}
    </div>
  `;
  body.querySelectorAll(".quiz-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const opt = step.options[+btn.dataset.i];
      Object.entries(opt.d || {}).forEach(([axis, delta]) => {
        quizProfile[axis] = clamp01to100((quizProfile[axis] ?? 50) + delta);
      });
      quizStep++;
      if (quizStep < QUIZ_QUESTIONS.length) {
        renderQuizStep();
      } else {
        renderQuizResult();
      }
    });
  });
  body.querySelector(".quiz-option")?.focus();
}

function renderQuizResult() {
  const primarySlug = matchArchetype(quizProfile);
  const primary = PERSONAS.find(p => p.slug === primarySlug);
  const capability = capabilityIndex(quizProfile);

  // The full profile is still stored — the engine uses it. The person just
  // doesn't see a scorecard, because a scorecard invites you to argue with a
  // number instead of recognising yourself in a description.
  saveProfile(quizProfile, primarySlug, capability);
  savePersona(primarySlug);
  saveQuizPrediction(primarySlug, quizProfile, capability);

  // How far the raw profile sits from a "pure" version of the matched
  // archetype — feeds admin-level research analytics (see db.py
  // profile_snapshots / admin_stats). 0-1 scale: 1 = exact archetype match.
  if (typeof archetypeCloseness === "function" && typeof logProfileSnapshot === "function") {
    const closeness = archetypeCloseness(quizProfile, primarySlug);
    if (closeness !== null) logProfileSnapshot(quizProfile, primarySlug, closeness / 100);
  }

  const description = characterise(quizProfile, primarySlug);
  // Carry the matched archetype through explicitly. Previously this looked up
  // a situation by coach and silently fell back to a default when none
  // existed, discarding a correct match for six of the eleven archetypes.
  const situation = SITUATIONS.find(x => x.coach === primarySlug);
  const sandboxHref = situation
    ? `dashboard.html?situation=${encodeURIComponent(situation.id)}`
    : `dashboard.html?persona=${encodeURIComponent(primarySlug)}`;

  document.getElementById("quiz-progress").textContent = "Here's what I picked up";
  document.getElementById("quiz-body").innerHTML = `
    <div class="quiz-read">
      <div class="quiz-prediction">
        <p class="quiz-prediction-label">Tentative persona</p>
        <h3>${esc(primary.name)}</h3>
        <p class="quiz-prediction-trait">${esc(primary.trait)}</p>
        <p class="quiz-prediction-note">This is a first-pass match from a short quiz, not a verdict. You can keep exploring it or switch to another persona at any time.</p>
      </div>
      <p class="quiz-read-body">${esc(description)}</p>
      <p class="quiz-read-hedge">
        That's a first impression from a few questions, not a verdict. It'll get
        more accurate as you actually make decisions — and you can ignore it entirely.
      </p>
    </div>
    <div class="quiz-result-actions">
      <a class="btn btn-primary" href="${esc(sandboxHref)}">Open this persona in sandbox</a>
      <a class="btn btn-secondary" href="${esc(personaUrl(primarySlug))}">Talk it through instead</a>
    </div>
  `;
  document.querySelector(".quiz-result-actions .btn-primary")?.focus();
}

function initQuiz() {
  document.getElementById("quiz-btn").addEventListener("click", openQuiz);
  document.getElementById("quiz-close").addEventListener("click", closeQuiz);
  document.getElementById("quiz-overlay").addEventListener("click", e => {
    if (e.target.id === "quiz-overlay") closeQuiz();
  });
}
