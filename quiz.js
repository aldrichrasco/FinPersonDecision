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
      { label: "Think about who needs it more than you", d: { prosocial_orientation: +10 } },
    ],
  },
  {
    q: "How do you feel checking your bank balance?",
    options: [
      { label: "Calm — I already know roughly what's there", d: { financial_self_efficacy: +18, financial_attentiveness: +15 } },
      { label: "Curious how it's tracking against my goals", d: { financial_attentiveness: +18, temporal_orientation: +10 } },
      { label: "Fine, as long as I don't look too closely", d: { financial_attentiveness: -12, impulse_regulation: -8 } },
      { label: "Anxious — I put it off as long as I can", d: { financial_self_efficacy: -22, financial_attentiveness: -18 } },
      { label: "Fine — I care more about what I can do for others", d: { prosocial_orientation: +7, financial_self_efficacy: +6 } },
    ],
  },
  {
    q: "A big purchase decision usually comes down to...",
    options: [
      { label: "Whether I can afford it without touching savings", d: { impulse_regulation: +24, temporal_orientation: +10 } },
      { label: "Whether it grows my income or skills long-term", d: { temporal_orientation: +18, risk_disposition: +8 } },
      { label: "How much I want it right now", d: { impulse_regulation: -22, temporal_orientation: -12 } },
      { label: "I rarely make it that far before deciding", d: { financial_attentiveness: -15, impulse_regulation: -10 } },
      { label: "Whether it means I can give less elsewhere", d: { prosocial_orientation: +8 } },
    ],
  },
  {
    q: "Your ideal financial plan sounds like...",
    options: [
      { label: "Predictable, boring, and safe", d: { risk_disposition: -18, impulse_regulation: +10 } },
      { label: "Ambitious, with real upside", d: { risk_disposition: +18, temporal_orientation: +12 } },
      { label: "Flexible — plans stress me out", d: { temporal_orientation: -15, financial_self_efficacy: -8 } },
      { label: "I don't really have one", d: { temporal_orientation: -18, financial_attentiveness: -12 } },
      { label: "One that supports people and causes I care about", d: { prosocial_orientation: +9, temporal_orientation: +6 } },
    ],
  },
  {
    q: "When something in your budget goes wrong, you...",
    options: [
      { label: "Already have a buffer for exactly this", d: { temporal_orientation: +15, financial_self_efficacy: +15 } },
      { label: "Treat it as a problem to optimize around", d: { financial_attentiveness: +15, financial_self_efficacy: +12 } },
      { label: "Deal with it later, somehow it works out", d: { impulse_regulation: -12, financial_attentiveness: -10 } },
      { label: "Feel a wave of stress and avoid looking", d: { financial_self_efficacy: -20, financial_attentiveness: -15 } },
      { label: "Adjust my giving before anything else", d: { prosocial_orientation: +7 } },
    ],
  },
  {
    q: "Taking a financial risk with real upside makes you...",
    options: [
      { label: "Uneasy — I'd rather protect what I have", d: { risk_disposition: -20, financial_self_efficacy: -5, financial_attentiveness: +12 } },
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
      { label: "I spend to enjoy life now", d: { impulse_regulation: -8, temporal_orientation: -10 } },
      { label: "I'd rather not think about money at all", d: { financial_attentiveness: -20, financial_self_efficacy: -12 } },
      { label: "Giving to others is part of my identity", d: { prosocial_orientation: +10 } },
    ],
  },
  {
    q: "Someone compliments a purchase you made. How do you feel?",
    options: [
      { label: "Good — it was for a person or cause, not for me", d: { prosocial_orientation: +18 } },
      { label: "Good — I picked it because it says something about me", d: { prosocial_orientation: -18, impulse_regulation: +6 } },
      { label: "I don't really think about it that way", d: { financial_attentiveness: +8, temporal_orientation: +5 } },
      { label: "Slightly guilty — I hadn't planned to spend that", d: { impulse_regulation: -10 } },
    ],
  },
  {
    q: "A financial risk goes wrong for someone you know. Your first thought?",
    options: [
      { label: "What did they miss — I'd watch for that", d: { financial_attentiveness: +10, risk_disposition: -5 } },
      { label: "Bad luck, could happen to anyone", d: { risk_disposition: +12, financial_self_efficacy: +12, financial_attentiveness: -8 } },
      { label: "That's exactly why I avoid risk", d: { risk_disposition: -20, financial_self_efficacy: -8 } },
      { label: "I'd have caught it early — I watch things closely", d: { financial_attentiveness: +10, risk_disposition: +12 } },
    ],
  },
  {
    q: "You picture your finances five years from now. What's the picture?",
    options: [
      { label: "Already growing something specific I'm building toward", d: { temporal_orientation: +20, risk_disposition: +10 } },
      { label: "Steady and unremarkable, exactly as planned", d: { temporal_orientation: +15, impulse_regulation: +15 } },
      { label: "Protected against whatever could go wrong", d: { risk_disposition: -18, financial_attentiveness: +12 } },
      { label: "Honestly, I haven't pictured it", d: { temporal_orientation: -20, financial_attentiveness: -10 } },
    ],
  },
  {
    q: "When you make a big financial decision, who else factors in?",
    options: [
      { label: "Just me and my own goals", d: { prosocial_orientation: -20 } },
      { label: "People who depend on me, before myself", d: { prosocial_orientation: +20 } },
      { label: "Whoever's watching, if I'm honest", d: { prosocial_orientation: -24, financial_self_efficacy: +8 } },
      { label: "I don't really factor anyone in — I just decide", d: { financial_attentiveness: -12, impulse_regulation: -10 } },
    ],
  },
  {
    q: "A subscription you barely use auto-renews. What actually happens?",
    options: [
      { label: "I catch it and cancel before it charges", d: { financial_attentiveness: +26, impulse_regulation: +8 } },
      { label: "I mean to cancel it, but somehow don't get to it", d: { financial_attentiveness: -15 } },
      { label: "I don't even notice until I see the charge", d: { financial_attentiveness: -14 } },
      { label: "I keep it — I might use it again", d: { impulse_regulation: -10, financial_attentiveness: -5 } },
    ],
  },
  {
    q: "A friend asks to borrow money you're not sure you'll get back. What do you do?",
    options: [
      { label: "Say no, or only lend what I can afford to lose", d: { impulse_regulation: +12, financial_self_efficacy: +10, prosocial_orientation: -12 } },
      { label: "Lend it anyway — they're a friend", d: { prosocial_orientation: +12, financial_attentiveness: -8 } },
      { label: "Lend it and quietly write it off in my head", d: { prosocial_orientation: +8, financial_self_efficacy: -10 } },
      { label: "Feel too anxious to say no, even though I want to", d: { financial_self_efficacy: -18 } },
    ],
  },
  {
    q: "It's time to negotiate your pay. What's your instinct?",
    options: [
      { label: "Ask for more, with a number in mind", d: { financial_self_efficacy: +26, risk_disposition: +10 } },
      { label: "Wait to be offered more — I don't want to push", d: { financial_self_efficacy: -10, risk_disposition: -8 } },
      { label: "Ask, but brace for rejection the whole time", d: { financial_self_efficacy: -8, risk_disposition: +5 } },
      { label: "Avoid the conversation entirely", d: { financial_self_efficacy: -14, financial_attentiveness: -10 } },
    ],
  },
  {
    q: "You're offered an extended warranty at checkout. What do you do?",
    options: [
      { label: "Decline — I do the math on whether it's worth it", d: { financial_attentiveness: +15, impulse_regulation: +14 } },
      { label: "Usually say yes, just in case", d: { risk_disposition: -15, impulse_regulation: -5 } },
      { label: "Say no without really thinking about it either way", d: { financial_attentiveness: -5 } },
      { label: "Depends entirely on how the person selling it makes me feel", d: { impulse_regulation: -11, financial_attentiveness: -10 } },
    ],
  },
  {
    q: "Splitting a bill with friends, one of them clearly ordered more. What happens?",
    options: [
      { label: "I mention it and we split it fairly", d: { financial_attentiveness: +12, prosocial_orientation: -14 } },
      { label: "I just split it evenly — not worth the awkwardness", d: { prosocial_orientation: +8 } },
      { label: "I quietly resent it but don't say anything", d: { financial_self_efficacy: -12, prosocial_orientation: +4 } },
      { label: "I offer to cover the difference myself", d: { prosocial_orientation: +12 } },
    ],
  },
  {
    q: "An unexpected bonus lands at work. What's the first thing that crosses your mind?",
    options: [
      { label: "Where this fits into my existing plan", d: { temporal_orientation: +12, financial_attentiveness: +10 } },
      { label: "What I'm going to buy with it", d: { impulse_regulation: -10, temporal_orientation: -14 } },
      { label: "Whether I should invest it somewhere", d: { risk_disposition: +15, temporal_orientation: +12 } },
      { label: "Who else could use this more than me", d: { prosocial_orientation: +9 } },
    ],
  },
  {
    q: "Markets drop sharply and it's all over the news. What do you actually do?",
    options: [
      { label: "Nothing — I don't check, the plan doesn't change", d: { risk_disposition: +12, financial_self_efficacy: +15 } },
      { label: "Check constantly and feel sick about it", d: { financial_self_efficacy: -18, financial_attentiveness: +10 } },
      { label: "See it as a buying opportunity", d: { risk_disposition: +20, financial_self_efficacy: +10 } },
      { label: "Pull money out before it gets worse", d: { risk_disposition: -22, financial_self_efficacy: -8 } },
    ],
  },
  {
    q: "Your rent or mortgage is due in three days and a bill you forgot about just landed. What's your reaction?",
    options: [
      { label: "Annoyed, but I have a buffer for exactly this", d: { temporal_orientation: +10, financial_self_efficacy: +21 } },
      { label: "Scramble, but it works out", d: { financial_self_efficacy: -8, financial_attentiveness: -5 } },
      { label: "Real stress — I don't know how this resolves", d: { financial_self_efficacy: -16, financial_attentiveness: -10 } },
      { label: "I'd have already seen it coming", d: { financial_attentiveness: +22 } },
    ],
  },
];

// Escalation: after the 12 base questions, if the top two candidate
// archetypes are still close, one more question targets whichever axis
// separates them most — authored, fixed, keyed by axis (not by archetype
// pair, since any two archetypes that differ mainly on the same axis are
// disambiguated the same way). This is the research-mode question: same
// question, same wording, every time, for the DSS paper's validity.
// AI-generated mode (quiz_gen.py) tries first for everyone else and falls
// back to this bank on any failure — see maybeAskTiebreaker() below.
const TIEBREAKER_QUESTIONS = {
  impulse_regulation: {
    q: "You're standing at checkout with something unplanned in your cart. What actually happens?",
    options: [
      { label: "I put it back — wasn't the plan", d: { impulse_regulation: +20 } },
      { label: "I buy it, but note it and adjust elsewhere", d: { impulse_regulation: +8 } },
      { label: "I buy it without a second thought", d: { impulse_regulation: -20 } },
    ],
  },
  risk_disposition: {
    q: "Two paths to the same goal: one slower and certain, one faster with real chance of falling short. Which do you take?",
    options: [
      { label: "Slower and certain, every time", d: { risk_disposition: -20 } },
      { label: "Depends how much is riding on it", d: { risk_disposition: +5 } },
      { label: "Faster path — I'd rather move", d: { risk_disposition: +20 } },
    ],
  },
  temporal_orientation: {
    q: "Someone asks what your money is 'for.' What's the honest answer?",
    options: [
      { label: "Something specific, years out", d: { temporal_orientation: +20 } },
      { label: "Whatever comes up this year", d: { temporal_orientation: 0 } },
      { label: "Honestly, this week", d: { temporal_orientation: -20 } },
    ],
  },
  financial_attentiveness: {
    q: "It's been a month since you actually looked at your full financial picture. How does that sit with you?",
    options: [
      { label: "That wouldn't happen — I check often", d: { financial_attentiveness: +20 } },
      { label: "Normal for me, I check when something's due", d: { financial_attentiveness: 0 } },
      { label: "Sounds about right, maybe longer", d: { financial_attentiveness: -20 } },
    ],
  },
  financial_self_efficacy: {
    q: "A money decision goes wrong despite your best judgment. What's your read on it afterward?",
    options: [
      { label: "I'll get it right next time — I know what I'm doing generally", d: { financial_self_efficacy: +20 } },
      { label: "It shakes my confidence for a while", d: { financial_self_efficacy: -10 } },
      { label: "Confirms I shouldn't trust my own judgment here", d: { financial_self_efficacy: -20 } },
    ],
  },
  prosocial_orientation: {
    q: "You come into some extra money with no immediate need. What pulls at you first?",
    options: [
      { label: "Whether someone else could use it more", d: { prosocial_orientation: +20 } },
      { label: "A mix — some for others, most for me", d: { prosocial_orientation: 0 } },
      { label: "It's mine — I'll decide for myself", d: { prosocial_orientation: -20 } },
    ],
  },
};

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
        maybeAskTiebreaker();
      }
    });
  });
  body.querySelector(".quiz-option")?.focus();
}

// If the top two candidate archetypes are still close after the 12 base
// questions, ask one more question targeting whichever axis separates them
// most, before committing to a result. An unambiguous profile skips this
// entirely — the point is to ask more only when it's actually needed.
const TIEBREAKER_AMBIGUITY_THRESHOLD = 20;

function nearestTwoArchetypes(profile) {
  return Object.keys(ARCHETYPE_PROFILES)
    .map(slug => ({ slug, dist: distanceToArchetype(profile, slug) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2);
}

function topDifferingAxes(slugA, slugB) {
  const a = ARCHETYPE_PROFILES[slugA], b = ARCHETYPE_PROFILES[slugB];
  return AXIS_KEYS
    .map(k => ({ axis: k, diff: Math.abs(a[k] - b[k]) }))
    .sort((x, y) => y.diff - x.diff);
}

function maybeAskTiebreaker() {
  const [first, second] = nearestTwoArchetypes(quizProfile);
  if (!second || second.dist - first.dist > TIEBREAKER_AMBIGUITY_THRESHOLD) {
    renderQuizResult();
    return;
  }

  const axes = topDifferingAxes(first.slug, second.slug);
  const axisA = axes[0].axis;
  const axisB = (axes[1] && axes[1].axis) || axisA;
  const fallback = TIEBREAKER_QUESTIONS[axisA];

  const situationId = typeof getSavedSituation === "function" ? getSavedSituation() : null;
  const situation = situationId && typeof getSituation === "function" ? getSituation(situationId) : null;
  const situationLabel = situation ? situation.label : "";

  // The generated-question fetch can take a few seconds — without this the
  // last answered question just sits on screen looking frozen/stuck.
  document.getElementById("quiz-progress").textContent = "One more, to be sure";
  document.getElementById("quiz-body").innerHTML = `<p class="quiz-loading">Thinking of one more question&hellip;</p>`;

  if (typeof fetchGeneratedQuizQuestion === "function") {
    fetchGeneratedQuizQuestion(situationLabel, axisA, axisB)
      .then(generated => renderTiebreakerQuestion(generated || fallback))
      .catch(() => renderTiebreakerQuestion(fallback));
  } else {
    renderTiebreakerQuestion(fallback);
  }
}

function renderTiebreakerQuestion(step) {
  const body = document.getElementById("quiz-body");
  const progress = document.getElementById("quiz-progress");
  progress.textContent = "One more, to be sure";
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
      renderQuizResult();
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
    <p class="quiz-read-hedge" style="margin-top:14px;">
      Want a more careful read than a 30-second quiz can give? <a href="assessment.html">Take the full assessment &rarr;</a>
    </p>
    <form id="quiz-lead-form" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <label for="quiz-lead-email" style="flex:1;min-width:220px;">
        <span style="display:block;font-size:12.5px;color:var(--slate);margin-bottom:6px;">Want to stay in the loop as FinPerson grows? Leave your email.</span>
        <input type="email" id="quiz-lead-email" class="goal-input" placeholder="you@example.com" required style="width:100%;">
      </label>
      <button class="btn btn-secondary" type="submit" style="flex-shrink:0;">Keep me posted</button>
      <span id="quiz-lead-status" style="font-size:12.5px;color:var(--slate);width:100%;"></span>
    </form>
  `;
  document.querySelector(".quiz-result-actions .btn-primary")?.focus();

  const leadForm = document.getElementById("quiz-lead-form");
  leadForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("quiz-lead-email");
    const status = document.getElementById("quiz-lead-status");
    const submitBtn = leadForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    status.textContent = "Saving…";
    const ok = typeof submitEmailLead === "function"
      ? await submitEmailLead(emailInput.value.trim(), "quiz_result", primarySlug)
      : false;
    if (ok) {
      status.textContent = "Thanks — saved.";
      emailInput.disabled = true;
      submitBtn.textContent = "Saved";
    } else {
      status.textContent = "Couldn't save that — try again in a moment.";
      submitBtn.disabled = false;
    }
  });
}

function initQuiz() {
  document.getElementById("quiz-btn").addEventListener("click", openQuiz);
  document.getElementById("quiz-close").addEventListener("click", closeQuiz);
  document.getElementById("quiz-overlay").addEventListener("click", e => {
    if (e.target.id === "quiz-overlay") closeQuiz();
  });
}

// Node-only export (no-op in the browser) so the question bank itself is
// testable for aggregate per-axis balance — see tests-js/quiz-balance.test.js.
// A quiz page never has `module`, so this never runs client-side.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { QUIZ_QUESTIONS, TIEBREAKER_QUESTIONS };
}
