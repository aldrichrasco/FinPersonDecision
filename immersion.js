// Sandbox immersion.
//
// The sandbox was a form: a paragraph, three buttons, and a row of numbers
// that changed somewhere off to the side. Nothing about it felt like a
// decision, which is a problem when the entire product rests on the claim
// that these are decisions rather than survey answers.
//
// Four changes, each aimed at a specific dryness:
//
//   The scene arrives    the situation reveals rather than appearing, so
//                        there is a beat to read it before options exist.
//   Options land after   choices stagger in beneath it, so the moment of
//                        reading and the moment of choosing are separate.
//   The choice commits   unchosen options fall away instead of simply
//                        vanishing, so a decision looks like a decision.
//   Numbers move         consequences count to their new value rather than
//                        snapping, which is what makes a cost feel like one.
//
// Everything here is suppressed under prefers-reduced-motion, and none of it
// gates interaction: every animation is decoration over a UI that already
// works if the animation never runs.

function immersionReduced() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Reveals the scenario, then its choices, as two separate beats. Timings are
// short enough that a returning player never waits on them.
function animateScenarioEntrance() {
  if (immersionReduced()) return;
  const card = document.getElementById("scenario-card");
  if (!card) return;

  const text = card.querySelector(".scenario-text");
  const head = card.querySelector(".scenario-head");
  const context = card.querySelector(".scenario-context");
  const choices = [...card.querySelectorAll(".choice-btn")];
  const reroll = card.querySelector(".reroll-btn");

  [head, text, context].forEach((el, i) => {
    if (!el) return;
    el.style.animation = `scene-in .42s cubic-bezier(.2,.7,.3,1) ${i * 0.07}s both`;
  });
  choices.forEach((el, i) => {
    el.style.animation = `choice-in .38s cubic-bezier(.2,.7,.3,1) ${0.24 + i * 0.08}s both`;
  });
  if (reroll) reroll.style.animation = `scene-in .3s ease ${0.3 + choices.length * 0.08}s both`;
}

// The commit. Unchosen options drop away and the chosen one holds for a beat
// before the outcome replaces the card, so the decision reads as a decision
// rather than as a screen swap.
function animateChoiceCommit(chosenBtn) {
  if (immersionReduced()) return;
  const card = document.getElementById("scenario-card");
  if (!card || !chosenBtn) return;
  card.querySelectorAll(".choice-btn").forEach(btn => {
    if (btn === chosenBtn) {
      btn.style.animation = "choice-commit .5s cubic-bezier(.2,.7,.3,1) both";
    } else {
      btn.style.animation = "choice-dismiss .34s cubic-bezier(.4,0,1,1) both";
    }
  });
}

// Counts a stat to its new value. Money and months read very differently, so
// the caller supplies the formatter rather than this guessing.
function animateNumber(el, from, to, format, durationMs) {
  if (!el) return;
  if (immersionReduced() || from === to) {
    el.textContent = format(to);
    return;
  }
  const duration = durationMs || 620;
  const start = performance.now();
  // Ease-out: the number moves fast then settles, which reads as arriving
  // rather than as a counter spinning.
  const ease = t => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = format(to);
  }
  requestAnimationFrame(frame);
}

// A brief flash on the tiles that actually moved, so the eye is told where to
// look instead of having to scan three numbers to find the changed one.
function flashChanged(tileId, direction) {
  if (immersionReduced()) return;
  const tile = document.getElementById(tileId);
  if (!tile) return;
  tile.classList.remove("stat-moved-up", "stat-moved-down");
  void tile.offsetWidth;
  tile.classList.add(direction >= 0 ? "stat-moved-up" : "stat-moved-down");
  setTimeout(() => tile.classList.remove("stat-moved-up", "stat-moved-down"), 900);
}

// Scene numbering. A decision is one beat in a run, and saying so turns a
// disconnected series of questions into something with shape.
function sceneLabel(decisionCount, roundLength) {
  const n = (decisionCount % roundLength) + 1;
  return `Scene ${n} of ${roundLength}`;
}
